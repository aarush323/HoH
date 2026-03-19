import csv
import json
import time
from kafka import KafkaProducer

KAFKA_TOPIC = "customer-weekly-observations"
KAFKA_BROKER = "localhost:9092"
CSV_FILE = "pre_delinquency_dataset.csv"  # put this in the same folder
DELAY_SECONDS = 0.05  # 50ms between messages — adjust to taste

producer = KafkaProducer(
    bootstrap_servers=KAFKA_BROKER,
    value_serializer=lambda v: json.dumps(v).encode("utf-8"),
)

print(f"[Producer] Connected to Kafka. Streaming '{CSV_FILE}' → topic '{KAFKA_TOPIC}'...")

sent = 0
with open(CSV_FILE, newline="") as f:
    reader = csv.DictReader(f)
    for row in reader:
        # Cast numeric fields from string
        message = {
            "customer_id":                  row["customer_id"],
            "event_timestamp":              row["observation_week"],  # Feast needs this
            "age":                          int(row["age"]),
            "customer_segment":             row["customer_segment"],
            "geography_zone":               row["geography_zone"],
            "product_type":                 row["product_type"],
            "account_vintage_months":       int(row["account_vintage_months"]),
            "emi_to_income_ratio":          float(row["emi_to_income_ratio"]),
            "salary_delay_days":            int(row["salary_delay_days"]),
            "salary_drop_pct":              float(row["salary_drop_pct"]),
            "avg_daily_balance_inr":        float(row["avg_daily_balance_inr"]),
            "balance_trend_pct":            float(row["balance_trend_pct"]),
            "net_cashflow_ratio":           float(row["net_cashflow_ratio"]),
            "savings_drawdown_pct":         float(row["savings_drawdown_pct"]),
            "savings_withdrawal_count":     int(row["savings_withdrawal_count"]),
            "utility_payment_delay_days":   int(row["utility_payment_delay_days"]),
            "num_bills_paid_late_last_4w":  int(row["num_bills_paid_late_last_4w"]),
            "discretionary_spend_inr":      float(row["discretionary_spend_inr"]),
            "discretionary_vs_4w_avg_pct":  float(row["discretionary_vs_4w_avg_pct"]),
            "gambling_lottery_spend_inr":   float(row["gambling_lottery_spend_inr"]),
            "gambling_4w_change_pct":       float(row["gambling_4w_change_pct"]),
            "upi_to_lending_apps_count":    int(row["upi_to_lending_apps_count"]),
            "upi_to_lending_apps_amount_inr": float(row["upi_to_lending_apps_amount_inr"]),
            "atm_vs_4w_avg_pct":            float(row["atm_vs_4w_avg_pct"]),
            "auto_debit_failures":          int(row["auto_debit_failures"]),
            "credit_card_utilization_pct":  float(row["credit_card_utilization_pct"]),
            "credit_inquiries_last_30d":    int(row["credit_inquiries_last_30d"]),
            "paying_minimum_only_flag":     int(row["paying_minimum_only_flag"]),
            "mobile_app_logins":            int(row["mobile_app_logins"]),
            "financial_stress_queries":     int(row["financial_stress_queries"]),
            "customer_service_calls":       int(row["customer_service_calls"]),
            "will_default_next_2_4_weeks":  int(row["will_default_next_2_4_weeks"]),
        }

        producer.send(KAFKA_TOPIC, value=message)
        sent += 1

        if sent % 1000 == 0:
            print(f"[Producer] Sent {sent} messages...")

        # time.sleep(DELAY_SECONDS)

producer.flush()
print(f"[Producer] Done. Total messages sent: {sent}")