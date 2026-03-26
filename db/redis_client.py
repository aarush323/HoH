import os
import redis
from dotenv import load_dotenv

load_dotenv()

REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD", None)

client = redis.Redis(
    host=REDIS_HOST, port=REDIS_PORT, password=REDIS_PASSWORD, decode_responses=True
)

# All TTLs in one place — never hardcode these elsewhere
REDIS_TTL = {
    "feature": 7 * 24 * 3600,  # 7 days
    "risk_score": 24 * 3600,  # 24 hours
    "llm_context": 3600,  # 1 hour
    "stress_session": 6 * 3600,  # 6 hours
    "intervention_lock": 48 * 3600,  # 48 hours
    "hardstop": None,  # permanent — no EXPIRE ever
    "risk_leaderboard": 48 * 3600,  # 48 hours
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


# ── Helper functions for caching ──────────────────────────────────────────────
import json


def cache_features(customer_id: str, features: dict):
    client.setex(f"features:{customer_id}", REDIS_TTL["feature"], json.dumps(features))


def get_cached_features(customer_id: str) -> dict | None:
    val = client.get(f"features:{customer_id}")
    return json.loads(val) if val else None


def cache_risk_score(customer_id: str, score_data: dict):
    client.setex(f"risk:{customer_id}", REDIS_TTL["risk_score"], json.dumps(score_data))


def get_cached_risk_score(customer_id: str) -> dict | None:
    val = client.get(f"risk:{customer_id}")
    return json.loads(val) if val else None


def cache_session(customer_id: str, session_data: dict):
    client.setex(
        f"session:{customer_id}", REDIS_TTL["stress_session"], json.dumps(session_data)
    )


def get_cached_session(customer_id: str) -> dict | None:
    val = client.get(f"session:{customer_id}")
    return json.loads(val) if val else None


def invalidate_customer(customer_id: str):
    """Call when fresh Kafka data arrives — forces recompute on next score request."""
    client.delete(f"features:{customer_id}")
    client.delete(f"risk:{customer_id}")
    client.delete(f"session:{customer_id}")


# ── SSE Pub/Sub helpers ────────────────────────────────────────────────────────
CHANNEL_SSE = "sse:updates"


def publish_update():
    """Call after successful ingest - wakes up all SSE listeners."""
    client.publish(CHANNEL_SSE, "refresh")


def subscribe_updates():
    """Returns pubsub object. Caller must close it after use."""
    pubsub = client.pubsub()
    pubsub.subscribe(CHANNEL_SSE)
    return pubsub


def publish_event(event: dict):
    """Publish a granular dict event to the SSE channel."""
    client.publish(CHANNEL_SSE, json.dumps(event))
