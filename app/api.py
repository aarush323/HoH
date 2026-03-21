import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from graph import build_graph
from graph.state import Main_context
from app.main import predict
from db.queries import (
    get_all_customers_with_risk,
    get_customer_full_profile,
    get_latest_as_kafka_message,
    get_intervention_history,
    get_audit_log,
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

    voice_result = result.get("voice_result") or {}
    call_memory  = voice_result.get("call_memory") or {}

    return {
        "customer_id":         customer_id,
        "risk_score":          result["total_risk_score"],
        "risk_level":          result["risk_level"],
        "hard_stop":           result["hard_stop"],
        "hard_stop_reason":    result["hard_stop_reason"],
        "intervention_method": result["Intervention_method"],
        "selected_channel":    result.get("selected_channel"),
        "message_content":     result["Message_content"],
        "voice_outcome":       voice_result.get("outcome"),
        "offer_accepted":      call_memory.get("offer_accepted"),
        "turns_taken":         voice_result.get("turns_taken"),
    }


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


@app.get("/audit")
def get_all_audit():
    return get_audit_log()

@app.get("/audit/{customer_id}")
def get_customer_audit(customer_id: str):
    return get_audit_log(customer_id)


@app.get("/stream")
async def stream_risk():
    async def event_generator():
        while True:
            try:
                customers = get_all_customers_with_risk()
                yield f"data: {json.dumps(customers, default=str)}\n\n"
            except Exception as e:
                yield f"data: {json.dumps({'error': str(e)})}\n\n"
            await asyncio.sleep(3)
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