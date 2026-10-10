import sys
import os
from twilio.rest import Client
from dotenv import load_dotenv

load_dotenv()

# --- Twilio Outreach Config (Safe for Demo) ---
# We force the destination to the demo number for safety/free trial
TW_ACCOUNT_SID = (
    os.getenv("TW_ACCOUNT_SID")
    or os.getenv("TWILIO_ACCOUNT_SID")
    or os.getenv("TWILIO_SID")
)
TW_AUTH_TOKEN = (
    os.getenv("TW_AUTH_TOKEN")
    or os.getenv("TWILIO_AUTH_TOKEN")
    or os.getenv("TWILIO_TOKEN")
)
TW_WHATSAPP_SENDER = os.getenv("TW_WHATSAPP_SENDER") or os.getenv(
    "TWILIO_WHATSAPP_FROM", "whatsapp:+14155238886"
)
# For the demo, we always send to this number regardless of customer ID
DEMO_RECIPIENT_PHONE = os.getenv("DEMO_RECIPIENT_PHONE") or os.getenv(
    "TEST_RECIPIENT_PHONE"
)
TWILIO_ENABLED = os.getenv("TWILIO_ENABLED", "false").lower() == "true"

# Single initialization for performance
TW_CLIENT = None
if TWILIO_ENABLED and TW_ACCOUNT_SID and TW_AUTH_TOKEN:
    try:
        TW_CLIENT = Client(TW_ACCOUNT_SID, TW_AUTH_TOKEN)
        print(
            f"[INIT] Twilio Client initialized for WhatsApp Demo (Enabled: {TWILIO_ENABLED})."
        )
    except Exception as e:
        print(f"[INIT] Twilio Init Failure: {e}")

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def execute_intervention(pending_record: dict) -> dict:
    """
    Execute an approved intervention.

    Args:
        pending_record: The pending intervention record from the database

    Returns:
        dict with execution result
    """
    channel = pending_record.get("channel", "email")
    intervention_method = pending_record.get("intervention_method", "monitor_only")
    customer_id = pending_record.get("customer_id", "unknown")
    name = pending_record.get("name", "Customer")
    message = pending_record.get("message_preview", "")
    voice_script = pending_record.get("voice_script_preview", "")

    result = {
        "customer_id": customer_id,
        "channel": channel,
        "intervention_method": intervention_method,
        "executed": False,
        "message_sent": None,
        "voice_result": None,
        "errors": [],
    }

    if channel == "none" or intervention_method == "monitor_only":
        result["executed"] = True
        result["message_sent"] = "No outreach needed - monitoring only"
        print(f"[EXECUTE] Monitor only for {customer_id}")
        return result

    elif channel == "voice":
        result.update(
            _execute_voice(
                pending_record, customer_id, name, voice_script, intervention_method
            )
        )

    elif channel == "whatsapp":
        result.update(
            _execute_whatsapp(customer_id, name, message, intervention_method)
        )

    elif channel == "email":
        result.update(_execute_email(customer_id, name, message, intervention_method))

    else:
        result["errors"].append(f"Unknown channel: {channel}")
        print(f"[EXECUTE] ERROR: Unknown channel {channel} for {customer_id}")

    return result


def _execute_voice(
    pending_record: dict,
    customer_id: str,
    name: str,
    voice_script: str,
    intervention_method: str,
) -> dict:
    """
    Execute voice call.
    This is the actual voice agent call.
    """
    print(f"\n[EXECUTE] VOICE CALL for {customer_id}")
    print(f"[EXECUTE] Customer: {name}")
    print(f"[EXECUTE] Script preview: {voice_script[:100]}...")

    try:
        from voice_agent.agent import run_call

        # Build voice payload from pending record
        voice_payload = {
            "customer_name": name.split()[0] if name else "Customer",
            "offer_type": intervention_method,
            "offer_detail": _get_offer_detail(intervention_method),
            "message": voice_script,
            "tone": pending_record.get("message_tone", "Empathetic"),
            "tone_hints": ["warm and gentle"],
            "avoid_topics": ["collections", "legal action"],
            "stress": {
                "narrative": pending_record.get("stress_narrative", ""),
                "severity": "Medium",
            },
            "max_turns": 5,
            "language_hint": "english",
            "fallback_message": "Let me connect you with someone from our team who can help.",
        }

        print(f"[EXECUTE] Starting voice call...")
        voice_result = run_call(voice_payload)

        print(f"[EXECUTE] Voice call completed: {voice_result.get('outcome')}")

        return {
            "executed": True,
            "message_sent": "Voice call completed",
            "voice_result": voice_result,
        }
    except Exception as e:
        print(f"[EXECUTE] Voice call failed: {e}")
        return {
            "executed": False,
            "voice_result": {"error": str(e)},
            "errors": [f"Voice call failed: {str(e)}"],
        }


def _execute_whatsapp(
    customer_id: str, name: str, message: str, intervention_method: str
) -> dict:
    """
    Execute WhatsApp outreach via Twilio (Demo Mode).
    All messages are sent to the verified demo phone number.
    Always prints to terminal for fallback/audit.
    """
    # 1. Format the message
    formatted_message = f"Hi {name.split()[0] if name else 'Customer'},\n\n{message}"

    # 2. MANDATORY TERMINAL FALLBACK (Requested by user)
    print(f"\n" + "=" * 50)
    print(f"[OUTREACH] WHATSAPP TRIGGERED")
    print(f"[TARGET] Customer ID: {customer_id}")
    print(
        f"[RECIPIENT] {DEMO_RECIPIENT_PHONE if DEMO_RECIPIENT_PHONE else 'Verified Number Only'}"
    )
    print(f"[CONTENT] \n{formatted_message}")
    print("=" * 50 + "\n")

    # 3. Attempt LIVE Execution via Twilio if enabled and configured
    if TW_CLIENT and TW_WHATSAPP_SENDER and DEMO_RECIPIENT_PHONE:
        try:
            print(
                f"[EXECUTE] Triggering API call to Twilio WhatsApp Sandbox for {customer_id}..."
            )

            # Twilio WhatsApp numbers must be prefixed with 'whatsapp:'
            tw_msg = TW_CLIENT.messages.create(
                from_=TW_WHATSAPP_SENDER,
                body=formatted_message,
                to=f"whatsapp:{DEMO_RECIPIENT_PHONE}",
            )

            print(
                f"[SUCCESS] Twilio Message Queued (SID: {tw_msg.sid}) for {customer_id}"
            )
            return {
                "executed": True,
                "message_sent": formatted_message,
                "twilio_sid": tw_msg.sid,
                "dispatch_status": "SENT_VIA_TWILIO",
            }
        except Exception as e:
            print(f"[ERROR] Twilio API call failed for {customer_id}: {e}")
            return {
                "executed": False,
                "error": str(e),
                "message_sent": "Dispatch failed (Check terminal for details)",
            }

    # 4. Standard Simulation (If Twilio is disabled or missing credentials)
    print(
        f"[SIMULATOR] Twilio not enabled or missing credentials for {customer_id}. Logging locally."
    )
    return {
        "executed": True,
        "message_sent": formatted_message,
        "dispatch_status": "LOCAL_TERMINAL_ONLY",
    }


def _execute_email(
    customer_id: str, name: str, message: str, intervention_method: str
) -> dict:
    """
    Execute email.
    """
    print(f"\n[EXECUTE] EMAIL for {customer_id}")
    print(f"[EXECUTE] Customer: {name}")
    print(f"[EXECUTE] Message: {message[:100]}...")

    subject_map = {
        "payment_holiday": "Payment Holiday Option for Your Loan",
        "restructuring": "Loan Restructuring Options",
        "rm_call": "We'd Like to Connect With You",
        "financial_counseling": "Financial Counseling Available",
        "monitor_only": "Account Update",
    }

    subject = subject_map.get(intervention_method, "Important Account Update")

    email_body = f"""Dear {name or "Customer"},

{message}

If you have any questions, please contact us.

Best regards,
Customer Support Team
"""

    print(f"[EXECUTE] EMAIL SUBJECT: {subject}")
    print(f"[EXECUTE] EMAIL BODY:")
    print(email_body)
    print("-" * 50)

    return {
        "executed": True,
        "message_sent": f"Subject: {subject}",
        "email_body": email_body,
    }


def _get_offer_detail(intervention_method: str) -> str:
    """Get human-readable offer detail for voice agent."""
    offer_map = {
        "payment_holiday": "a payment holiday — we can pause your next payment and give you some breathing room",
        "restructuring": "a loan restructuring option — we can reduce your monthly payment amount",
        "rm_call": "a direct call with your relationship manager",
        "financial_counseling": "a free 20-minute session with our financial advisor",
        "monitor_only": "support with your account",
    }
    return offer_map.get(intervention_method, "support with your account")


def build_voice_payload(pending_record: dict) -> dict:
    """
    Build voice payload from pending intervention record.
    Used by both _execute_voice and the SSE streaming endpoint.
    """
    customer_id = pending_record.get("customer_id", "unknown")
    name = pending_record.get("name", "Customer")
    voice_script = pending_record.get("voice_script_preview", "")
    intervention_method = pending_record.get("intervention_method", "monitor_only")

    return {
        "customer_name": name.split()[0] if name else "Customer",
        "offer_type": intervention_method,
        "offer_detail": _get_offer_detail(intervention_method),
        "message": voice_script,
        "tone": pending_record.get("message_tone", "Empathetic"),
        "tone_hints": ["warm and gentle"],
        "avoid_topics": ["collections", "legal action"],
        "stress": {
            "narrative": pending_record.get("stress_narrative", ""),
            "severity": "Medium",
        },
        "max_turns": 5,
        "language_hint": "english",
        "fallback_message": "Let me connect you with someone from our team who can help.",
    }
