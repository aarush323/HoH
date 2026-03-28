import sys
import os

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
            _execute_voice(customer_id, name, voice_script, intervention_method)
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
    customer_id: str, name: str, voice_script: str, intervention_method: str
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
    Execute WhatsApp message.
    """
    print(f"\n[EXECUTE] WHATSAPP for {customer_id}")
    print(f"[EXECUTE] Customer: {name}")
    print(f"[EXECUTE] Message: {message[:100]}...")

    # In production, this would integrate with WhatsApp Business API
    # For now, just simulate sending

    formatted_message = f"Hi {name.split()[0] if name else 'Customer'},\n\n{message}\n\nReply STOP to opt out."

    print(f"[EXECUTE] WHATSAPP WOULD SEND:")
    print(formatted_message)
    print("-" * 50)

    return {
        "executed": True,
        "message_sent": formatted_message,
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
