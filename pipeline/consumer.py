import json
from kafka import KafkaConsumer

KAFKA_TOPIC = "customer-weekly-observations"
KAFKA_BROKER = "localhost:9092"

consumer = KafkaConsumer(
    KAFKA_TOPIC,
    bootstrap_servers=KAFKA_BROKER,
    auto_offset_reset="earliest",       # start from beginning of topic
    enable_auto_commit=True,
    group_id="pre-delinquency-consumer",
    value_deserializer=lambda m: json.loads(m.decode("utf-8")),
)

print(f"[Consumer] Listening on topic '{KAFKA_TOPIC}'...\n")

def insert_into_db(record: dict):
    """
    TODO: Replace with actual DB insertion.
    Options:
      - PostgreSQL : use psycopg2 or asyncpg
      - Cassandra  : use cassandra-driver
    """
    pass  # ← swap this out once DB is decided

for message in consumer:
    record = message.value

    # ── Print to terminal ───────────────────────────────────────────────────
    print(f"[{record['event_timestamp']}] customer={record['customer_id']} | "
          f"salary_delay={record['salary_delay_days']}d | "
          f"balance=₹{record['avg_daily_balance_inr']:,.0f} | "
          f"auto_debit_failures={record['auto_debit_failures']} | "
          f"default_risk={record['will_default_next_2_4_weeks']}")

    # ── DB insertion (pluggable) ────────────────────────────────────────────
    insert_into_db(record)