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
)
from db.postgres import create_tables_if_not_exist, get_connection
from sqlalchemy import text
from db.redis_client import get_cached_risk_score, cache_risk_score
import json
import asyncio

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
def get_voice_customers():
    """Returns customers who received voice interventions."""
    return get_voice_customers()


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
        return {"status": "success", "customer_id": customer_id}
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
                        total_events = await run_in_threadpool(get_total_events)
                        customers = await run_in_threadpool(get_all_customers_with_risk)
                        payload = {"customers": customers, "total_events": total_events}

                        if payload != last_data:
                            yield f"data: {json.dumps(payload, default=str)}\n\n"
                            last_data = payload
                    except Exception as e:
                        print(f"[SSE] DB query error: {e}")
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
                    voice_result = result.get("voice_result") or {}
                    call_memory = voice_result.get("call_memory") or {}
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
                        "channel": result.get("selected_channel"),
                        "message": message_content,
                        "voice_outcome": voice_result.get("outcome"),
                        "offer_accepted": call_memory.get("offer_accepted"),
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
