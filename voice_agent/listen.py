import os
import io
import wave
import logging
import collections
import numpy as np
import sounddevice as sd
from pydub import AudioSegment

logger = logging.getLogger(__name__)

# Config
SAMPLE_RATE = 16000
CHANNELS = 1
SILENCE_THRESHOLD = 0.45
SILENCE_DURATION = 1.5  # Seconds of silence before stopping
MIN_SPEECH_CHUNKS = 2   # 2 consecutive chunks to confirm speech started
PRE_ROLL_CHUNKS = 5     # 500ms pre-roll to catch beginning of words

def listen() -> str:
    """
    Listens to the microphone until the user stops speaking.
    Uses a robust VAD with pre-roll buffer to prevent cutoff and false starts.
    Returns path to a temporary wav file.
    """
    logger.info("Listening...")
    print("\n [Listening... Speak now]")
    
    audio_data = []
    pre_roll_buffer = collections.deque(maxlen=PRE_ROLL_CHUNKS)
    
    silent_chunks = 0
    speech_chunks = 0
    chunk_size = int(SAMPLE_RATE * 0.1) # 100ms chunks
    
    with sd.InputStream(samplerate=SAMPLE_RATE, channels=CHANNELS, dtype='float32') as stream:
        started_speaking = False
        
        while True:
            chunk, overflowed = stream.read(chunk_size)
            if overflowed:
                logger.warning("Audio buffer overflow")
                
            volume = np.max(np.abs(chunk))
            
            if not started_speaking:
                # Still waiting to confirm speech
                if volume > SILENCE_THRESHOLD:
                    speech_chunks += 1
                else:
                    speech_chunks = 0
                    
                pre_roll_buffer.append(chunk)
                
                if speech_chunks >= MIN_SPEECH_CHUNKS:
                    # Confirmed speech!
                    started_speaking = True
                    silent_chunks = 0
                    status = "SPEAKING"
                    # Dump pre-roll into main audio data so we don't lose the start
                    audio_data.extend(pre_roll_buffer)
                    pre_roll_buffer.clear()
                else:
                    status = "SILENT"
            else:
                # We are officially recording speech
                audio_data.append(chunk)
                
                if volume > SILENCE_THRESHOLD:
                    # They are currently speaking loudly enough
                    silent_chunks = 0
                    status = "SPEAKING"
                    print("\n[Speech spike detected!]")
                else:
                    # They paused/stopped
                    silent_chunks += 1
                    status = "SILENCE..."
                    
            print(f"\r[MIC LEVEL: {volume:.4f} | THRESHOLD: {SILENCE_THRESHOLD} | STATUS: {status}]", end="", flush=True)

            # Stopping condition
            if started_speaking and (silent_chunks * 0.1) > SILENCE_DURATION:
                print("\n")
                break
                
    print(" [Finished listening]")
    
    # Handle the extremely rare case where no speech was captured
    if not audio_data:
        logger.warning("No audio was recorded.")
        # Just create an empty/silent buffer so it doesn't crash later
        audio_data.append(np.zeros((chunk_size, 1), dtype='float32'))
    
    # Flatten and convert to 16-bit PCM
    audio_np = np.concatenate(audio_data, axis=0)
    audio_int16 = (audio_np * 32767).astype(np.int16)
    
    # Save to temp file
    temp_file = "temp_user_audio.wav"
    with wave.open(temp_file, 'wb') as wf:
        wf.setnchannels(CHANNELS)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes(audio_int16.tobytes())
        
    return temp_file
