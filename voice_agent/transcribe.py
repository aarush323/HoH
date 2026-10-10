import os
import logging
from groq import Groq
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

_groq_client = None


def _groq_client_or_none():
    global _groq_client
    if _groq_client is not None:
        return _groq_client
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        return None
    _groq_client = Groq(api_key=api_key)
    return _groq_client


def quality_check(text: str) -> str:
    words = text.strip().split()
    
    # Too short to be meaningful
    if len(words) < 2:
        return "low"
    
    # Whisper hallucination patterns — it does this on silence
    HALLUCINATIONS = [
        "thank you", "thanks for watching", "bye bye",
        "please subscribe", ".", "thank You.", "Thank you.",
        "Thanks.", "Bye.", "Amém", "Amen"
    ]
    if text.strip().lower() in HALLUCINATIONS:
        return "low"
    
    return "ok"

def transcribe(audio_path: str) -> dict:
    """
    Transcribes actual audio file using Groq's Whisper API.
    """
    logger.info("Transcribing audio...")
    client = _groq_client_or_none()
    if client is None:
        logger.warning("GROQ_API_KEY not set; transcription unavailable")
        return {"text": "", "quality": "low"}

    try:
        with open(audio_path, "rb") as file:
            transcription = client.audio.transcriptions.create(
              file=(audio_path, file.read()),
              model="whisper-large-v3",
              response_format="json",
              language="en",
              temperature=0.0,
              prompt="The speaker is Indian, speaking clear Indian English. Proper nouns include: PICT, Aarush, Rahul, Barclays, EMI."
            )
            
        transcript_text = transcription.text
        logger.info(f"Transcription: {transcript_text}")
        
    except Exception as e:
        logger.error(f"Transcription failed: {e}")
        transcript_text = ""
        
    finally:
        # Clean up temp file
        if os.path.exists(audio_path):
            try:
                pass
                #os.remove(audio_path)
            except:
                pass
                
    quality = quality_check(transcript_text)
    
    return {
        "text": transcript_text,
        "quality": quality
    }
