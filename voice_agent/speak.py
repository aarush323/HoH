import os
import asyncio
import logging
import pygame
import edge_tts
import concurrent.futures
from groq import Groq

logger = logging.getLogger(__name__)

try:
    pygame.mixer.init()
except Exception as e:
    logger.error(f"Failed to initialize pygame mixer: {e}")

client = Groq()

def _groq_tts(text: str, temp_file: str) -> bool:
    try:
        response = client.audio.speech.create(
            model="canopylabs/orpheus-v1-english",
            voice="leah",
            input=text,
        )
        response.stream_to_file(temp_file)
        return True
    except Exception as e:
        logger.error(f"Groq TTS failed: {e}")
        return False

async def _synthesize_edge(text: str, temp_file: str) -> bool:
    """
    Attempts to synthesize speech using Edge TTS.
    """
    try:
        voice = "en-IN-PrabhatNeural"  # Professional Indian male voice
        communicate = edge_tts.Communicate(text, voice)
        await communicate.save(temp_file)
        return True
    except Exception as e:
        logger.error(f"Edge TTS fallback also failed: {e}")
        return False

async def _play_audio(temp_file: str):
    """Plays the given audio file using pygame."""
    try:
        pygame.mixer.music.load(temp_file)
        pygame.mixer.music.play()
        while pygame.mixer.music.get_busy():
            await asyncio.sleep(0.1)
    finally:
        pygame.mixer.music.unload()

async def _synthesize_and_play(text: str):
    temp_file = "temp_agent_audio.mp3"

    try:
        success = _groq_tts(text, temp_file)
        
        # Fall back to Edge TTS if Groq failed (e.g. model decommissioned)
        if not success:
            logger.warning("Falling back to Edge TTS...")
            success = await _synthesize_edge(text, temp_file)

        if success and os.path.exists(temp_file):
            await _play_audio(temp_file)
        else:
            logger.error("Both TTS engines failed. No audio played.")

    finally:
        if os.path.exists(temp_file):
            try:
                os.remove(temp_file)
            except Exception:
                pass

def speak(text: str):
    """
    Synthesizes and plays text using Groq PlayAI TTS with Edge fallback.
    """
    print(f"\n [AGENT SPEAKS]: \"{text}\" \n")
    logger.info(f"Agent spoke: {text}")
    try:
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = None
            
        if loop and loop.is_running():
            with concurrent.futures.ThreadPoolExecutor() as pool:
                future = pool.submit(asyncio.run, _synthesize_and_play(text))
                future.result()
        else:
            asyncio.run(_synthesize_and_play(text))
    except Exception as e:
        logger.error(f"TTS Failed: {e}")

