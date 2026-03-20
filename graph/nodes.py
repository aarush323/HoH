# from app.main import predict, prepare_agent3_input
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


from .state import Main_context, VALID_STRESS_TYPES
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
    shap = state["Shap"]
    risk_score = state["total_risk_score"]
    risk_level = state["risk_level"]

    shap_text = ""

    for sha in shap:
        shap_text += f"{sha['feature']}: {sha['value']} , weightage: {sha['contribution']}, direction: {sha['direction']}"
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

    return {
        "Stress_context": {
            "narrative": parse.get("narrative", ""),
            "stress_type": parse.get("stress_type", ""),
            "severity": parse.get("severity", ""),
        }
    }


def agent2_compliance(state: Main_context) -> dict:
    """
    Phase 1: Hard stops (4 flags) - immediate rejection
    Phase 2: Eligibility removal + stress-based ranking
    """
    profile = state["Customer_profile"]

    # PHASE 1: Hard stops - any of these block all interventions
    if profile.get("fraud_flag"):
        return {
            "hard_stop": True,
            "hard_stop_reason": "Fraud flag active - escalate to fraud team",
            "eligible_interventions": [],
        }

    if profile.get("existing_restructuring"):
        return {
            "hard_stop": True,
            "hard_stop_reason": "Existing restructuring active - no new offers",
            "eligible_interventions": [],
        }

    if profile.get("legal_npa_flag"):
        return {
            "hard_stop": True,
            "hard_stop_reason": "Legal/NPA account - escalate to legal team",
            "eligible_interventions": [],
        }

    if profile.get("kyc_lapsed"):
        return {
            "hard_stop": True,
            "hard_stop_reason": "KYC lapsed - cannot process until updated",
            "eligible_interventions": [],
        }

    # PHASE 2: Build eligible interventions + stress-based ranking
    stress_type = state.get("Stress_context", {}).get("stress_type", "unknown")
    severity = state.get("Stress_context", {}).get("severity", "low")

    # Base eligible interventions
    eligible = [
        "payment_holiday",
        "restructuring",
        "rm_call",
        "financial_counseling",
        "monitor_only",
    ]

    # Apply eligibility removal rules
    if profile.get("loan_type") == "Home Loan":
        if "payment_holiday" in eligible:
            eligible.remove("payment_holiday")

    if profile.get("tenure_months", 0) < 12:
        if "restructuring" in eligible:
            eligible.remove("restructuring")

    if profile.get("relationship_value") == "Low":
        if "rm_call" in eligible:
            eligible.remove("rm_call")

    # Stress-based ranking: prioritize interventions based on stress type
    # Higher severity = more aggressive intervention recommended
    stress_ranking = {
        "income_shock": [
            "payment_holiday",
            "financial_counseling",
            "restructuring",
            "rm_call",
            "monitor_only",
        ],
        "overspending": [
            "financial_counseling",
            "rm_call",
            "payment_holiday",
            "restructuring",
            "monitor_only",
        ],
        "structural": [
            "restructuring",
            "payment_holiday",
            "rm_call",
            "financial_counseling",
            "monitor_only",
        ],
        "debt": [
            "financial_counseling",
            "payment_holiday",
            "restructuring",
            "rm_call",
            "monitor_only",
        ],
        "unknown": [
            "rm_call",
            "financial_counseling",
            "payment_holiday",
            "restructuring",
            "monitor_only",
        ],
    }

    # Get ranking for detected stress type, fallback to unknown
    ranking = stress_ranking.get(stress_type.lower(), stress_ranking["unknown"])

    # Filter ranking to only include eligible interventions
    ranked_interventions = [i for i in ranking if i in eligible]

    # Add any eligible interventions not in ranking (fallback) - always append monitor_only last
    for i in eligible:
        if i not in ranked_interventions:
            ranked_interventions.append(i)

    # Ensure monitor_only is always last
    if "monitor_only" in ranked_interventions:
        ranked_interventions.remove("monitor_only")
        ranked_interventions.append("monitor_only")

    return {
        "hard_stop": False,
        "hard_stop_reason": None,
        "eligible_interventions": ranked_interventions,
    }

    if state["Customer_profile"]["existing_restructuring"]:
        return {
            "hard_stop": True,
            "hard_stop_reason": "Existing restructuring active - no new offers",
            "eligible_interventions": [],
        }

    # Low risk - monitor only
    if state["total_risk_score"] < 0.3:
        return {
            "hard_stop": False,
            "hard_stop_reason": None,
            "eligible_interventions": ["monitor_only"],
        }

    # Build eligible interventions based on rules
    eligible = [
        "payment_holiday",
        "restructuring",
        "rm_call",
        "financial_counseling",
        "monitor_only",
    ]

    # remove what's not allowed
    if state["Customer_profile"]["loan_type"] == "Home Loan":
        eligible.remove("payment_holiday")

    if state["Customer_profile"]["tenure_months"] < 12:
        eligible.remove("restructuring")

    if state["Customer_profile"]["relationship_value"] == "Low":
        eligible.remove("rm_call")

    return {
        "hard_stop": False,
        "hard_stop_reason": None,
        "eligible_interventions": eligible,
    }


def intervention_agent(state: Main_context):
    shap = state["Shap"]
    risk_score = state["total_risk_score"]
    risk_level = state["risk_level"]

    shap_text = ""
    for sha in shap:
        shap_text += f"{sha['feature']}: {sha['value']} , weightage: {sha['contribution']}, direction: {sha['direction']}\n"

    eligible_text = "\n".join(state["eligible_interventions"])

    # Prompt 1: Method selection only
    prompt1 = f"""You are a Financial expert in Delinquency intervention. Select the best intervention approach for this customer.
    
Given data:
- risk_score: {risk_score}
- risk_level: {risk_level}
- shap_details: {shap_text}
- customer_details:
  - tenure_months: {state["Customer_profile"]["tenure_months"]}
  - loan_type: {state["Customer_profile"]["loan_type"]}
  - relationship with bank: {state["Customer_profile"]["relationship_value"]}
  - loan_amount: {state["Customer_profile"]["loan_amount"]}

eligible interventions: {eligible_text}

Note: 'monitor_only' should only be selected if risk_score < 0.35. This customer has risk_score: {risk_score} — active intervention is warranted.

Strictly return JSON ONLY:
{{
    "Intervention_method": "payment_holiday | restructuring | rm_call | financial_counseling | monitor_only",
    "Intervention_justification": "brief reason for selection"
}}"""

    llm = get_llm(0)
    result1 = llm.invoke(prompt1)
    parse1 = clean_json(result1.content)

    # Validate and potentially override method selection
    eligible_interventions = state.get("eligible_interventions", [])
    selected_method = parse1.get("Intervention_method", "")

    if selected_method not in eligible_interventions:
        if risk_score >= 0.35:
            selected_method = next(
                (i for i in eligible_interventions if i != "monitor_only"),
                eligible_interventions[0] if eligible_interventions else "monitor_only",
            )
        else:
            selected_method = (
                eligible_interventions[0] if eligible_interventions else "monitor_only"
            )

    intervention_descriptions = {
        "payment_holiday": "offer a temporary payment holiday/extension on upcoming payments",
        "restructuring": "propose a revised payment schedule or loan restructuring",
        "rm_call": "connect customer with their relationship manager for personalized assistance",
        "financial_counseling": "schedule a session with a financial counselor",
        "monitor_only": "add customer to monitoring list with no active outreach",
    }
    intervention_desc = intervention_descriptions.get(
        selected_method, "assess customer needs"
    )

    # Prompt 2: Message generation given chosen method
    prompt2 = f"""You are a customer communication specialist. Generate an outreach message for a bank customer.

Customer context:
- name: {state["Customer_profile"]["name"]}
- loan_type: {state["Customer_profile"]["loan_type"]}
- loan_amount: {state["Customer_profile"]["loan_amount"]}
- relationship with bank: {state["Customer_profile"]["relationship_value"]}
- risk_level: {risk_level}
- stress narrative: {state.get("Stress_context", {}).get("narrative", "Customer is experiencing financial stress.")}

Selected intervention: {selected_method}
This intervention means: {intervention_desc}

Generate an appropriate outreach message and a justification specific to why {selected_method} was chosen for this customer.

Strictly return JSON ONLY:
{{
    "Intervention_justification": "2-3 sentence explanation of why {selected_method} is the right intervention for this specific customer",
    "Message_Tone": "Empathetic | Reassuring | Urgent but Gentle | Informational",
    "Message_content": "2-3 sentence outreach message tailored to the selected intervention"
}}"""

    result2 = llm.invoke(prompt2)
    parse2 = clean_json(result2.content)

    return {
        "Intervention_method": selected_method,
        "Intervention_justification": parse2.get("Intervention_justification", ""),
        "Message_Tone": parse2.get("Message_Tone", "Empathetic"),
        "Message_content": parse2.get("Message_content", ""),
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
        "payment_holiday": (
            "a 3-month payment holiday where your EMI pauses completely — "
            "no penalty, no missed payment recorded, payments resume automatically in month 4"
        ),
        "restructuring": (
            "a revised payment schedule where we restructure your loan — "
            "lower monthly payments spread over an extended tenure, "
            "a specialist will walk you through the exact numbers"
        ),
        "rm_call": (
            "a direct call with your relationship manager who can personalise "
            "a solution for your specific situation — no forms, no waiting"
        ),
        "financial_counseling": (
            "a session with our financial advisor who can help you build "
            "a practical plan to manage your payments going forward"
        ),
        "monitor_only": None,
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
    max_turns = 6 if severity in ["high", "very high"] else 5

    # Normally we pull tone_hint/avoid from translation, mock safely if absent
    tone_hint = "warm and gentle"
    avoid_topics = ["collections", "legal action"]

    payload = {
        "customer_name": profile.get("name", "Customer").split()[0],  # first name only
        "emi_date": "your upcoming payment date",  # comes from your data pipeline
        "offer_type": intervention,
        "offer_detail": offer_detail,
        "tone": state.get("Message_Tone", "Empathetic"),
        "message_tone": state.get("Message_Tone", "Empathetic"),
        "stress": {
            "narrative": stress.get(
                "narrative", "Customer is experiencing financial stress."
            ),
            "severity": stress.get("severity", "Medium"),
        },
        "tone_hints": [tone_hint],
        "avoid_topics": avoid_topics,
        "show_emi_amount": show_amount,
        "max_turns": max_turns,
        "language_hint": "english",
        "fallback_message": "Let me connect you with someone from our team who can help.",
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
                "call_memory": {},
            }
        }

    result = run_call(state["voice_payload"])

    return {"voice_result": result}


import traceback
from datetime import datetime
from sqlalchemy import text
from db.postgres import get_connection

def log_fallback(state: dict, error_msg: str):
    log_file = "agent_output_fallback.log"
    import json
    try:
        dump = {
            "timestamp": datetime.now().isoformat(),
            "error": error_msg,
            "state": state
        }
        with open(log_file, "a") as f:
            f.write(json.dumps(dump, default=str) + "\n")
    except Exception:
        pass


def persist_to_db_node(state: Main_context) -> dict:
    # Treat mock or missing prediction_id as NULL for Postgres
    raw_pid = state.get("prediction_id")
    prediction_id = raw_pid if raw_pid and raw_pid != 999999 else None

    observation_week = state.get("observation_week")
    if not observation_week:
        log_fallback(state, "observation_week is missing or null.")
        return {}

    try:
        with get_connection() as conn:
            with conn.begin():
                stress = state.get("Stress_context", {})
                # Direct access to Customer_profile as it should always be present
                customer_id = state["Customer_profile"]["customer_id"]

                # Step 2: Insert into stress_context
                result = conn.execute(text("""
                    INSERT INTO stress_context (customer_id, prediction_id, narrative, stress_type, severity)
                    VALUES (:cid, :pid, :narrative, :type, :severity)
                    RETURNING id
                """), {
                    "cid": customer_id,
                    "pid": prediction_id,
                    "narrative": stress.get("narrative"),
                    "type": stress.get("stress_type"),
                    "severity": stress.get("severity")
                })
                stress_context_id = result.scalar()

                # Step 3: Insert into interventions
                hard_stop_flag = state.get("hard_stop", False)
                initial_status = "hard_stopped" if hard_stop_flag else "dispatched"

                eligible = state.get("eligible_interventions", [])
                dispatch_res = state.get("channel_dispatch_result")
                dispatch_json = json.dumps(dispatch_res) if dispatch_res else None

                res3 = conn.execute(text("""
                    INSERT INTO interventions (
                        customer_id, observation_week, prediction_id, stress_context_id,
                        intervention_method, intervention_justification, eligible_interventions,
                        selected_channel, message_tone, message_content, channel_dispatch_result,
                        hard_stop, hard_stop_reason, status, outcome
                    ) VALUES (
                        :cid, :oweek, :pid, :scid,
                        :imethod, :ijustify, :eligible,
                        :chan, :tone, :content, CAST(:dispatch AS JSONB),
                        :hs, :hsr, :status, NULL
                    )
                    ON CONFLICT (customer_id, observation_week) DO UPDATE SET
                        stress_context_id = EXCLUDED.stress_context_id,
                        intervention_method = EXCLUDED.intervention_method,
                        intervention_justification = EXCLUDED.intervention_justification,
                        eligible_interventions = EXCLUDED.eligible_interventions,
                        selected_channel = EXCLUDED.selected_channel,
                        message_tone = EXCLUDED.message_tone,
                        message_content = EXCLUDED.message_content,
                        channel_dispatch_result = EXCLUDED.channel_dispatch_result,
                        hard_stop = EXCLUDED.hard_stop,
                        hard_stop_reason = EXCLUDED.hard_stop_reason,
                        status = EXCLUDED.status,
                        outcome = EXCLUDED.outcome,
                        resolved_at = NULL
                    RETURNING id
                """), {
                    "cid": customer_id,
                    "oweek": observation_week,
                    "pid": prediction_id,
                    "scid": stress_context_id,
                    "imethod": state.get("Intervention_method"),
                    "ijustify": state.get("Intervention_justification"),
                    "eligible": eligible,
                    "chan": state.get("selected_channel"),
                    "tone": state.get("Message_Tone"),
                    "content": state.get("Message_content"),
                    "dispatch": dispatch_json,
                    "hs": hard_stop_flag,
                    "hsr": state.get("hard_stop_reason"),
                    "status": initial_status
                })
                intervention_id = res3.scalar()

                # Step 4: Insert into voice_sessions (conditional)
                vr = state.get("voice_result")
                if vr is not None and vr.get("outcome") != "no_call_needed":
                    mem = vr.get("call_memory")
                    mem_json = json.dumps(mem) if mem else None

                    conn.execute(text("""
                        INSERT INTO voice_sessions (
                            intervention_id, customer_id, escalate, escalate_reason,
                            outcome, turns_taken, language_detected, call_memory, call_duration_seconds
                        ) VALUES (
                            :ivid, :cid, :esc, :escreason, :out, :turns, :lang, CAST(:mem AS JSONB), NULL
                        )
                    """), {
                        "ivid": intervention_id,
                        "cid": customer_id,
                        "esc": vr.get("escalate"),
                        "escreason": vr.get("escalate_reason"),
                        "out": vr.get("outcome"),
                        "turns": vr.get("turns_taken"),
                        "lang": vr.get("language_detected"),
                        "mem": mem_json
                    })

                    conn.execute(text("""
                        UPDATE interventions
                        SET outcome = :out, resolved_at = NOW()
                        WHERE id = :ivid
                    """), {
                        "out": vr.get("outcome"),
                        "ivid": intervention_id
                    })

    except Exception as e:
        log_fallback(state, str(e) + "\n" + traceback.format_exc())
        raise

    return {}
