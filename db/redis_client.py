import os
import redis
from dotenv import load_dotenv

load_dotenv()

REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD", None)

client = redis.Redis(
    host=REDIS_HOST,
    port=REDIS_PORT,
    password=REDIS_PASSWORD,
    decode_responses=True
)

# All TTLs in one place — never hardcode these elsewhere
REDIS_TTL = {
    "feature":              7 * 24 * 3600,   # 7 days
    "risk_score":           24 * 3600,        # 24 hours
    "llm_context":          3600,             # 1 hour
    "stress_session":       6 * 3600,         # 6 hours
    "intervention_lock":    48 * 3600,        # 48 hours
    "hardstop":             None,             # permanent — no EXPIRE ever
    "risk_leaderboard":     48 * 3600,        # 48 hours
}

def get_client():
    return client

def test_connection():
    try:
        client.ping()
        print(f"Redis connected. Host: {REDIS_HOST}:{REDIS_PORT}")
        print(f"TTL constants loaded: {list(REDIS_TTL.keys())}")
    except Exception as e:
        print(f"Redis connection failed: {e}")

if __name__ == "__main__":
    test_connection()
