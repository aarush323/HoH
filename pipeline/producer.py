import csv
import json
import time
from kafka import KafkaProducer
import redis
import os
from dotenv import load_dotenv

load_dotenv()

KAFKA_TOPIC = "customer-weekly-observations"
KAFKA_BROKER = "127.0.0.1:9093"
CSV_FILE = "pipeline/pre_delinquency_dataset.csv"
DELAY_SECONDS = 2.0
DEMO_CUSTOMERS = {"C00002"}

REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
SENT_KEY = "producer:sent_customers"

redis_client = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)


def _already_sent(customer_id: str, week: str) -> bool:
    """Check if this customer+week was already sent."""
    try:
        return bool(redis_client.sismember(SENT_KEY, f"{customer_id}:{week}"))
    except Exception:
        return False


def _mark_sent(customer_id: str, week: str):
    """Mark customer+week as sent in Redis."""
    try:
        redis_client.sadd(SENT_KEY, f"{customer_id}:{week}")
        redis_client.expire(SENT_KEY, 86400)
    except Exception as e:
        print(f"[Producer] Redis mark_sent failed: {e}")


def _notify_sse():
    """Notify SSE clients via Redis pub/sub."""
    try:
        redis_client.publish("sse:updates", "refresh")
    except Exception as e:
        print(f"[Producer] Redis publish failed: {e}")


def run_producer(limit_customers=None):
    """
    Streams weekly observations into Kafka.
    If limit_customers is provided (list), it only sends data for those customers.
    """
    producer = KafkaProducer(
        bootstrap_servers=KAFKA_BROKER,
        value_serializer=lambda v: json.dumps(v).encode("utf-8"),
        api_version=(2, 0, 2),
    )

    # Use the demo customers if none provided (legacy compatibility)
    target_customers = (
        limit_customers if limit_customers is not None else DEMO_CUSTOMERS
    )

    print(f"[Producer] Streaming '{CSV_FILE}' to Kafka...")

    sent = 0
    skipped = 0
    with open(CSV_FILE, newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if target_customers and row["customer_id"] not in target_customers:
                continue

            customer_id = row["customer_id"]
            week = row["observation_week"]

            if _already_sent(customer_id, week):
                skipped += 1
                continue

            message = {
                "customer_id": customer_id,
                "observation_week": week,
                "event_timestamp": week,
                "source": "dataset_seed",
                "age": int(row["age"]),
                "customer_segment": row["customer_segment"],
                "geography_zone": row["geography_zone"],
                "product_type": row["product_type"],
                "account_vintage_months": int(row["account_vintage_months"]),
                "emi_to_income_ratio": float(row["emi_to_income_ratio"]),
                "salary_delay_days": int(row["salary_delay_days"]),
                "salary_drop_pct": float(row["salary_drop_pct"]),
                "avg_daily_balance_inr": float(row["avg_daily_balance_inr"]),
                "balance_trend_pct": float(row["balance_trend_pct"]),
                "net_cashflow_ratio": float(row["net_cashflow_ratio"]),
                "savings_drawdown_pct": float(row["savings_drawdown_pct"]),
                "savings_withdrawal_count": int(row["savings_withdrawal_count"]),
                "utility_payment_delay_days": int(row["utility_payment_delay_days"]),
                "num_bills_paid_late_last_4w": int(row["num_bills_paid_late_last_4w"]),
                "discretionary_spend_inr": float(row["discretionary_spend_inr"]),
                "discretionary_vs_4w_avg_pct": float(
                    row["discretionary_vs_4w_avg_pct"]
                ),
                "gambling_lottery_spend_inr": float(row["gambling_lottery_spend_inr"]),
                "gambling_4w_change_pct": float(row["gambling_4w_change_pct"]),
                "upi_to_lending_apps_count": int(row["upi_to_lending_apps_count"]),
                "upi_to_lending_apps_amount_inr": float(
                    row["upi_to_lending_apps_amount_inr"]
                ),
                "atm_vs_4w_avg_pct": float(row["atm_vs_4w_avg_pct"]),
                "auto_debit_failures": int(row["auto_debit_failures"]),
                "credit_card_utilization_pct": float(
                    row["credit_card_utilization_pct"]
                ),
                "credit_inquiries_last_30d": int(row["credit_inquiries_last_30d"]),
                "paying_minimum_only_flag": bool(int(row["paying_minimum_only_flag"])),
                "mobile_app_logins": int(row["mobile_app_logins"]),
                "financial_stress_queries": int(row["financial_stress_queries"]),
                "customer_service_calls": int(row["customer_service_calls"]),
                "will_default_next_2_4_weeks": bool(
                    int(row["will_default_next_2_4_weeks"])
                ),
                # --- NEW ML FIELDS ---
                "monthly_income_inr": float(row["monthly_income_inr"]),
                "emi_amount_inr": float(row["emi_amount_inr"]),
                "emi_due_this_week": bool(int(row["emi_due_this_week"])),
                "available_funds_inr": float(row["available_funds_inr"]),
                "emi_paid_flag": bool(int(row["emi_paid_flag"])),
                "emi_bounced_flag": bool(int(row["emi_bounced_flag"])),
                "missed_emi_count_rolling": int(row["missed_emi_count_rolling"]),
                "balance_velocity": float(row["balance_velocity"]),
                "salary_delay_delta": float(row["salary_delay_delta"]),
                "discretionary_velocity": float(row["discretionary_velocity"]),
                "upi_lending_delta": float(row["upi_lending_delta"]),
                "savings_drawdown_velocity": float(row["savings_drawdown_velocity"]),
                "external_shock_flag": bool(int(row["external_shock_flag"])),
                "shock_type": row["shock_type"],
            }
            producer.send(KAFKA_TOPIC, value=message)
            _mark_sent(customer_id, week)
            time.sleep(DELAY_SECONDS)
            sent += 1
            if sent % 100 == 0:
                print(f"[Producer] Sent {sent} messages...")

    producer.flush()

    if sent > 0:
        _notify_sse()

    print(f"[Producer] Completed. Sent {sent} messages, skipped {skipped} duplicates.")
    return sent


if __name__ == "__main__":
    run_producer()
