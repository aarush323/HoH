STAGE_INTENTS = {
    "opening": {
        "doing_fine":    "Customer confident they will pay, no issues",
        "struggling":    "Any doubt, hesitation, difficulty — even mild",
        "dispute":       "Questions the payment details",
        "distressed":    "Emotional, upset, overwhelmed",
        "unclear":       "Cannot determine intent at all"
    },
    "offer_presented": {
        "accepts_offer":      "Wants the offered option",
        "declines_offer":     "Doesn't want this specific offer",
        "wants_alternative":  "Wants something different",
        "dispute":            "Questions payment details",
        "distressed":         "Emotional",
        "unclear":            "Cannot determine intent at all"
    },
    "tips_presented": {
        "wants_counsellor":  "Open to speaking with financial advisor",
        "declines_all":      "Doesn't want any help, will manage alone",
        "dispute":           "Questions payment details",
        "distressed":        "Emotional",
        "unclear":           "Cannot determine intent at all"
    }
}

from typing import Optional

def next_stage(current_stage: str, intent: str) -> tuple[str, Optional[str]]:
    transitions = {
        "opening": {
            "doing_fine":  ("close_call",      "declined_gracefully"),
            "struggling":  ("offer_presented", None),
            "dispute":     ("escalate_human",  "dispute"),
            "distressed":  ("escalate_human",  "distressed"),
            "unclear":     ("retry_listen",    None)
        },
        "offer_presented": {
            "accepts_offer":     ("close_call",     "resolved"),
            "declines_offer":    ("tips_presented", None),
            "wants_alternative": ("escalate_human", "wants_alternative"),
            "dispute":           ("escalate_human", "dispute"),
            "distressed":        ("escalate_human", "distressed"),
            "unclear":           ("retry_listen",   None)
        },
        "tips_presented": {
            "wants_counsellor": ("escalate_human", "counsellor_requested"),
            "declines_all":     ("close_call",     "declined_all"),
            "dispute":          ("escalate_human", "dispute"),
            "distressed":       ("escalate_human", "distressed"),
            "unclear":          ("retry_listen",   None)
        }
    }
    
    # Fallback if intent isn't recognized
    return transitions.get(current_stage, {}).get(intent, ("retry_listen", None))
