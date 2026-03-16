import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from voice_agent.agent import run_call

payload = {
    "customer_name": "Priya",
    "emi_date": "March 22nd",
    "offer_type": "payment_holiday",
    "offer_detail": "a 15-day extension on your upcoming payment",
    "tone": "Empathetic",
    "tone_hints": ["lead with flexibility", "don't rush to the offer"],
    "avoid_topics": ["specific amounts", "other bills"],
    "show_emi_amount": False,
    "max_turns": 3,
    "language_hint": "english",
    "fallback_message": "Let me connect you with someone from our team."
}

try:
    print("Starting mock call...")
    # NOTE: This will block on input() inside listen.py
    # For automated execution, I will patch listen.py first.
except Exception as e:
    print(f"Error: {e}")
