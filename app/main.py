import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from graph import build_graph
from graph.state import Main_context


def predict(customer_id: str) -> dict:
    return {
        "customer_id": customer_id,
        "prediction_id": None,
        "observation_week": "2026-03-20",
        "risk_score": 0.87,
        "risk_level": "High",
        "shap_factors": [
            {
                "feature": "salary_delay_days",
                "value": 6,
                "contribution": 0.18,
                "direction": "+"
            },
            {
                "feature": "savings_drawdown_pct",
                "value": -38.5,
                "contribution": 0.15,
                "direction": "+"
            },
            {
                "feature": "auto_debit_failures",
                "value": 2,
                "contribution": 0.11,
                "direction": "+"
            },
            {
                "feature": "utility_payment_delay_days",
                "value": 4,
                "contribution": 0.09,
                "direction": "+"
            },
        ],
        "customer_profile": {
            "customer_id": customer_id,
            "name": "Rahul Sharma",
            "tenure_months": 24.0,
            "loan_type": "Personal Loan",   # NOT Home Loan — keeps payment_holiday eligible
            "loan_amount": 450000.00,
            "relationship_value": "High",
            "fraud_flag": False,
            "existing_restructuring": False,
            "previous_payment_holiday": False,
            "legal_npa_flag": False,
            "kyc_lapsed": False,
        },
        "timestamp": "2026-03-20T14:32:00",
        "model_version": "1.0.0",
    }
def Agent_pipeline():
    graph = build_graph()
    data = predict("C00032")

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