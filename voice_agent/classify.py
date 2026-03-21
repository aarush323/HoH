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


def format_history(history: list) -> str:
    if not history:
        return "No conversation history yet."
    formatted = ""
    for i, turn in enumerate(history):
        formatted += f"Turn {i + 1}: {turn}\n"
    return formatted


def call_llm(prompt: str) -> dict:
    try:
        llm = get_llm(0)
        result = llm.invoke(prompt)
        return clean_json(result.content)
    except Exception as e:
        logger.error(f"Classification failed: {e}")
        return {
            "intent": "unclear",
            "next_action": "continue",
            "outcome": "unresolved",
            "response": "Sorry, could you repeat that?",
            "reasoning": "failed",
        }


def opening_stage(transcript, history, payload, stress):
    prompt = f"""
You are Maya, a Barclays support agent on a proactive courtesy call.
Customer: {payload["customer_name"]}
Background context (never say this to customer): {stress["narrative"]}

IMPORTANT: The background context above is for your awareness only.
ALWAYS classify based on what the customer ACTUALLY SAID, not the background.
If the customer says they will pay — they are CONFIDENT regardless of background.

Customer just said: "{transcript}"

YOUR ONLY JOB RIGHT NOW:
Decide if this customer is fine or needs help.
Then respond warmly and naturally.

CONFIDENT = close the call. Examples:
- "I'll pay on time"
- "No issues"  
- "Will pay when due"
- "I'm fine"
→ Respond warmly, wish them well, end call.

STRUGGLING = acknowledge AND immediately mention you have an option.
Examples of struggling:
- "might be difficult"
- "I'll try"
- "having some issues"
- "not sure"
- "a bit tight"

NOT CONFIDENT — treat as struggling:
- "I'll try my best"
- "hopefully"
- "should be able to"
- "I think so"
- "probably"
- "not sure if I can"
- "looking a bit difficult"

→ Acknowledge AND say: you have {payload["offer_detail"]} that might help.
→ Do NOT just say "let me see what I can do" — that's vague and unhelpful.
→ One sentence acknowledgement + one sentence introducing the option.

ANYTHING ELSE:
- Rude/upset → distressed
- Questions about loan/amount → dispute

NEVER SAY: default, risk, flagged, collections, overdue, missed payment

Max 2 sentences. Sound human.

Return JSON only:
{{
    "intent": "doing_fine | struggling | distressed | dispute",
    "next_action": "close_call | advance_stage | escalate_urgent",
    "outcome": "declined_gracefully | null",
    "response": "str",
    "reasoning": "str"
}}
"""
    result = call_llm(prompt)
    print(
        f"[CLASSIFY DEBUG] transcript='{transcript}' → intent={result.get('intent')} reasoning={result.get('reasoning')}"
    )

    # Fix 3: Override struggling response with Python-built text
    # so the LLM can't hallucinate the offer — offer_detail is used verbatim
    if result.get("intent") == "struggling":
        result["response"] = (
            f"I understand, and I appreciate you sharing that. "
            f"We actually have {payload['offer_detail']} that might help — would you like to hear more about it?"
        )
        result["next_action"] = "advance_stage"

    return result


def classify_offer_intent(transcript, awaiting_clarification, offer_detail):
    """Call 1 — tiny classification-only prompt. No response generation."""
    prompt = f"""
Offer: {offer_detail}
Customer said: "{transcript}"
Awaiting clarification from previous turn: {awaiting_clarification}

What is the customer doing? Pick exactly one:
- QUESTION: asking anything (starts with what/how/why/who/when, ends with ?, or is phrased as a query)
- YES: agreeing to the offer (yes/ok/sure/go ahead/let's do it/sounds good/I'd like that/that works/alright)
- NO: refusing (no/I'll manage/not interested/I'm fine/don't need it)
- HUMAN: wants to speak to someone (connect me/transfer/speak to someone/talk to him/put me through)
- UPSET: distressed or disputing account details

If QUESTION and awaiting_clarification is True → return CLARIFICATION_YES instead of YES.

Return JSON only: {{"intent": "QUESTION|YES|NO|HUMAN|UPSET|CLARIFICATION_YES"}}
"""
    return call_llm(prompt)


def generate_offer_response(intent_code, transcript, offer_detail, intervention_method=None, specialist=None):
    """Call 2 — hardcoded for most intents, LLM only for questions."""
    if specialist is None:
        if intervention_method is None:
            specialist = "our support team"
        else:
            specialist_map = {
                "payment_holiday":      "our payments team who will activate that for you right away",
                "restructuring":        "our restructuring specialist who will get that sorted for you",
                "financial_counseling": "one of our financial advisors for a free personalised session",
                "rm_call":              "your relationship manager who can discuss personalised options with you directly",
            }
            specialist = specialist_map.get(intervention_method, "our support team")

    responses = {
        "YES": f"Perfect, let me connect you with {specialist}.",
        "NO": "Absolutely no pressure — let me share one quick tip that might help.",
        "HUMAN": "Of course, I'll connect you right away.",
        "CLARIFICATION_YES": "Would you like to go ahead with this option?",
        "UPSET": "I understand — let me get someone to help you right away.",
    }

    if intent_code == "QUESTION":
        prompt = f"""
Customer asked: "{transcript}"
Answer using ONLY this information: {offer_detail}
If the question is NOT about the offer (e.g. credit score, interest, legal), say:
"That's a great question — a specialist can walk you through that. Want me to connect you?"
Otherwise answer in one sentence and end with "Does that help clarify things?"
Return JSON only: {{"response": "str", "about_offer": true|false}}
"""
        result = call_llm(prompt)
        return result.get("response", "Does that help clarify things?"), result.get("about_offer", True)

    return responses.get(intent_code, "Just to confirm — would you like to go ahead with this option?"), None


def offer_stage(transcript, history, payload, stress):
    history_text = format_history(history)
    last_intent = payload.get("last_intent", "")
    awaiting_clarification = last_intent == "question_offer"

    # Step 1 — classify intent with tiny prompt
    classification = classify_offer_intent(
        transcript,
        awaiting_clarification,
        payload["offer_detail"]
    )
    intent_code = classification.get("intent", "QUESTION")

    # Step 2 — generate response
    response_text, about_offer = generate_offer_response(
        intent_code,
        transcript,
        payload["offer_detail"],
        payload.get("intervention_method"),
        payload.get("specialist"),
    )

    # Step 3 — map to output format
    intent_map = {
        "YES": ("accepts_offer", "escalate_analyst", "accepted_restructuring"),
        "NO": ("declines_offer", "advance_stage", None),
        "HUMAN": ("wants_counsellor", "escalate_human", "counsellor_requested"),
        "UPSET": ("distressed", "escalate_urgent", None),
        "QUESTION": ("question_offer", "continue", None),
        "CLARIFICATION_YES": ("unclear", "continue", None),
    }

    intent, next_action, outcome = intent_map.get(
        intent_code, ("unclear", "continue", None)
    )

    # If question was outside the offer, redirect to specialist
    if intent_code == "QUESTION" and about_offer is False:
        intent = "question_other"
        next_action = "escalate_human"
        outcome = "counsellor_requested"

    return {
        "intent": intent,
        "next_action": next_action,
        "outcome": outcome,
        "response": response_text,
        "reasoning": intent_code,
    }


def tips_stage(transcript, history, payload, stress):
    history_text = format_history(history)

    prompt = f"""
You are Maya, a Barclays support agent.
Customer: {payload["customer_name"]}
The customer declined the offer. Your job: give a tip, then ask about a financial advisor.

Conversation so far:
{history_text}

Customer just said: "{transcript}"

Decide which applies:

1. If customer says YES to advisor (yes/sure/ok/why not) →
   Response: "I'll connect you with one of our financial advisors now."
   intent: wants_counsellor, next_action: escalate_counsellor, outcome: counsellor_requested

2. If customer says NO (no thanks/I'm fine/I'll manage) →
   Wish them well warmly. One sentence.
   intent: declines_all, next_action: close_call, outcome: declined_gracefully

3. If you haven't given a tip yet in this conversation →
   Give ONE practical tip (spending tracker, review subscriptions, check direct debits).
   Then ask: "Would it help to speak with a financial advisor?"
   intent: tip_given, next_action: continue, outcome: null

4. If distressed or upset → intent: distressed, next_action: escalate_urgent

NEVER SAY: default, risk, flagged, collections, overdue, missed payment
Max 2 sentences. Warm and human.

Return JSON only:
{{
    "intent": "wants_counsellor | declines_all | tip_given | distressed | unclear",
    "next_action": "escalate_counsellor | close_call | continue | escalate_urgent",
    "outcome": "counsellor_requested | declined_gracefully | null",
    "response": "str",
    "reasoning": "str"
}}
"""
    return call_llm(prompt)


def run_stage(stage, transcript, history, payload, stress):
    if stage == "opening":
        return opening_stage(transcript, history, payload, stress)
    elif stage == "offer_presented":
        return offer_stage(transcript, history, payload, stress)
    elif stage == "tips_presented":
        return tips_stage(transcript, history, payload, stress)
    else:
        # Fallback if somehow out of bounds
        return opening_stage(transcript, history, payload, stress)
