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

# Intent categories — used by trajectory and outcome logic
NEUTRAL_INTENTS = ["question_offer", "question_other", "unclear", "tip_given"]
POSITIVE_INTENTS = ["accepts_offer", "doing_fine"]
NEGATIVE_INTENTS = ["declines_offer", "declines_all"]

def log_guardrail_trigger(response_text: str, turn: int):
    logger.warning(f"[Guardrail Triggered] Turn {turn} | Original: '{response_text}'")

def update_trajectory(intent_history: list) -> str:
    """Determine sentiment trajectory based on intent history."""
    if len(intent_history) < 2:
        return "stable"
        
    last_intent = intent_history[-1]
    prev_intent = intent_history[-2]
    
    if prev_intent in NEGATIVE_INTENTS and last_intent in POSITIVE_INTENTS:
        return "improving"
    if prev_intent in POSITIVE_INTENTS and last_intent in NEGATIVE_INTENTS:
        return "deteriorating"
    if last_intent in NEGATIVE_INTENTS:
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
    # Filter out neutral intents — they shouldn't drive outcome
    meaningful = [i for i in intent_history if i not in NEUTRAL_INTENTS]
    if not meaningful:
        return "completed"
    if "accepts_offer" in meaningful:
        return "accepted"
    if "declines_offer" in meaningful:
        return "declined"
    if "schedule_callback" in meaningful or "needs_time" in meaningful:
        return "callback_requested"
    if "raises_dispute" in meaningful or "distressed" in meaningful or "wants_alternative" in meaningful:
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
