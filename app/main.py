import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


from graph import build_graph

#app = FastAPI(title = "PreDelinquency Engine")


def predict(customer_id: str) -> dict:
    return {
        # Core Risk
        "customer_id": "CUS-9773",
        "risk_score": 0.89,              # float 0-1
        "risk_level": "High",            # "High" | "Medium" | "Low"
        
        # SHAP Explanation
        "shap_factors": [
            {
                "feature": "salary_delay_days",
                "value": 4,              # actual feature value
                "contribution": 0.18,    # how much it pushed score up
                "direction": "+"         # "+" hurts, "-" helps
            },
            {
                "feature": "savings_wow_delta",
                "value": -18.5,
                "contribution": 0.14,
                "direction": "+"
            },
            {
                "feature": "failed_autodebit_30d",
                "value": 3,
                "contribution": 0.09,
                "direction": "+"
            }
        ],
        
        # Customer Context
        "customer_profile": {
            "name": "Rahul Sharma",
            "tenure_months": 10,
            "loan_type": "Personal Loan",  # "Personal Loan" | "Home Loan" | "Credit Card"
            "loan_amount": 500000,
            "relationship_value": "Medium", # "High" | "Medium" | "Low"
            "existing_restructuring": False,
            "fraud_flag": False
        },
        
        # Metadata
        "timestamp": "2026-03-12T14:32:00",
        "model_version": "1.0.0"
    }

def prepare_agent3_input(state: dict) -> dict:
    # hardcoded test state so we can test agent3 independently
    state = {
        "analyst_narrative": "Customer shows temporary liquidity stress. Salary delayed 4 days combined with 18% savings depletion and 3 failed auto-debits suggests cashflow disruption. Given 24 month clean history this appears situational rather than fundamental credit risk.",
        "stress_type": "temporary",
        "stress_severity": "severe",
        "customer_profile": {
            "tenure_months": 24,
            "loan_type": "Personal Loan",
            "relationship_value": "Medium"
        },
        "risk_score": 0.89,
        "risk_level": "High",
        "compliance_result": {
            "policy_passed": True,
            "eligible_interventions": ["payment_holiday", "rm_call"]
        }
    }
    
    return {
        "stress_context": {
            "narrative": state["analyst_narrative"],
            "type": state["stress_type"],
            "severity": state["stress_severity"]
        },
        "customer_context": {
            "tenure_months": state["customer_profile"]["tenure_months"],
            "loan_type": state["customer_profile"]["loan_type"],
            "relationship_value": state["customer_profile"]["relationship_value"],
            "risk_score": state["risk_score"],
            "risk_level": state["risk_level"]
        },
        "compliance_context": {
            "policy_passed": state["compliance_result"]["policy_passed"],
            "eligible_interventions": state["compliance_result"]["eligible_interventions"]
        }
    }


def Agent_pipeline():
        graph = build_graph()
        data = predict("CUS-9773")
        initial_state: Main_context = {
            "total_risk_score" : data["risk_score"],
            "risk_level" :data["risk_level"],
            "Shap": data["shap_factors"],
            "Customer_profile": data["customer_profile"],
            "Stress_context": {},
            "Customer_context": {}
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
        
        voice_res = result.get('voice_result')
        if voice_res:
            print("\n--- VOICE AGENT: CALL RESULT ---")
            print(f"Outcome: {voice_res.get('outcome')}")
            print(f"Escalate: {voice_res.get('escalate')} (Reason: {voice_res.get('escalate_reason')})")
            print(f"Turns Taken: {voice_res.get('turns_taken')}")
            
            print("\nCall Memory:")
            mem = voice_res.get('call_memory', {})
            print(f"  - Intent History: {mem.get('intent_history')}")
            print(f"  - Sentiment Trajectory: {mem.get('sentiment_trajectory')}")
            print(f"  - Offer Accepted: {mem.get('offer_accepted')}")
            print(f"  - Topics Raised: {mem.get('topics_raised')}")
    
        print("\n============================================\n")


if __name__ == "__main__":
    print("starting")
    Agent_pipeline()