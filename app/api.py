import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from graph import build_graph
from graph.state import Main_context
from app.main import predict
from pipeline.producer import run_producer
from db.queries import (
    get_all_customers_with_risk,
    get_all_customers_tabular,
    get_voice_customers,
    get_dashboard_stats,
    get_customer_full_profile,
    get_latest_as_kafka_message,
    get_intervention_history,
    get_audit_log,
    get_weekly_observations_live,
    get_total_events,
    get_customer_detail_overview,
    get_pending_interventions,
    get_pending_intervention_by_id,
    get_pending_summary,
    approve_pending_intervention,
    mark_intervention_executed,
    reject_pending_intervention,
)
from db.postgres import create_tables_if_not_exist, get_connection
from sqlalchemy import text
from db.redis_client import get_cached_risk_score, cache_risk_score
import json
import asyncio
from threading import Lock

active_voice_calls = set()
voice_call_lock = Lock()

app = FastAPI(title="Pre-Delinquency Intervention Engine")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Built once at module load — never inside a request handler
graph = build_graph()


@app.on_event("startup")
def startup():
    create_tables_if_not_exist()


@app.get("/customers")
def get_customers():
    return get_all_customers_with_risk()


@app.get("/customers/all")
def get_all_customers():
    """Returns all customers with latest prediction for Dashboard/Portfolio."""
    return get_all_customers_tabular()


@app.get("/customers/voice")
def list_voice_customers():
    """Returns customers who received voice interventions."""
    return get_voice_customers()


@app.get("/voice/execute/{pending_id}")
async def execute_voice_stream(pending_id: int):
    """
    Start a voice call and stream events to the client via SSE.
    Clients can listen to events: call_start, agent_speaking, listening,
    transcript, intent_detected, stage_change, escalation, call_end.

    After call completes, marks the intervention as executed in the database.
    """
    import json
    import asyncio
    from queue import Queue, Empty
    from threading import Thread

    pending = get_pending_intervention_by_id(pending_id)
    if not pending:
        raise HTTPException(status_code=404, detail="Pending intervention not found")

    if pending.get("channel") != "voice":
        raise HTTPException(status_code=400, detail="Not a voice intervention")

    if pending.get("status") == "EXECUTED":
        raise HTTPException(status_code=400, detail="Intervention already executed")

    # In-memory lock to prevent duplicate execution within the same process
    with voice_call_lock:
        if pending_id in active_voice_calls:
            raise HTTPException(status_code=400, detail="Voice call for this intervention is already in progress")
        active_voice_calls.add(pending_id)

    event_queue = Queue()
    # Use a mutable container to track result
    call_result = [{"executed": False, "error": None}]

    def run_voice_call():
        """Run voice call in background thread, emit events to queue."""
        try:
            from app.executor import build_voice_payload
            from voice_agent.agent import run_call

            voice_payload = build_voice_payload(pending)

            def emit_fn(event: str, data: dict):
                event_queue.put((event, data))

            run_call(voice_payload, emit_fn)
        except Exception as e:
            import traceback
            print(f"[VOICE-STREAM] Thread crashed: {e}")
            print(traceback.format_exc())
            event_queue.put(("error", {"message": str(e)}))

    def event_generator():
        """Async generator that yields events from the queue."""
        # Start voice call in background thread
        call_thread = Thread(target=run_voice_call, daemon=True)
        call_thread.start()

        try:
            while True:
                # Check for events in queue
                try:
                    event_data = event_queue.get(timeout=0.5)
                    event_type, data = event_data

                    # Yield SSE formatted message
                    yield f"event: {event_type}\ndata: {json.dumps(data)}\n\n"

                    if event_type in ["call_end", "call_complete"]:
                        call_result[0] = {"executed": True, "voice_result": data}
                        break
                    elif event_type == "error":
                        call_result[0] = {
                            "executed": False,
                            "error": data.get("message"),
                        }
                        break

                except Empty:
                    # Queue timeout, check if thread is still alive
                    if not call_thread.is_alive():
                        # Thread died without putting an end event or error
                        if not call_result[0].get("executed") and not call_result[0].get("error"):
                            print(f"[VOICE-STREAM] Thread died unexpectedly for pending_id={pending_id}")
                            call_result[0] = {"executed": False, "error": "Thread died unexpectedly"}
                            yield f"event: error\ndata: {json.dumps(call_result[0])}\n\n"
                        break
                    continue
                except Exception as loop_err:
                    print(f"[VOICE-STREAM] Loop error: {loop_err}")
                    call_result[0] = {"executed": False, "error": str(loop_err)}
                    yield f"event: error\ndata: {json.dumps(call_result[0])}\n\n"
                    break
            
            # Final event to truly signal end
            yield f"event: call_ended\ndata: {json.dumps({'status': 'stream_closed'})}\n\n"

        finally:
            # Release the in-memory lock
            with voice_call_lock:
                active_voice_calls.discard(pending_id)
                
            # Mark intervention as executed in database
            try:
                mark_intervention_executed(pending_id, call_result[0])
                print(f"[VOICE-STREAM] Finished stream for pending_id={pending_id}")
            except Exception as db_err:
                print(f"[VOICE-STREAM] Failed to mark executed: {db_err}")


    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.get("/dashboard/stats")
def get_stats():
    """Returns aggregated statistics for Dashboard KPIs."""
    return get_dashboard_stats()


@app.get("/customers/{customer_id}")
def get_customer(customer_id: str):
    result = get_customer_full_profile(customer_id)
    if not result:
        raise HTTPException(status_code=404, detail="Customer not found")
    return result


@app.get("/score/{customer_id}")
def get_score(customer_id: str):
    cached = get_cached_risk_score(customer_id)
    if cached:
        return {"customer_id": customer_id, "source": "cache", **cached}

    kafka_message = get_latest_as_kafka_message(customer_id)
    if not kafka_message:
        raise HTTPException(status_code=404, detail="Customer not found in DB")

    ml = predict(kafka_message)
    score_data = {
        "risk_score": ml["risk_score"],
        "lgb_p": ml.get("lgb_p", ml["risk_score"]),
        "gru_p": ml.get("gru_p", ml["risk_score"]),
        "risk_level": ml["risk_level"],
        "shap_factors": ml["shap_factors"],
        "observation_week": ml["observation_week"],
        "model_version": ml["model_version"],
    }
    cache_risk_score(customer_id, score_data)
    return {"customer_id": customer_id, "source": "computed", **score_data}


@app.post("/predict")
async def run_predict(request: Request):
    """ML inference only - run predict on provided record."""
    try:
        record = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    customer_id = record.get("customer_id")

    try:
        ml_result = predict(record)
        print(f"[Predict] ML completed for {customer_id}")
        return ml_result
    except Exception as e:
        print(f"[Predict] ML failed for {customer_id}: {e}")
        raise HTTPException(status_code=500, detail=f"ML prediction failed: {e}")


@app.post("/intervene/{customer_id}")
async def intervene(customer_id: str, request: Request):
    try:
        body = await request.json()
    except Exception:
        body = {}

    kafka_message = body.get("kafka_message")
    ml_result = body.get("ml_result")

    if not ml_result:
        # No pre-computed ML result - run predict
        if kafka_message:
            ml_result = predict(kafka_message)
        else:
            # Manual trigger — fetch from DB
            kafka_message = get_latest_as_kafka_message(customer_id)
            if not kafka_message:
                raise HTTPException(status_code=404, detail="Customer not found in DB")
            ml_result = predict(kafka_message)

    print(
        f"[Intervene] Running agents for {customer_id} with risk_score={ml_result.get('risk_score')}"
    )

    initial_state: Main_context = {
        "prediction_id": ml_result["prediction_id"],
        "observation_week": ml_result["observation_week"],
        "total_risk_score": ml_result["risk_score"],
        "risk_level": ml_result["risk_level"],
        "Shap": ml_result["shap_factors"],
        "Customer_profile": ml_result["customer_profile"],
        "Stress_context": {},
        "eligible_interventions": [],
        "hard_stop": False,
        "hard_stop_reason": None,
        "Message_Tone": "",
        "Message_content": "",
        "Intervention_method": "",
        "Intervention_justification": "",
        "selected_channel": None,
        "channel_dispatch_result": None,
        "voice_payload": None,
        "voice_result": None,
    }

    try:
        result = graph.invoke(initial_state)
        print("[Intervene] Agents completed successfully")
        return {
            "status": "pending_approval",
            "customer_id": customer_id,
            "pending_id": result.get("pending_id"),
            "needs_approval": result.get("needs_approval", False),
            "channel": result.get("channel"),
            "compliance_status": result.get("compliance_status"),
            "intervention_method": result.get("Intervention_method"),
            "intervention_justification": result.get("Intervention_justification"),
            "message_content": result.get("Message_content"),
            "voice_script_preview": result.get("voice_script_preview"),
            "total_risk_score": result.get("total_risk_score"),
            "risk_level": result.get("risk_level"),
            "lgb_p": ml_result.get("lgb_p"),
            "gru_p": ml_result.get("gru_p"),
            "shap_factors": ml_result.get("shap_factors"),
            "Stress_context": result.get("Stress_context", {}),
            "eligible_interventions": result.get("eligible_interventions", []),
            "hard_stop": result.get("hard_stop", False),
            "hard_stop_reason": result.get("hard_stop_reason"),
        }
    except Exception as e:
        import traceback

        print(f"[Intervene] Error: {e}")
        print(traceback.format_exc())
        return {"status": "error", "customer_id": customer_id, "error": str(e)}


@app.get("/outreach/{customer_id}")
def get_outreach(customer_id: str):
    results = get_intervention_history(customer_id)
    if not results:
        raise HTTPException(
            status_code=404, detail="No interventions found for this customer"
        )
    latest = results[0]
    return {
        "customer_id": customer_id,
        "message_content": latest.get("message_content"),
        "selected_channel": latest.get("selected_channel"),
        "created_at": str(latest.get("created_at")),
    }


RULES = {
    "thresholds": {
        "salary_delay_days": 3,
        "auto_debit_failures": 2,
        "savings_drawdown_pct": -20.0,
        "utility_payment_delay_days": 3,
    },
    "score_weights": {
        "salary_delay_days": 0.25,
        "auto_debit_failures": 0.30,
        "savings_drawdown_pct": 0.25,
        "utility_payment_delay_days": 0.20,
    },
    "risk_levels": {"High": 0.70, "Medium": 0.40},
}


@app.get("/customer/{customer_id}/detail")
def get_customer_detail(customer_id: str):
    data = get_customer_detail_overview(customer_id)
    if not data:
        raise HTTPException(status_code=404, detail="Customer not found")
    return data


@app.get("/rules")
def get_rules():
    return RULES


@app.put("/rules")
async def update_rules(request: Request):
    return {"status": "noted", "note": "Rule updates apply when ML model is connected"}


from fastapi import BackgroundTasks


@app.post("/trigger-producer")
async def trigger_producer(background_tasks: BackgroundTasks):
    """Manual trigger to stream demo customers into Kafka."""
    background_tasks.add_task(run_producer)
    return {"status": "success", "note": "Producer started in background"}


@app.post("/ingest")
async def ingest_record(request: Request):
    """Unified ingestion endpoint for high-performance stream processing."""
    try:
        record = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    customer_id = record.get("customer_id")

    # 1. Persist observation to database (DB persistence only)
    try:
        from pipeline.consumer import insert_into_db
        from fastapi.concurrency import run_in_threadpool

        await run_in_threadpool(insert_into_db, record)
        print(f"[Ingest] Stored to DB: {customer_id}")
    except Exception as e:
        print(f"[Ingest Error] DB persist failed: {e}")
        raise HTTPException(status_code=500, detail=f"DB persist failed: {e}")

    # 2. Notify SSE clients via Redis pub/sub
    try:
        from db.redis_client import publish_update

        publish_update()
    except Exception as e:
        print(f"[Ingest] Redis publish failed: {e}")

    return {
        "status": "stored",
        "customer_id": customer_id,
    }


@app.get("/audit")
def get_all_audit():
    return get_audit_log()


@app.get("/audit/{customer_id}")
def get_customer_audit(customer_id: str):
    return get_audit_log(customer_id)


@app.get("/stream")
async def stream_risk():
    """Server-Sent Events using Redis pub/sub - no polling, instant updates."""
    from fastapi.concurrency import run_in_threadpool
    from db.redis_client import subscribe_updates

    async def event_generator():
        pubsub = subscribe_updates()
        last_data = None

        try:
            while True:
                try:
                    message = await asyncio.to_thread(
                        pubsub.get_message, timeout=30, ignore_subscribe_messages=True
                    )
                except Exception as e:
                    print(f"[SSE] Redis error: {e}")
                    yield f"data: {json.dumps({'type': 'ping'})}\n\n"
                    continue

                if message and message["type"] == "message":
                    try:
                        data = message["data"]
                        # Check if data is a JSON dict (granular event) or just "refresh"
                        is_granular = False
                        try:
                            decoded = json.loads(data)
                            if isinstance(decoded, dict):
                                is_granular = True
                                yield f"data: {data}\n\n"
                        except:
                            pass

                        if not is_granular:
                            total_events = await run_in_threadpool(get_total_events)
                            customers = await run_in_threadpool(
                                get_all_customers_with_risk
                            )
                            payload = {
                                "customers": customers,
                                "total_events": total_events,
                            }

                            if payload != last_data:
                                yield f"data: {json.dumps(payload, default=str)}\n\n"
                                last_data = payload
                    except Exception as e:
                        print(f"[SSE] Processing error: {e}")
                else:
                    yield f"data: {json.dumps({'type': 'ping'})}\n\n"

        finally:
            pubsub.close()

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.get("/health")
def health():
    from app.ml_engine import _ensemble_model

    return {
        "status": "ok",
        "kafka": "external",
        "graph": "loaded",
        "model": "ensemble-2.0.0" if _ensemble_model is not None else "mock-1.0.0",
    }


@app.get("/journey-stream/{customer_id}")
async def journey_stream(customer_id: str):
    from fastapi.concurrency import run_in_threadpool

    async def event_generator():
        try:
            customer = await run_in_threadpool(get_customer_full_profile, customer_id)
            if not customer:
                yield f"data: {json.dumps({'type': 'error', 'message': 'Customer not found'})}\n\n"
                return

            yield f"data: {json.dumps({'type': 'customer', 'data': customer}, default=str)}\n\n"

            rows = await run_in_threadpool(get_weekly_observations_live, customer_id)
            if not rows:
                yield f"data: {json.dumps({'type': 'error', 'message': 'No weekly data found for this customer'})}\n\n"
                return

            intervention_needed = False
            last_breach_ml_result = None
            seen_weeks = set()

            for kafka_message in rows:
                week_key = kafka_message["observation_week"]
                if week_key in seen_weeks:
                    continue
                seen_weeks.add(week_key)

                ml_result = await run_in_threadpool(predict, kafka_message)

                risk_score = ml_result["risk_score"]
                risk_level = ml_result["risk_level"]
                shap_factors = ml_result["shap_factors"]
                top_shap = shap_factors[0] if shap_factors else {}

                week_event = {
                    "type": "week",
                    "week": week_key,
                    "week_number": len(seen_weeks),
                    "score": round(risk_score, 4),
                    "lgb_p": round(ml_result.get("lgb_p", risk_score), 4),
                    "gru_p": round(ml_result.get("gru_p", risk_score), 4),
                    "risk_level": risk_level,
                    "shap_factors": shap_factors[:3],
                    "top_factor": top_shap.get("feature"),
                    "top_factor_direction": top_shap.get("direction"),
                    "top_factor_value": top_shap.get("value"),
                    "threshold_crossed": risk_score >= 0.70,
                    "signals": {
                        "salary_delay_days": kafka_message.get("salary_delay_days", 0),
                        "auto_debit_failures": kafka_message.get(
                            "auto_debit_failures", 0
                        ),
                        "avg_daily_balance_inr": kafka_message.get(
                            "avg_daily_balance_inr", 0
                        ),
                        "emi_bounced_flag": kafka_message.get(
                            "emi_bounced_flag", False
                        ),
                    },
                }
                yield f"data: {json.dumps(week_event, default=str)}\n\n"
                await asyncio.sleep(2)

                if risk_score >= 0.70:
                    intervention_needed = True
                    last_breach_ml_result = ml_result

                # Yield a periodic ping to keep connection alive
                yield f"data: {json.dumps({'type': 'ping'})}\n\n"

            if intervention_needed and last_breach_ml_result:
                initial_state: Main_context = {
                    "prediction_id": last_breach_ml_result["prediction_id"],
                    "observation_week": last_breach_ml_result["observation_week"],
                    "total_risk_score": last_breach_ml_result["risk_score"],
                    "risk_level": last_breach_ml_result["risk_level"],
                    "Shap": last_breach_ml_result["shap_factors"],
                    "Customer_profile": last_breach_ml_result["customer_profile"],
                    "Stress_context": {},
                    "eligible_interventions": [],
                    "hard_stop": False,
                    "hard_stop_reason": None,
                    "Message_Tone": "",
                    "Message_content": "",
                    "Intervention_method": "",
                    "Intervention_justification": "",
                    "selected_channel": None,
                    "channel_dispatch_result": None,
                    "voice_payload": None,
                    "voice_result": None,
                }

                try:
                    result = await run_in_threadpool(graph.invoke, initial_state)
                    intervention_method = result.get("Intervention_method")
                    message_content = result.get("Message_content")
                    if intervention_method == "monitor_only" and not message_content:
                        message_content = "No intervention required. Monitoring only."

                    intervention_event = {
                        "type": "intervention",
                        "week": last_breach_ml_result["observation_week"],
                        "week_number": len(seen_weeks),
                        "score": round(result.get("total_risk_score", 0), 4),
                        "risk_level": result.get("risk_level"),
                        "method": intervention_method,
                        "channel": result.get("channel"),
                        "message": message_content,
                        "pending_id": result.get("pending_id"),
                        "needs_approval": result.get("needs_approval", False),
                        "status": "pending_approval",
                        "hard_stop": result.get("hard_stop"),
                        "hard_stop_reason": result.get("hard_stop_reason"),
                    }
                    yield f"data: {json.dumps(intervention_event, default=str)}\n\n"
                    yield f"data: {json.dumps({'type': 'complete', 'triggered': True})}\n\n"
                except Exception as e:
                    yield f"data: {json.dumps({'type': 'error', 'message': f'Agent failed: {str(e)}'})}\n\n"
            else:
                yield f"data: {json.dumps({'type': 'complete', 'triggered': False})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ===== PENDING APPROVALS ENDPOINTS =====


@app.get("/pending-approvals")
def list_pending_approvals(risk_level: str = None, status: str = "PENDING"):
    """
    Get all pending interventions for approval queue.
    Used by frontend to show pending items.
    """
    pending = get_pending_interventions(risk_level=risk_level, status=status)
    summary = get_pending_summary()
    return {"pending": pending, "summary": summary}


@app.get("/pending-approvals/summary")
def get_approval_summary():
    """
    Get summary of pending interventions for dashboard.
    """
    return get_pending_summary()


@app.get("/pending-approvals/{pending_id}")
def get_pending_detail(pending_id: int):
    """
    Get full details of a single pending intervention.
    Used by frontend to show preview before approval.
    """
    pending = get_pending_intervention_by_id(pending_id)
    if not pending:
        raise HTTPException(status_code=404, detail="Pending intervention not found")
    return pending


@app.post("/pending-approvals/{pending_id}/approve")
async def approve_intervention(pending_id: int, request: Request):
    """
    Approve a pending intervention.
    For voice: marks as APPROVED and returns should_stream=true for frontend to start live call.
    For other channels: executes immediately and returns result.

    SAFETY: Double execution prevention built into the query.
    """
    try:
        body = await request.json() if request.method == "POST" else {}
    except Exception:
        body = {}

    approved_by = body.get("approved_by", "manager")

    # First approve (mark as approved, ready for execution)
    approve_result = approve_pending_intervention(pending_id, approved_by)

    if "error" in approve_result:
        return approve_result

    # Get pending details for execution
    pending = get_pending_intervention_by_id(pending_id)
    if not pending:
        return {"error": "Pending intervention not found"}

    # For voice channel: don't execute here, let frontend redirect to live call page
    if pending.get("channel") == "voice":
        return {
            "status": "APPROVED",
            "pending_id": pending_id,
            "customer_id": pending["customer_id"],
            "channel": pending["channel"],
            "intervention_method": pending["intervention_method"],
            "should_stream": True,
            "approved_by": approved_by,
        }

    # Execute based on channel (email, whatsapp, etc.)
    from app.executor import execute_intervention

    try:
        execution_result = execute_intervention(pending)

        # Mark as executed
        mark_intervention_executed(pending_id, execution_result)

        print(f"[APPROVE] Executed {pending['channel']} for {pending['customer_id']}")

        return {
            "status": "EXECUTED",
            "pending_id": pending_id,
            "customer_id": pending["customer_id"],
            "channel": pending["channel"],
            "intervention_method": pending["intervention_method"],
            "execution_result": execution_result,
            "approved_by": approved_by,
        }
    except Exception as e:
        print(f"[APPROVE] Execution failed: {e}")
        return {
            "status": "APPROVED_BUT_EXECUTION_FAILED",
            "pending_id": pending_id,
            "error": str(e),
            "approved_by": approved_by,
        }


@app.post("/pending-approvals/{pending_id}/reject")
async def reject_intervention(pending_id: int, request: Request):
    """
    Reject a pending intervention.
    Logs the rejection reason.
    """
    try:
        body = await request.json() if request.method == "POST" else {}
    except Exception:
        body = {}

    rejected_by = body.get("rejected_by", "manager")
    rejection_reason = body.get("rejection_reason", "Rejected by manager")

    result = reject_pending_intervention(pending_id, rejected_by, rejection_reason)

    if "error" in result:
        return result

    print(
        f"[REJECT] Rejected pending_id={pending_id} by {rejected_by}: {rejection_reason}"
    )

    return {
        "status": "REJECTED",
        "pending_id": pending_id,
        "rejected_by": rejected_by,
        "reason": rejection_reason,
    }


# ===== BEHAVIOURAL FEATURE INFERENCE ENDPOINTS =====


@app.post("/behaviour/classify")
async def classify_single_transaction(request: Request):
    """Classify a single transaction"""
    from txn_intelligence.engine import classify_transaction

    try:
        body = await request.json()
    except Exception:
        body = {}

    merchant = body.get("merchant", "")
    amount = body.get("amount")
    mcc = body.get("mcc")

    result = classify_transaction(merchant, amount, mcc)
    return result


@app.post("/behaviour/batch")
async def classify_batch_transactions(request: Request):
    """Classify multiple transactions and aggregate features"""
    from txn_intelligence.engine import process_customer_transactions

    try:
        body = await request.json()
    except Exception:
        body = {}

    customer_id = body.get("customer_id", "unknown")
    transactions = body.get("transactions", [])

    result = process_customer_transactions(customer_id, transactions)
    return result


@app.get("/behaviour/sample")
async def get_sample_transactions():
    """Get sample transactions for demo"""
    from txn_intelligence.engine import SAMPLE_TRANSACTIONS

    return {"transactions": SAMPLE_TRANSACTIONS}


@app.get("/behaviour/sample-12weeks")
async def get_sample_12_weeks():
    """Get sample transactions for demo (backward compatibility)"""
    from txn_intelligence.engine import SAMPLE_12_WEEKS

    return {"transactions_by_week": SAMPLE_12_WEEKS}


@app.get("/behaviour/profiles")
async def get_sample_profiles():
    """Get available sample customer profiles"""
    from txn_intelligence.engine import get_sample_profiles

    return {"profiles": get_sample_profiles()}


@app.post("/behaviour/analyze-profile")
async def analyze_profile(request: Request):
    """Analyze a specific profile by key"""
    from txn_intelligence.engine import (
        get_profile_transactions,
        classify_transaction,
        aggregate_12_weeks,
    )

    try:
        body = await request.json()
    except Exception:
        body = {}

    profile_key = body.get("profile_key", "")

    transactions_by_week = get_profile_transactions(profile_key)

    if not transactions_by_week:
        return {"error": "Profile not found"}

    # Classify all transactions first
    classified_by_week = {}
    for week, txns in transactions_by_week.items():
        classified_txns = []
        for txn in txns:
            result = classify_transaction(
                merchant=txn.get("merchant", ""),
                amount=txn.get("amount", 0) or 0,
                mcc=txn.get("mcc"),
            )
            classified_txns.append(
                {
                    "merchant": txn.get("merchant", ""),
                    "amount": txn.get("amount", 0) or 0,
                    **result,
                }
            )
        classified_by_week[week] = classified_txns

    # Aggregate and get trends
    result = aggregate_12_weeks(classified_by_week)

    return {"profile_key": profile_key, **result}


@app.post("/behaviour/analyze-12weeks")
async def analyze_12_weeks(request: Request):
    """Analyze 12 weeks of transactions with trends and insights"""
    from txn_intelligence.engine import aggregate_12_weeks, classify_transaction

    try:
        body = await request.json()
    except Exception:
        body = {}

    transactions_by_week = body.get("transactions_by_week", {})
    customer_id = body.get("customer_id", "unknown")

    # Classify all transactions first
    classified_by_week = {}
    for week, txns in transactions_by_week.items():
        classified_txns = []
        for txn in txns:
            result = classify_transaction(
                merchant=txn.get("merchant", ""),
                amount=txn.get("amount", 0) or 0,
                mcc=txn.get("mcc"),
            )
            classified_txns.append(
                {
                    "merchant": txn.get("merchant", ""),
                    "amount": txn.get("amount", 0) or 0,
                    **result,
                }
            )
        classified_by_week[week] = classified_txns

    # Aggregate and get trends
    result = aggregate_12_weeks(classified_by_week)

    return {"customer_id": customer_id, **result}
