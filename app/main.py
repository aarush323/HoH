import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from graph import build_graph
from graph.state import Main_context
from app.ml_engine import score_from_kafka, get_risk_level
from db.queries import store_ml_prediction
import logging

logger = logging.getLogger(__name__)

def _mock_score_fallback(kafka_message: dict) -> tuple:
    import random
    customer_id = kafka_message["customer_id"]
    random.seed(str(customer_id) + str(kafka_message["observation_week"]))
    
    salary_delay     = kafka_message.get("salary_delay_days", 0)
    auto_debit_fail  = kafka_message.get("auto_debit_failures", 0)
    savings_drawdown = kafka_message.get("savings_drawdown_pct", 0.0)
    utility_delay    = kafka_message.get("utility_payment_delay_days", 0)

    base_score = min(0.99, (
        (salary_delay / 10)          * 0.25 +
        (auto_debit_fail / 5)        * 0.30 +
        (abs(savings_drawdown) / 100)* 0.25 +
        (utility_delay / 10)         * 0.20
    ))
    noise      = random.uniform(-0.05, 0.05)
    risk_score = round(min(0.99, max(0.01, base_score + noise)), 4)

    def shap_contrib(value, max_val, base_range):
        intensity = min(1.0, abs(value) / max_val) if max_val else 0
        return round(
            random.uniform(base_range[0], base_range[1]) * max(intensity, 0.1), 4
        )

    all_signals = [
        {"feature": "salary_delay_days", "value": salary_delay, "contribution": shap_contrib(salary_delay, 10, (0.10, 0.22)), "direction": "+" if salary_delay > 0 else "-", "stress_hint": "income"},
        {"feature": "savings_drawdown_pct", "value": savings_drawdown, "contribution": shap_contrib(savings_drawdown, 100, (0.08, 0.18)), "direction": "+" if savings_drawdown < 0 else "-", "stress_hint": "income"},
        {"feature": "auto_debit_failures", "value": auto_debit_fail, "contribution": shap_contrib(auto_debit_fail, 5, (0.12, 0.25)), "direction": "+" if auto_debit_fail > 0 else "-", "stress_hint": "structural"},
        {"feature": "utility_payment_delay_days", "value": utility_delay, "contribution": shap_contrib(utility_delay, 10, (0.06, 0.14)), "direction": "+" if utility_delay > 0 else "-", "stress_hint": "structural"},
        {"feature": "upi_to_lending_apps_count", "value": kafka_message.get("upi_to_lending_apps_count", 0), "contribution": shap_contrib(kafka_message.get("upi_to_lending_apps_count", 0), 10, (0.10, 0.20)), "direction": "+" if kafka_message.get("upi_to_lending_apps_count", 0) > 0 else "-", "stress_hint": "debt"},
        {"feature": "gambling_lottery_spend_inr", "value": kafka_message.get("gambling_lottery_spend_inr", 0), "contribution": shap_contrib(kafka_message.get("gambling_lottery_spend_inr", 0), 5000, (0.08, 0.16)), "direction": "+" if kafka_message.get("gambling_lottery_spend_inr", 0) > 0 else "-", "stress_hint": "overspending"},
        {"feature": "discretionary_vs_4w_avg_pct", "value": kafka_message.get("discretionary_vs_4w_avg_pct", 0), "contribution": shap_contrib(kafka_message.get("discretionary_vs_4w_avg_pct", 0), 100, (0.07, 0.15)), "direction": "+" if kafka_message.get("discretionary_vs_4w_avg_pct", 0) > 20 else "-", "stress_hint": "overspending"},
        {"feature": "credit_card_utilization_pct", "value": kafka_message.get("credit_card_utilization_pct", 0), "contribution": shap_contrib(kafka_message.get("credit_card_utilization_pct", 0), 100, (0.09, 0.18)), "direction": "+" if kafka_message.get("credit_card_utilization_pct", 0) > 70 else "-", "stress_hint": "debt"},
    ]

    elevated = [s for s in all_signals if abs(s["value"]) > 0]
    elevated_sorted = sorted(elevated, key=lambda x: x["contribution"], reverse=True)
    shap_factors = [{k: v for k, v in s.items() if k != "stress_hint"}
                    for s in elevated_sorted[:4]]
    
    return risk_score, shap_factors

def predict(kafka_message: dict) -> dict:
    import random
    from datetime import datetime

    customer_id = kafka_message["customer_id"]

    try:
        risk_score, shap_factors = score_from_kafka(kafka_message)
        _used_real_model = True
    except Exception as e:
        logger.warning(f"[ML] Real model failed for {customer_id}, using mock: {e}")
        risk_score, shap_factors = _mock_score_fallback(kafka_message)
        _used_real_model = False

    risk_level = get_risk_level(risk_score)

    customer_profile = {
        "customer_id":             customer_id,
        "name":                    f"Customer {customer_id}",
        "tenure_months":           float(kafka_message.get("account_vintage_months", 12)),
        "loan_type":               kafka_message.get("product_type", "Personal Loan"),
        "loan_amount":             450000.00,
        "relationship_value":      "High" if kafka_message.get("customer_segment") == "Premium" else "Medium",
        "fraud_flag":              False,
        "existing_restructuring":  False,
        "previous_payment_holiday":False,
        "legal_npa_flag":          False,
        "kyc_lapsed":              False,
    }

    # ── HARDCODED DEMO DATA FOR SPECIFIC CUSTOMERS ──
    if customer_id == "C00011":
        customer_profile.update({
            "tenure_months": 36,
            "relationship_value": "Medium",
            "loan_amount": 850000,
            "loan_type": "Home Loan"
        })

    elif customer_id == "C00078":
        customer_profile.update({
            "tenure_months": 36,
            "relationship_value": "Medium",
            "loan_amount": 120000,
            "loan_type": "Personal Loan"
        })

    elif customer_id == "C00002":
        customer_profile.update({
            "tenure_months": 24,
            "relationship_value": "Medium",
            "loan_amount": 60000,
            "loan_type": "Credit Card"
        })
    # ────────────────────────────────────────────────

    # --- PHASE 3: Store prediction in DB ---
    prediction_payload = {
        "customer_id":      customer_id,
        "observation_week": kafka_message["observation_week"],
        "risk_score":       risk_score,
        "risk_level":       risk_level,
        "shap_factors":     shap_factors,
        "model_version":    "ensemble-2.0.0" if _used_real_model else "mock-1.0.0"
    }
    
    try:
        prediction_id = store_ml_prediction(prediction_payload)
    except Exception as e:
        logger.error(f"[ML] Failed to store prediction for {customer_id}: {e}")
        prediction_id = 999999  # Fallback for demo stability
    # --------------------------------------

    return {
        "customer_id":    customer_id,
        "prediction_id":  prediction_id,
        "observation_week": kafka_message["observation_week"],
        "risk_score":     risk_score,
        "risk_level":     risk_level,
        "shap_factors":   shap_factors,
        "customer_profile": customer_profile,
        "timestamp":      datetime.utcnow().isoformat(),
        "model_version":  prediction_payload["model_version"],
    }


def Agent_pipeline():
    graph = build_graph()

    # Mock kafka message for standalone testing
    mock_kafka_msg = {
        "customer_id": "C00032",
        "observation_week": "2026-03-20",
        "salary_delay_days": 6,
        "savings_drawdown_pct": -38.5,
        "auto_debit_failures": 2,
        "utility_payment_delay_days": 4,
        "account_vintage_months": 24,
        "product_type": "Personal Loan",
        "customer_segment": "Premium",
    }
    data = predict(mock_kafka_msg)

    initial_state: Main_context = {
        "prediction_id": data["prediction_id"],
        "observation_week": data["observation_week"],
        "total_risk_score": data["risk_score"],
        "risk_level": data["risk_level"],
        "Shap": data["shap_factors"],
        "Customer_profile": data["customer_profile"],
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

    result = graph.invoke(initial_state)

    print("\n========== AGENT PIPELINE RESULTS ==========")
    print(f"\nRISK SCORE: {result['total_risk_score']} | LEVEL: {result['risk_level']}")

    print("\n--- AGENT 1: STRESS ANALYSIS ---")
    print(f"Narrative: {result['Stress_context']['narrative']}")
    print(f"Stress Type: {result['Stress_context']['stress_type']}")
    print(f"Severity: {result['Stress_context']['severity']}")

    print("\n--- AGENT 2: COMPLIANCE ---")
    print(f"Hard Stop: {result['hard_stop']}")
    print(f"Hard Stop Reason: {result['hard_stop_reason']}")
    print(f"Eligible Interventions: {result['eligible_interventions']}")

    print("\n--- AGENT 3: INTERVENTION ---")
    print(f"Method: {result['Intervention_method']}")
    print(f"Justification: {result['Intervention_justification']}")
    print(f"Message Tone: {result['Message_Tone']}")
    print(f"Message: {result['Message_content']}")

    print("\n--- CHANNEL DISPATCH ---")
    print(f"Selected Channel: {result.get('selected_channel', 'not set')}")
    dispatch = result.get("channel_dispatch_result", {})
    if dispatch:
        if "sms" in dispatch:
            print(f"SMS: {dispatch['sms']}")
        if "whatsapp" in dispatch:
            print(f"WhatsApp: {dispatch['whatsapp']}")
        if "email_subject" in dispatch:
            print(f"Email Subject: {dispatch['email_subject']}")
            print(f"Email Body: {dispatch['email_body']}")

    voice_res = result.get("voice_result")
    if voice_res:
        print("\n--- VOICE AGENT: CALL RESULT ---")
        print(f"Outcome: {voice_res.get('outcome')}")
        print(f"Escalate: {voice_res.get('escalate')} (Reason: {voice_res.get('escalate_reason')})")
        print(f"Turns Taken: {voice_res.get('turns_taken')}")

        print("\nCall Memory:")
        mem = voice_res.get("call_memory", {})
        print(f"  - Intent History: {mem.get('intent_history')}")
        print(f"  - Sentiment Trajectory: {mem.get('sentiment_trajectory')}")
        print(f"  - Offer Accepted: {mem.get('offer_accepted')}")
        print(f"  - Topics Raised: {mem.get('topics_raised')}")

    print("\n============================================\n")


if __name__ == "__main__":
    print("starting")
    Agent_pipeline()