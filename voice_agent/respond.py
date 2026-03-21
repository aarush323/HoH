import random

RESPONSES = {
    "opening": {
        "doing_fine": [
            "Absolutely no problem at all, {name} — we'll see you on {emi_date}. Have a great day!"
        ],
        "struggling": [
            "I completely understand, {name}. That's actually why we're calling. We wanted to check if you'd be interested in {offer_detail}?"
        ],
        "dispute": [
            "I completely understand — let me get the right person to help you with those details."
        ],
        "distressed": [
            "I hear you, {name} — I'm going to get someone from our team to call you right back."
        ],
        "unclear": [
            "Sorry about that — could you say that once more?"
        ]
    },
    "offer_presented": {
        "accepts_offer": [
            "That's great, {name} — I've noted that for you. You'll receive a confirmation soon."
        ],
        "declines_offer": [
            "No problem at all. Sometimes it helps to review your budget, or we could set up a call with a financial counselor to explore other options. Would you like to speak with one?"
        ],
        "wants_alternative": [
            "Absolutely — let me connect you with someone who can walk through all the options."
        ],
        "dispute": [
            "I completely understand — let me get the right person to help you with that."
        ],
        "distressed": [
            "I hear you, {name} — I'm going to get someone from our team to call you right back."
        ],
        "unclear": [
            "I didn't quite catch that — no worries, take your time."
        ]
    },
    "tips_presented": {
        "wants_counsellor": [
            "Absolutely, I'll arrange for our financial counselor to follow up with you."
        ],
        "declines_all": [
            "I understand. If you need anything else, we're here. Have a good day, {name}."
        ],
        "dispute": [
            "I completely understand — let me get the right person to help you with that."
        ],
        "distressed": [
            "I hear you, {name} — I'm going to get someone from our team to call you right back."
        ],
        "unclear": [
            "Sorry, could you repeat that?"
        ]
    }
}

def respond(current_stage: str, primary_intent: str, voice_payload: dict) -> str:
    stage_data = RESPONSES.get(current_stage, {})
    lines = stage_data.get(primary_intent, stage_data.get("unclear", ["I didn't quite catch that."]))
    
    line_template = random.choice(lines)
    
    response_text = line_template.format(
        name=voice_payload.get("customer_name", ""),
        emi_date=voice_payload.get("emi_date", "your upcoming payment date"),
        offer_detail=voice_payload.get("offer_detail", "a short extension")
    )
    
    return response_text
