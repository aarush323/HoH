import logging
import time
from typing import Callable, Optional
from . import strategy
from .speak import speak
from .listen import listen
from .transcribe import transcribe
from .classify import run_stage
from .guardrail import sanitize
from .utils import (
    setup_logger,
    log_guardrail_trigger,
    update_trajectory,
    check_trajectory,
    determine_outcome,
    extract_topics,
)

logger = setup_logger(__name__)


def _default_emit(event: str, data: dict):
    """Default no-op emit function."""
    pass


def advance_stage(current_stage: str) -> str:
    order = ["opening", "offer_presented", "tips_presented"]
    idx = order.index(current_stage)
    return order[min(idx + 1, len(order) - 1)]


def run_loop(
    voice_payload: dict,
    call_strategy: dict,
    call_state: dict,
    emit_fn: Callable[[str, dict], None] = None,
) -> dict:
    if emit_fn is None:
        emit_fn = _default_emit

    while call_state["turn"] < voice_payload["max_turns"]:
        # 1. Emit listening state
        emit_fn(
            "listening", {"status": "waiting_for_speech", "turn": call_state["turn"]}
        )

        # 1. Listen for user audio
        audio = listen()

        # 2. Transcribe and check quality
        transcript = transcribe(audio)

        print(f'\n [USER SAID]: "{transcript["text"]}"')
        print(f"[TRANSCRIPT QUALITY]: {transcript['quality']}\n")

        # Emit transcript event
        emit_fn(
            "transcript",
            {
                "text": transcript["text"],
                "quality": transcript["quality"],
                "turn": call_state["turn"],
            },
        )

        if transcript["quality"] == "low":
            speak("Sorry, could you say that once more?")
            emit_fn("agent_speaking", {"text": "Sorry, could you say that once more?"})
            time.sleep(0.4)
            call_state["consecutive_unclear"] += 1
            if call_state["consecutive_unclear"] >= 2:
                fallback_msg = voice_payload.get(
                    "fallback_message", "Let me connect you with someone who can help."
                )
                speak(fallback_msg)
                emit_fn("agent_speaking", {"text": fallback_msg})
                time.sleep(0.4)
                call_state["exit_reason"] = "unclear_streak"
                emit_fn("escalation", {"reason": "unclear_streak", "triggered": True})
                break
            continue  # Turn counter NOT incremented

        call_state["consecutive_unclear"] = 0
        call_state["transcript_history"].append(transcript["text"])

        # Pass last intent for awaiting_clarification logic
        voice_payload["last_intent"] = (
            call_state["intent_history"][-1] if call_state["intent_history"] else ""
        )

        # 3. Route to correct stage function
        result = run_stage(
            stage=call_state["stage"],
            transcript=transcript["text"],
            history=call_state["transcript_history"],
            payload=voice_payload,
            stress=voice_payload["stress"],
        )

        intent = result.get("intent", "unclear")
        next_action = result.get("next_action", "continue")

        print(
            f"[DEBUG] Stage: {call_state['stage']} | Intent: {intent} | Next: {next_action}"
        )

        # Emit intent detection
        emit_fn(
            "intent_detected",
            {
                "intent": intent,
                "next_action": next_action,
                "stage": call_state["stage"],
            },
        )

        call_state["intent_history"].append(intent)
        call_state["sentiment_trajectory"] = update_trajectory(
            call_state["intent_history"]
        )

        # 4. Guardrail Sanitization
        clean_response, was_flagged = sanitize(
            text=result.get("response", "Sorry, I missed that."),
            show_amount=voice_payload.get("show_emi_amount", False),
        )

        if was_flagged:
            clean_response = voice_payload.get(
                "fallback_message", "Let me connect you with someone who can help."
            )
            log_guardrail_trigger(result.get("response", ""), call_state["turn"])
            emit_fn(
                "guardrail_triggered",
                {
                    "original": result.get("response", ""),
                    "replaced_with": clean_response,
                },
            )

        speak(clean_response)

        # Emit agent speaking
        emit_fn("agent_speaking", {"text": clean_response})

        time.sleep(0.4)

        # 5. Act on next_action
        if next_action == "close_call":
            call_state["outcome"] = result.get("outcome", "resolved")
            emit_fn(
                "call_closing",
                {"reason": "customer_resolved", "outcome": call_state["outcome"]},
            )
            break

        if next_action == "escalate_urgent":
            call_state["outcome"] = "escalated"
            call_state["exit_reason"] = result.get("intent", "unclear")
            emit_fn(
                "escalation", {"reason": call_state["exit_reason"], "triggered": True}
            )
            break

        if next_action == "escalate_analyst":
            call_state["outcome"] = "accepted_restructuring"
            call_state["exit_reason"] = "accepted_restructuring"
            emit_fn(
                "escalation", {"reason": "accepted_restructuring", "triggered": True}
            )
            break

        if next_action == "escalate_counsellor":
            call_state["outcome"] = "counsellor_requested"
            call_state["exit_reason"] = "requested_advisor"
            emit_fn("escalation", {"reason": "counsellor_requested", "triggered": True})
            break

        if next_action == "escalate_human":
            call_state["outcome"] = result.get("outcome", "escalated")
            call_state["exit_reason"] = "human_requested"
            emit_fn("escalation", {"reason": "human_requested", "triggered": True})
            break

        if next_action == "continue":
            logger.debug(
                f"[LOOP] Staying in stage: {call_state['stage']} | Intent: {intent}"
            )

        if next_action == "advance_stage":
            old_stage = call_state["stage"]
            call_state["stage"] = advance_stage(call_state["stage"])
            if call_state["stage"] == "offer_presented":
                call_state["offer_introduced"] = True
            emit_fn("stage_change", {"from": old_stage, "to": call_state["stage"]})

        call_state["turn"] += 1

    return build_result(call_state)


def build_result(call_state: dict) -> dict:
    escalation_reasons = {
        "accepted_restructuring": "Accepted offer — needs restructuring specialist",
        "requested_advisor": "Declined offer — requested financial counsellor",
        "human_requested": "Mid-call explicit human request",
        "escalate_urgent": "Distressed or dispute",
        "escalate_distressed": "Distressed or dispute",
        "escalate_dispute": "Distressed or dispute",
        "unclear_streak": "Too many unclear responses",
    }
    exit_reason = call_state.get("exit_reason")

    return {
        "escalate": exit_reason in escalation_reasons,
        "escalate_reason": exit_reason,
        "escalate_description": escalation_reasons.get(exit_reason),
        "outcome": call_state.get(
            "outcome", determine_outcome(call_state["intent_history"])
        ),
        "turns_taken": call_state["turn"],
        "language_detected": call_state.get("language_detected", "english"),
        "call_memory": {
            "intent_history": call_state["intent_history"],
            "sentiment_trajectory": call_state.get("sentiment_trajectory", "stable"),
            "offer_accepted": "accepts_offer" in call_state["intent_history"],
            "topics_raised": extract_topics(call_state["transcript_history"]),
            "hinglish_preferred": call_state.get("language_detected") == "hinglish",
        },
    }


def run_call(voice_payload: dict, emit_fn: Callable[[str, dict], None] = None) -> dict:
    """
    Single entry point. LangGraph calls this.
    Returns structured result dict.

    Args:
        voice_payload: Dictionary containing call parameters
        emit_fn: Optional callback for SSE event emission. If provided, events
                 will be streamed to connected clients.
    """
    if emit_fn is None:
        emit_fn = _default_emit

    logger.info("Initializing Voice Agent Call...")

    # Emit call start
    emit_fn(
        "call_start",
        {
            "customer_name": voice_payload.get("customer_name", "Customer"),
            "offer_type": voice_payload.get("offer_type", "unknown"),
            "timestamp": time.time(),
        },
    )

    # 1. Build strategy — one Groq call
    call_strategy = strategy.build(voice_payload)

    # 2. Speak opening
    opening_text = call_strategy.get(
        "opening", "Hello, checking in on your upcoming payment."
    )
    speak(opening_text)

    # Emit agent speaking
    emit_fn("agent_speaking", {"text": opening_text})
    time.sleep(0.4)

    # 3. Initialize state and run the loop
    call_state = {
        "stage": "opening",
        "turn": 0,
        "transcript_history": [],
        "intent_history": [],
        "consecutive_unclear": 0,
        "language_detected": voice_payload.get("language_hint", "english"),
        "exit_reason": None,
        "offer_introduced": False,
        "outcome": None,
    }

    result = run_loop(voice_payload, call_strategy, call_state, emit_fn)

    # Emit final result
    emit_fn("call_complete", result)
    logger.info(f"Voice call complete. Result: {result}")

    return result
