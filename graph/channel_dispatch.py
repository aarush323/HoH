from typing import Optional, Callable
from .state import Main_context, CHANNELS

_db: Optional[Callable] = None


def init_db(db: Callable) -> None:
    global _db
    _db = db


def select_channel(state: Main_context) -> str:
    """
    Select the best communication channel based on customer profile and intervention.
    Returns: "voice" | "sms_whatsapp" | "email" | "none"
    """
    profile = state.get("Customer_profile", {})
    intervention = state.get("Intervention_method", "monitor_only")
    risk_level = str(state.get("risk_level", "low")).lower()
    relationship = str(profile.get("relationship_value", "Medium")).lower()

    # Monitor only = no dispatch needed
    if intervention == "monitor_only":
        return "none"

    # High risk + High relationship = voice preferred
    if risk_level in ["high", "very high", "very_high"] and relationship == "high":
        return "voice"

    # High risk + Medium/Low relationship = sms_whatsapp
    if risk_level in ["high", "very high", "very_high"]:
        return "sms_whatsapp"

    # Medium risk = sms_whatsapp or email
    if risk_level == "medium":
        return "sms_whatsapp"

    # Low risk = email
    return "email"


def format_sms(name: str, offer_detail: str) -> str:
    """Format message for SMS channel. Max 160 characters."""
    core = f"Hi {name}, we'd like to offer you {offer_detail} for your upcoming payment. Call us back to discuss. Reply STOP to opt out."
    return core


def format_whatsapp(name: str, intervention: str, message_content: str) -> str:
    """Format message for WhatsApp channel."""
    return f"Hi {name},\n\n{message_content}\n\nReply STOP to opt out."


def format_email(name: str, intervention: str, message_content: str, tone: str) -> str:
    """Format message for email channel."""
    subject_map = {
        "payment_holiday": "Payment Holiday Option for Your Loan",
        "restructuring": "Loan Restructuring Options",
        "rm_call": "We'd Like to Connect With You",
        "financial_counseling": "Financial Counseling Available",
        "monitor_only": "Account Update",
    }

    subject = subject_map.get(intervention, "Important Account Update")

    return f"""Subject: {subject}

Dear {name},

{message_content}

If you have any questions, please contact us.

Best regards,
Customer Support Team
"""


def log_dispatch(
    customer_id: str, channel: str, message: str, intervention: str
) -> dict:
    """Log the dispatch to database if available."""
    result = {
        "customer_id": customer_id,
        "channel": channel,
        "intervention": intervention,
        "message": message,
        "status": "pending",
    }

    if _db is not None:
        try:
            _db().insert("dispatches", result)
            result["status"] = "logged"
        except Exception as e:
            result["status"] = "error"
            result["error"] = str(e)

    return result


def channel_dispatch_node(state: Main_context) -> dict:
    """
    Node that selects channel, formats message, and logs dispatch.
    """
    profile = state.get("Customer_profile", {})
    intervention = state.get("Intervention_method", "monitor_only")
    message_content = state.get("Message_content", "")
    tone = state.get("Message_Tone", "Empathetic")

    customer_id = profile.get("customer_id", "unknown")
    name = profile.get("name", "Customer").split()[0]

    channel = select_channel(state)

    # --- ALWAYS GENERATE AND PRINT FOR TESTING ---
    offer_detail = state.get("voice_payload", {}).get("offer_detail", "an extension")
    formatted_sms = format_sms(name, offer_detail)
    whatsapp_msg = format_whatsapp(name, intervention, message_content)
    
    # Strip double greeting for WhatsApp if message_content already starts with "Hi "
    if message_content.startswith(f"Hi {name}"):
        whatsapp_msg = f"{message_content}\n\nReply STOP to opt out."
        
    print(f'\n  [SMS WOULD SEND]: "{formatted_sms}"')
    print(f'  [WHATSAPP WOULD SEND]: "{whatsapp_msg}"\n')

    formatted_email = format_email(name, intervention, message_content, tone)
    
    subject_map = {
        "payment_holiday": "Payment Holiday Option for Your Loan",
        "restructuring": "Loan Restructuring Options",
        "rm_call": "We'd Like to Connect With You",
        "financial_counseling": "Financial Counseling Available",
        "monitor_only": "Account Update",
    }
    subject = subject_map.get(intervention, "Important Account Update")
    
    # Strip double greeting for email if message_content already starts with "Hi "
    if message_content.startswith(f"Hi {name}"):
        body = f"{message_content}\n\nIf you have any questions, please contact us.\n\nBest regards,\nCustomer Support Team\n"
    else:
        body = f"Dear {name},\n\n{message_content}\n\nIf you have any questions, please contact us.\n\nBest regards,\nCustomer Support Team\n"
        
    print(f'\n  [EMAIL SUBJECT]: "{subject}"')
    print(f'  [EMAIL BODY]: "{body}"\n')
    # ---------------------------------------------

    if channel == "none":
        return {"selected_channel": "none", "channel_dispatch_result": None}

    # Format message based on channel
    if channel == "sms_whatsapp":
        formatted_message = formatted_sms
    elif channel == "email":
        formatted_message = formatted_email
    else:  # voice
        formatted_message = message_content

    # Log dispatch
    dispatch_result = log_dispatch(
        customer_id, channel, formatted_message, intervention
    )

    return {"selected_channel": channel, "channel_dispatch_result": dispatch_result}
