import re
import logging

logger = logging.getLogger(__name__)

FORBIDDEN = [
    "delinquent", "default", "overdue", "collections",
    "missed payment", "risk score", "flagged", "model",
    "stress", "delinquency", "credit score", "bureau"
]

AMOUNT_PATTERN = re.compile(r'₹[\d,]+|Rs\.?\s*[\d,]+|\d+,\d{3}')

def sanitize(text: str, show_amount: bool) -> tuple[str, bool]:
    flagged = False
    
    for word in FORBIDDEN:
        if word.lower() in text.lower():
            text = re.sub(word, "[removed]", text, flags=re.IGNORECASE)
            flagged = True
            logger.warning(f"Guardrail triggered on forbidden word: {word}")
    
    if not show_amount:
        if AMOUNT_PATTERN.search(text):
            text = AMOUNT_PATTERN.sub("your upcoming payment", text)
            flagged = True
            logger.warning("Guardrail triggered on amount pattern.")
    
    return text, flagged
