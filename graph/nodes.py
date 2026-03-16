#from app.main import predict, prepare_agent3_input
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


from .state import Main_context
import json
from app.llm import get_llm
from voice_agent.agent import run_call


def clean_json(content: str) -> dict:
    content = content.strip()
    if content.startswith("```"):
        content = content.split("```")[1]
        if content.startswith("json"):
            content = content[4:]
    content = content.strip()
    return json.loads(content)



def analyst_node(state: Main_context):
    shap =state["Shap"]
    risk_score = state["total_risk_score"]
    risk_level = state["risk_level"]


    shap_text = ""

    for sha in shap:
        shap_text+=f"{sha['feature']}: {sha['value']} , weightage: {sha['contribution']}, direction: {sha['direction']}"
        shap_text += "\n"


    prompt = f""" you are a Stress Analyst working on Delinquency prediction ML data. 
    Given data: risk_score: {risk_score}, risk_level: {risk_level}
    shap_details: {shap_text}
    from the above details , make a short concise narrative , identify the type of stress and the severity.

    Give Stress analysis. return JSON ONLY:
        {{
            "narrative" : "str" 
            "stress_type" : "str"
            "severity" : "very high , high , medium , low"
        }}
    
    """

    llm = get_llm(0)
    result = llm.invoke(prompt)
    parse = clean_json(result.content)

    return{
        "Stress_context": {
            "narrative" : parse.get("narrative", ""),
            "stress_type" : parse.get("stress_type", ""),
            "severity" : parse.get("severity", "")
        }
    }
    


def agent2_compliance(state: Main_context) -> dict:
    
    # Hard stops first
    if state['Customer_profile']['fraud_flag']:
        return {
            "hard_stop": True,
            "hard_stop_reason": "Fraud flag active - escalate to fraud team",
            "eligible_interventions": []
        }
    
    if state['Customer_profile']['existing_restructuring']:
        return {
            "hard_stop": True,
            "hard_stop_reason": "Existing restructuring active - no new offers",
            "eligible_interventions": []
        }
    
    # Low risk - monitor only
    if state['total_risk_score'] < 0.3:
        return {
            "hard_stop": False,
            "hard_stop_reason": None,
            "eligible_interventions": ["monitor_only"]
        }
    
    # Build eligible interventions based on rules
    eligible = [
    "payment_holiday",
    "restructuring", 
    "rm_call",
    "financial_counseling",
    "monitor_only"
]

# remove what's not allowed
    if state['Customer_profile']['loan_type'] == "Home Loan":
        eligible.remove("payment_holiday")

    if state['Customer_profile']['tenure_months'] < 12:
        eligible.remove("restructuring")

    if state['Customer_profile']['relationship_value'] == "Low":
        eligible.remove("rm_call")
    
    return {
        "hard_stop": False,
        "hard_stop_reason": None,
        "eligible_interventions": eligible
    }


def intervention_agent(state: Main_context):
    shap =state["Shap"]
    risk_score = state["total_risk_score"]
    risk_level = state["risk_level"]

    shap_text = ""

    for sha in shap:
        shap_text+=f"{sha['feature']}: {sha['value']} , weightage: {sha['contribution']}, direction: {sha['direction']}"
        shap_text += "\n"
    txt = ""
    for sha in state['eligible_interventions']:
        txt+= sha
        txt += "\n"

    
    prompt = f""" you are a Financial expert in Delinqeuncy intervention. Select the best intervention approach to this specific situation of the customer.  
    Given data: risk_score: {risk_score}, risk_level: {risk_level}
    shap_details: {shap_text}, 
    customer_details: 
    tenure_months:{state['Customer_profile']['tenure_months']}, 
    loan_type: {state['Customer_profile']['loan_type']},
    relationship with the bank: {state['Customer_profile']['relationship_value']},
    loan_amount: {state['Customer_profile']['loan_amount']}


    eligible suggested interventions: {txt}

    Give Intervention suggestion. Based on the customer , suggest the tone and content of the outreach message. 
    
    Strictly return JSON ONLY:
        {{
            
            "Intervention_method" : "payment_holiday | restructuring | rm_call | financial_counseling | monitor_only"
            "Intervention_justification" : "str"
            "Message_Tone" : "  Empathetic , Reassuring , Urgent but Gentle, Informational"
            "Message_content" : "str"
        }}
    
    """
    llm = get_llm(0)
    result = llm.invoke(prompt)
    #print("AGENT 3 RAW:", repr(result.content))
    parse = clean_json(result.content)


    return {
        "Intervention_method": "payment_holiday",
        "Intervention_justification": parse.get("Intervention_justification", ""),
        "Message_Tone": parse.get("Message_Tone", ""),
        "Message_content": parse.get("Message_content", "")
    }

def voice_prep_node(state: Main_context) -> dict:
    """
    Pure Python. Builds voice_payload from accumulated state.
    No LLM. This is the bridge.
    """
    profile = state.get("Customer_profile", {})
    stress = state.get("Stress_context", {})
    
    # Map intervention method to human-readable offer detail
    OFFER_DETAILS = {
        "payment_holiday": "a short extension on your upcoming payment",
        "restructuring":   "a revised payment schedule",
        "rm_call":         "a call with your relationship manager",
        "financial_counseling": "a quick session with our financial advisor",
        "monitor_only":    None  # no call needed
    }
    
    intervention = state.get("Intervention_method", "monitor_only")
    offer_detail = OFFER_DETAILS.get(intervention)
    
    if not offer_detail:
        # monitor_only — no voice call needed
        return {"voice_payload": None}
    
    # show EMI amount only for high-value customers
    show_amount = profile.get("relationship_value") == "High"
    
    # max turns based on severity
    severity = stress.get("severity", "low")
    max_turns = 4 if severity in ["high", "very high"] else 3
    
    # Normally we pull tone_hint/avoid from translation, mock safely if absent
    tone_hint = "warm and gentle"
    avoid_topics = ["collections", "legal action"]
    
    payload = {
        "customer_name": profile.get("name", "Customer").split()[0],  # first name only
        "emi_date": "your upcoming payment date",      # comes from your data pipeline
        "offer_type": intervention,
        "offer_detail": offer_detail,
        "tone": state.get("Message_Tone", "Empathetic"),
        "message_tone": state.get("Message_Tone", "Empathetic"),
        "stress": {
            "narrative": stress.get("narrative", "Customer is experiencing financial stress."),
            "severity": stress.get("severity", "Medium")
        },
        "tone_hints": [tone_hint],
        "avoid_topics": avoid_topics,
        "show_emi_amount": show_amount,
        "max_turns": max_turns,
        "language_hint": "english",
        "fallback_message": "Let me connect you with someone from our team who can help."
    }
    
    return {"voice_payload": payload}

def voice_agent_node(state: Main_context) -> dict:
    """
    Calls the entire voice agent. Blocks until call is complete.
    Returns result into state.
    """
    if state.get("voice_payload") is None:
        # monitor_only path — skip call entirely
        return {
            "voice_result": {
                "escalate": False,
                "escalate_reason": "monitor_only",
                "outcome": "no_call_needed",
                "turns_taken": 0,
                "language_detected": "english",
                "call_memory": {}
            }
        }
    
    result = run_call(state["voice_payload"])
    
    return {"voice_result": result}
