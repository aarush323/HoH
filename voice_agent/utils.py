import logging

def setup_logger(name: str) -> logging.Logger:
    logger = logging.getLogger(name)
    if not logger.handlers:
        logger.setLevel(logging.INFO)
        sh = logging.StreamHandler()
        formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
        sh.setFormatter(formatter)
        logger.addHandler(sh)
    return logger

logger = setup_logger(__name__)

def log_guardrail_trigger(response_text: str, turn: int):
    logger.warning(f"[Guardrail Triggered] Turn {turn} | Original: '{response_text}'")

def update_trajectory(intent_history: list) -> str:
    """Determine sentiment trajectory based on intent history."""
    if len(intent_history) < 2:
        return "stable"
        
    last_intent = intent_history[-1]
    prev_intent = intent_history[-2]
    
    positive_intents = ["accepts_offer"]
    negative_intents = ["raises_dispute", "distressed", "declines_offer"]
    
    if prev_intent in negative_intents and last_intent in positive_intents:
        return "improving"
    if prev_intent in positive_intents and last_intent in negative_intents:
        return "deteriorating"
    if last_intent in negative_intents:
        return "deteriorating"
    
    return "stable"

def check_trajectory(call_state: dict) -> str:
    """Returns a trajectory signal based on state."""
    intent_history = call_state.get("intent_history", [])
    if not intent_history:
        return "continue"
        
    last_intent = intent_history[-1]
    
    if last_intent == "accepts_offer":
        return "resolve_early"
        
    if last_intent == "distressed":
        return "escalate_distressed"
        
    if last_intent == "raises_dispute":
        return "escalate_dispute"
        
    return "continue"

def determine_outcome(intent_history: list) -> str:
    if not intent_history:
        return "unknown"
    if "accepts_offer" in intent_history:
        return "accepted"
    if "declines_offer" in intent_history:
        return "declined"
    if "schedule_callback" in intent_history or "needs_time" in intent_history:
        return "callback_requested"
    if "raises_dispute" in intent_history or "distressed" in intent_history or "wants_alternative" in intent_history:
        return "escalated"
    return "completed"

def extract_topics(transcript_history: list) -> list:
    # Basic logic for topic extraction (could be upgraded to LLM call if needed)
    topics = []
    full_text = " ".join(transcript_history).lower()
    if "job" in full_text or "lost" in full_text or "unemployed" in full_text:
        topics.append("employment_loss")
    if "hospital" in full_text or "medical" in full_text or "health" in full_text:
        topics.append("health_issue")
    if "amount" in full_text or "emi" in full_text or "interest" in full_text:
        topics.append("loan_details")
    return topics
