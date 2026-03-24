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
    get_customer_full_profile,
    get_latest_as_kafka_message,
    get_intervention_history,
    get_audit_log,
    get_weekly_observations_live,
)
from db.postgres import create_tables_if_not_exist
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
        "risk_score":       ml["risk_score"],
        "risk_level":       ml["risk_level"],
        "shap_factors":     ml["shap_factors"],
        "observation_week": ml["observation_week"],
        "model_version":    ml["model_version"],
    }
    cache_risk_score(customer_id, score_data)
    return {"customer_id": customer_id, "source": "computed", **score_data}


@app.post("/intervene/{customer_id}")
async def intervene(customer_id: str, request: Request):
    try:
        body = await request.json()
    except Exception:
        body = {}

    if "kafka_message" in body:
        # Auto-triggered by consumer — raw signals passed directly
        kafka_message = body["kafka_message"]
    else:
        # Manual trigger — fetch latest signals from DB
        kafka_message = get_latest_as_kafka_message(customer_id)
        if not kafka_message:
            raise HTTPException(status_code=404, detail="Customer not found in DB")

    ml_result = predict(kafka_message)

    initial_state: Main_context = {
        "prediction_id":              ml_result["prediction_id"],
        "observation_week":           ml_result["observation_week"],
        "total_risk_score":           ml_result["risk_score"],
        "risk_level":                 ml_result["risk_level"],
        "Shap":                       ml_result["shap_factors"],
        "Customer_profile":           ml_result["customer_profile"],
        "Stress_context":             {},
        "eligible_interventions":     [],
        "hard_stop":                  False,
        "hard_stop_reason":           None,
        "Message_Tone":               "",
        "Message_content":            "",
        "Intervention_method":        "",
        "Intervention_justification": "",
        "selected_channel":           None,
        "channel_dispatch_result":    None,
        "voice_payload":              None,
        "voice_result":               None,
    }

    try:
        result = graph.invoke(initial_state)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent pipeline failed: {str(e)}")

    try:
        print("DEBUG - RESULT:", result)

        voice_result = result.get("voice_result")
        if not isinstance(voice_result, dict):
            voice_result = {}

        call_memory = voice_result.get("call_memory")
        if not isinstance(call_memory, dict):
            call_memory = {}

        intervention_method = result.get("Intervention_method")
        message_content = result.get("Message_content")

        # Handle monitor_only specifically for cleaner response
        if intervention_method == "monitor_only" and not message_content:
            message_content = "No intervention required. Monitoring only."

        return {
            "customer_id":         customer_id,
            "risk_score":          result.get("total_risk_score"),
            "risk_level":          result.get("risk_level"),
            "hard_stop":           result.get("hard_stop"),
            "hard_stop_reason":    result.get("hard_stop_reason"),
            "intervention_method": intervention_method,
            "selected_channel":    result.get("selected_channel"),
            "message_content":     message_content,
            "voice_outcome":       voice_result.get("outcome"),
            "offer_accepted":      call_memory.get("offer_accepted"),
            "turns_taken":         voice_result.get("turns_taken"),
        }
    except Exception as e:
        import traceback
        print("CRITICAL ERROR IN API RETURN BLOCK:")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"API error: {str(e)}")


@app.get("/outreach/{customer_id}")
def get_outreach(customer_id: str):
    results = get_intervention_history(customer_id)
    if not results:
        raise HTTPException(status_code=404, detail="No interventions found for this customer")
    latest = results[0]
    return {
        "customer_id":    customer_id,
        "message_content": latest.get("message_content"),
        "selected_channel": latest.get("selected_channel"),
        "created_at":     str(latest.get("created_at")),
    }


RULES = {
    "thresholds": {
        "salary_delay_days":          3,
        "auto_debit_failures":        2,
        "savings_drawdown_pct":       -20.0,
        "utility_payment_delay_days": 3,
    },
    "score_weights": {
        "salary_delay_days":          0.25,
        "auto_debit_failures":        0.30,
        "savings_drawdown_pct":       0.25,
        "utility_payment_delay_days": 0.20,
    },
    "risk_levels": {"High": 0.70, "Medium": 0.40},
}

@app.get("/rules")
def get_rules():
    return RULES

@app.put("/rules")
async def update_rules(request: Request):
    return {"status": "noted", "note": "Rule updates apply when ML model is connected"}


@app.post("/trigger-producer")
def trigger_producer():
    """Manual trigger to stream demo customers into Kafka."""
    count = run_producer()
    return {"status": "success", "messages_sent": count}


@app.get("/audit")
def get_all_audit():
    return get_audit_log()

@app.get("/audit/{customer_id}")
def get_customer_audit(customer_id: str):
    return get_audit_log(customer_id)


@app.get("/stream")
async def stream_risk():
    """Server-Sent Events stream for live risk updates."""
    from fastapi.concurrency import run_in_threadpool
    
    async def event_generator():
        while True:
            try:
                # Use run_in_threadpool to offload blocking DB query
                customers = await run_in_threadpool(get_all_customers_with_risk)
                # print(f"[SSE] Sending {len(customers)} customers") # Debugging log
                yield f"data: {json.dumps(customers, default=str)}\n\n"
            except Exception as e:
                print(f"[SSE Error] {e}")
                yield f"data: {json.dumps({'error': str(e)})}\n\n"
            await asyncio.sleep(2)
            
    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.get("/health")
def health():
    from app.ml_engine import _ensemble_model
    return {
        "status":  "ok",
        "kafka":   "external",
        "graph":   "loaded",
        "model":   "ensemble-2.0.0" if _ensemble_model is not None else "mock-1.0.0",
    }


@app.get("/journey-stream/{customer_id}")
async def journey_stream(customer_id: str):
    from fastapi.concurrency import run_in_threadpool

    async def event_generator():
        try:
            # First verify customer exists
            customer = await run_in_threadpool(
                get_customer_full_profile, customer_id
            )
            if not customer:
                yield f"data: {json.dumps({'type': 'error', 'message': 'Customer not found'})}\n\n"
                return

            # Send customer info so frontend can populate header
            yield f"data: {json.dumps({'type': 'customer', 'data': customer}, default=str)}\n\n"

            seen_weeks = set()        # track which weeks already streamed
            intervention_sent = False
            empty_polls = 0
            MAX_EMPTY_POLLS = 60      # 120 seconds max wait (60 * 2s)
            
            intervention_needed = False
            last_breach_ml_result = None

            while True:
                # Poll DB for weekly_features rows written by consumer
                rows = await run_in_threadpool(
                    get_weekly_observations_live, customer_id
                )

                # Only process weeks we haven't seen yet
                new_rows = [
                    r for r in rows
                    if r["observation_week"] not in seen_weeks
                ]

                if new_rows:
                    empty_polls = 0

                    for kafka_message in new_rows:
                        week_key = kafka_message["observation_week"]
                        seen_weeks.add(week_key)

                        # Run ML on this week's data — same as /intervene
                        ml_result = await run_in_threadpool(predict, kafka_message)

                        risk_score   = ml_result["risk_score"]
                        risk_level   = ml_result["risk_level"]
                        shap_factors = ml_result["shap_factors"]
                        top_shap     = shap_factors[0] if shap_factors else {}

                        week_event = {
                            "type":                  "week",
                            "week":                  week_key,
                            "week_number":           len(seen_weeks),
                            "score":                 round(risk_score, 4),
                            "risk_level":            risk_level,
                            "shap_factors":          shap_factors[:3],
                            "top_factor":            top_shap.get("feature"),
                            "top_factor_direction":  top_shap.get("direction"),
                            "top_factor_value":      top_shap.get("value"),
                            "threshold_crossed":     risk_score >= 0.70,
                            "signals": {
                                "salary_delay_days":      kafka_message.get("salary_delay_days", 0),
                                "auto_debit_failures":    kafka_message.get("auto_debit_failures", 0),
                                "avg_daily_balance_inr":  kafka_message.get("avg_daily_balance_inr", 0),
                                "emi_bounced_flag":       kafka_message.get("emi_bounced_flag", False),
                            }
                        }
                        yield f"data: {json.dumps(week_event, default=str)}\n\n"
                        await asyncio.sleep(2)  # Delay to ensure week-by-week playback in frontend

                        if risk_score >= 0.70:
                            intervention_needed = True
                            last_breach_ml_result = ml_result

                        # If we have reached week 12, end the stream and trigger agent if needed
                        if len(seen_weeks) >= 12:
                            if intervention_needed and last_breach_ml_result and not intervention_sent:
                                intervention_sent = True

                                initial_state: Main_context = {
                                    "prediction_id":              last_breach_ml_result["prediction_id"],
                                    "observation_week":           last_breach_ml_result["observation_week"],
                                    "total_risk_score":           last_breach_ml_result["risk_score"],
                                    "risk_level":                 last_breach_ml_result["risk_level"],
                                    "Shap":                       last_breach_ml_result["shap_factors"],
                                    "Customer_profile":           last_breach_ml_result["customer_profile"],
                                    "Stress_context":             {},
                                    "eligible_interventions":     [],
                                    "hard_stop":                  False,
                                    "hard_stop_reason":           None,
                                    "Message_Tone":               "",
                                    "Message_content":            "",
                                    "Intervention_method":        "",
                                    "Intervention_justification": "",
                                    "selected_channel":           None,
                                    "channel_dispatch_result":    None,
                                    "voice_payload":              None,
                                    "voice_result":               None,
                                }

                                try:
                                    result = await run_in_threadpool(graph.invoke, initial_state)
                                    voice_result = result.get("voice_result")
                                    if not isinstance(voice_result, dict):
                                        voice_result = {}

                                    call_memory = voice_result.get("call_memory")
                                    if not isinstance(call_memory, dict):
                                        call_memory = {}

                                    intervention_method = result.get("Intervention_method")
                                    message_content = result.get("Message_content")
                                    if intervention_method == "monitor_only" and not message_content:
                                        message_content = "No intervention required. Monitoring only."

                                    intervention_event = {
                                        "type":          "intervention",
                                        "week":          week_key,
                                        "week_number":   len(seen_weeks),
                                        "score":         round(result.get("total_risk_score", 0), 4),
                                        "risk_level":    result.get("risk_level"),
                                        "method":        intervention_method,
                                        "channel":       result.get("selected_channel"),
                                        "message":       message_content,
                                        "voice_outcome": voice_result.get("outcome"),
                                        "offer_accepted":call_memory.get("offer_accepted"),
                                        "hard_stop":     result.get("hard_stop"),
                                        "hard_stop_reason": result.get("hard_stop_reason"),
                                    }
                                    yield f"data: {json.dumps(intervention_event, default=str)}\n\n"
                                    yield f"data: {json.dumps({'type': 'complete', 'triggered': True})}\n\n"
                                    return

                                except Exception as e:
                                    yield f"data: {json.dumps({'type': 'error', 'message': f'Agent failed: {str(e)}'})}\n\n"
                                    return
                            else:
                                if not intervention_sent:
                                    yield f"data: {json.dumps({'type': 'complete', 'triggered': False})}\n\n"
                                return

                else:
                    empty_polls += 1
                    yield f"data: {json.dumps({'type': 'ping'})}\n\n"

                    # If the stream is genuinely finished (no new rows after waiting)
                    if empty_polls >= MAX_EMPTY_POLLS:
                        if intervention_needed and last_breach_ml_result and not intervention_sent:
                            intervention_sent = True

                            initial_state: Main_context = {
                                "prediction_id":              last_breach_ml_result["prediction_id"],
                                "observation_week":           last_breach_ml_result["observation_week"],
                                "total_risk_score":           last_breach_ml_result["risk_score"],
                                "risk_level":                 last_breach_ml_result["risk_level"],
                                "Shap":                       last_breach_ml_result["shap_factors"],
                                "Customer_profile":           last_breach_ml_result["customer_profile"],
                                "Stress_context":             {},
                                "eligible_interventions":     [],
                                "hard_stop":                  False,
                                "hard_stop_reason":           None,
                                "Message_Tone":               "",
                                "Message_content":            "",
                                "Intervention_method":        "",
                                "Intervention_justification": "",
                                "selected_channel":           None,
                                "channel_dispatch_result":    None,
                                "voice_payload":              None,
                                "voice_result":               None,
                            }

                            try:
                                result = await run_in_threadpool(graph.invoke, initial_state)
                                voice_result = result.get("voice_result")
                                if not isinstance(voice_result, dict):
                                    voice_result = {}

                                call_memory = voice_result.get("call_memory")
                                if not isinstance(call_memory, dict):
                                    call_memory = {}

                                intervention_method = result.get("Intervention_method")
                                message_content = result.get("Message_content")
                                if intervention_method == "monitor_only" and not message_content:
                                    message_content = "No intervention required. Monitoring only."

                                intervention_event = {
                                    "type":          "intervention",
                                    "week":          len(seen_weeks),
                                    "week_number":   len(seen_weeks),
                                    "score":         round(result.get("total_risk_score", 0), 4),
                                    "risk_level":    result.get("risk_level"),
                                    "method":        intervention_method,
                                    "channel":       result.get("selected_channel"),
                                    "message":       message_content,
                                    "voice_outcome": voice_result.get("outcome"),
                                    "offer_accepted":call_memory.get("offer_accepted"),
                                    "hard_stop":     result.get("hard_stop"),
                                    "hard_stop_reason": result.get("hard_stop_reason"),
                                }
                                yield f"data: {json.dumps(intervention_event, default=str)}\n\n"
                                yield f"data: {json.dumps({'type': 'complete', 'triggered': True})}\n\n"
                                return

                            except Exception as e:
                                yield f"data: {json.dumps({'type': 'error', 'message': f'Agent failed: {str(e)}'})}\n\n"
                                return
                        else:
                            yield f"data: {json.dumps({'type': 'complete', 'triggered': False})}\n\n"
                            return

                await asyncio.sleep(2)

        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control":    "no-cache",
            "X-Accel-Buffering": "no"
        }
    )

