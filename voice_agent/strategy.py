import json
import logging
from app.llm import get_llm

logger = logging.getLogger(__name__)

def clean_json(content: str) -> dict:
    content = content.strip()
    if content.startswith("```"):
        content = content.split("```")[1]
        if content.startswith("json"):
            content = content[4:]
    content = content.strip()
    return json.loads(content)

def build(voice_payload: dict) -> dict:
    prompt = f"""
Customer: {voice_payload['customer_name']}, offer: {voice_payload['offer_detail']}, tone: {voice_payload['tone']}
Tone hints from risk analysis: {voice_payload['tone_hints']}
Topics to avoid: {voice_payload['avoid_topics']}
Max turns available: {voice_payload['max_turns']}

Decide:
- How to open the call naturally (one sentence)
- When to introduce the offer (turn 1 or turn 2)
- What to say if customer seems hesitant
- What signals mean we should close early

Output — strict JSON:
{{
    "opening": "Hi {voice_payload['customer_name']}, this is Maya calling from Barclays — just a quick check-in about your upcoming payment.",
    "introduce_offer_on_turn": 1,
    "hesitancy_response": "Absolutely no pressure at all — it's just an option we wanted you to know about.",
    "early_close_signal": "accepts_offer",
    "tone_instruction": "warm, unhurried, never pushy"
}}
"""
    try:
        llm = get_llm(0) # Assuming 0 brings a configured Groq client, as used in other nodes
        # We need a low temperature call for reasoning. The existing get_llm might have a fixed temp, 
        # but using default for now.
        result = llm.invoke(prompt)
        parsed = clean_json(result.content)
        return parsed
    except Exception as e:
        logger.error(f"Failed to build call strategy: {e}")
        # Default strategy fallback
        return {
            "opening": f"Hi {voice_payload['customer_name']}, this is Maya calling from Barclays — just a quick check-in about your upcoming payment.",
            "introduce_offer_on_turn": 1,
            "hesitancy_response": "Absolutely no pressure at all — it's just an option we wanted you to know about.",
            "early_close_signal": "accepts_offer",
            "tone_instruction": "warm, unhurried, never pushy"
        }
