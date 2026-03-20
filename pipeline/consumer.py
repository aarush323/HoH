import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import json
from datetime import datetime
from kafka import KafkaConsumer
from db.postgres import get_connection
from db.cassandra_component import get_session
from sqlalchemy import text

KAFKA_TOPIC = "customer-weekly-observations"
KAFKA_BROKER = "localhost:9092"

consumer = KafkaConsumer(
    KAFKA_TOPIC,
    bootstrap_servers=KAFKA_BROKER,
    auto_offset_reset="earliest",
    enable_auto_commit=True,
    group_id="pre-delinquency-consumer",
    value_deserializer=lambda m: json.loads(m.decode("utf-8")),
)

cassandra_session = get_session()

print(f"[Consumer] Listening on topic '{KAFKA_TOPIC}'...\n")


def insert_into_postgres(record: dict):
    with get_connection() as conn:
        conn.execute(text("""
            INSERT INTO raw_observations_staging (
                customer_id, observation_week, age, customer_segment,
                geography_zone, product_type, account_vintage_months,
                emi_to_income_ratio, salary_delay_days, salary_drop_pct,
                avg_daily_balance_inr, balance_trend_pct, net_cashflow_ratio,
                savings_drawdown_pct, savings_withdrawal_count,
                utility_payment_delay_days, num_bills_paid_late_last_4w,
                discretionary_spend_inr, discretionary_vs_4w_avg_pct,
                gambling_lottery_spend_inr, gambling_4w_change_pct,
                upi_to_lending_apps_count, upi_to_lending_apps_amount_inr,
                atm_vs_4w_avg_pct, auto_debit_failures,
                credit_card_utilization_pct, credit_inquiries_last_30d,
                paying_minimum_only_flag, mobile_app_logins,
                financial_stress_queries, customer_service_calls,
                will_default_next_2_4_weeks
            ) VALUES (
                :customer_id, :observation_week, :age, :customer_segment,
                :geography_zone, :product_type, :account_vintage_months,
                :emi_to_income_ratio, :salary_delay_days, :salary_drop_pct,
                :avg_daily_balance_inr, :balance_trend_pct, :net_cashflow_ratio,
                :savings_drawdown_pct, :savings_withdrawal_count,
                :utility_payment_delay_days, :num_bills_paid_late_last_4w,
                :discretionary_spend_inr, :discretionary_vs_4w_avg_pct,
                :gambling_lottery_spend_inr, :gambling_4w_change_pct,
                :upi_to_lending_apps_count, :upi_to_lending_apps_amount_inr,
                :atm_vs_4w_avg_pct, :auto_debit_failures,
                :credit_card_utilization_pct, :credit_inquiries_last_30d,
                :paying_minimum_only_flag, :mobile_app_logins,
                :financial_stress_queries, :customer_service_calls,
                :will_default_next_2_4_weeks
            )
            ON CONFLICT (customer_id, observation_week) DO NOTHING
        """), record)

        conn.execute(text("""
            INSERT INTO customers (
                customer_id, age, customer_segment, geography_zone,
                product_type, account_vintage_months, emi_to_income_ratio
            ) VALUES (
                :customer_id, :age, :customer_segment, :geography_zone,
                :product_type, :account_vintage_months, :emi_to_income_ratio
            )
            ON CONFLICT (customer_id) DO UPDATE
                SET updated_at = NOW()
        """), record)

        conn.execute(text("""
            INSERT INTO weekly_features (
                customer_id, observation_week, salary_delay_days,
                salary_drop_pct, avg_daily_balance_inr, balance_trend_pct,
                net_cashflow_ratio, savings_drawdown_pct,
                savings_withdrawal_count, utility_payment_delay_days,
                num_bills_paid_late_last_4w, discretionary_spend_inr,
                discretionary_vs_4w_avg_pct, gambling_lottery_spend_inr,
                gambling_4w_change_pct, upi_to_lending_apps_count,
                upi_to_lending_apps_amount_inr, atm_vs_4w_avg_pct,
                auto_debit_failures, credit_card_utilization_pct,
                credit_inquiries_last_30d, paying_minimum_only_flag,
                mobile_app_logins, financial_stress_queries,
                customer_service_calls, will_default_next_2_4_weeks
            ) VALUES (
                :customer_id, :observation_week, :salary_delay_days,
                :salary_drop_pct, :avg_daily_balance_inr, :balance_trend_pct,
                :net_cashflow_ratio, :savings_drawdown_pct,
                :savings_withdrawal_count, :utility_payment_delay_days,
                :num_bills_paid_late_last_4w, :discretionary_spend_inr,
                :discretionary_vs_4w_avg_pct, :gambling_lottery_spend_inr,
                :gambling_4w_change_pct, :upi_to_lending_apps_count,
                :upi_to_lending_apps_amount_inr, :atm_vs_4w_avg_pct,
                :auto_debit_failures, :credit_card_utilization_pct,
                :credit_inquiries_last_30d, :paying_minimum_only_flag,
                :mobile_app_logins, :financial_stress_queries,
                :customer_service_calls, :will_default_next_2_4_weeks
            )
            ON CONFLICT (customer_id, observation_week) DO NOTHING
        """), record)

        conn.commit()


def insert_into_cassandra(record: dict):
    cassandra_session.execute("""
        INSERT INTO weekly_feature_snapshots (
            customer_id, observation_week, salary_delay_days,
            salary_drop_pct, avg_daily_balance_inr, balance_trend_pct,
            net_cashflow_ratio, savings_drawdown_pct,
            savings_withdrawal_count, utility_payment_delay_days,
            num_bills_paid_late_last_4w, discretionary_spend_inr,
            discretionary_vs_4w_avg_pct, gambling_lottery_spend_inr,
            gambling_4w_change_pct, upi_to_lending_apps_count,
            upi_to_lending_apps_amount_inr, atm_vs_4w_avg_pct,
            auto_debit_failures, credit_card_utilization_pct,
            credit_inquiries_last_30d, paying_minimum_only_flag,
            mobile_app_logins, financial_stress_queries,
            customer_service_calls, will_default_next_2_4_weeks,
            source, ingested_at
        ) VALUES (
            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
            %s, %s, %s, %s, %s, %s, %s, %s
        ) IF NOT EXISTS
    """, (
        record["customer_id"],
        datetime.strptime(record["observation_week"], "%Y-%m-%d").date(),
        record["salary_delay_days"],
        record["salary_drop_pct"],
        record["avg_daily_balance_inr"],
        record["balance_trend_pct"],
        record["net_cashflow_ratio"],
        record["savings_drawdown_pct"],
        record["savings_withdrawal_count"],
        record["utility_payment_delay_days"],
        record["num_bills_paid_late_last_4w"],
        record["discretionary_spend_inr"],
        record["discretionary_vs_4w_avg_pct"],
        record["gambling_lottery_spend_inr"],
        record["gambling_4w_change_pct"],
        record["upi_to_lending_apps_count"],
        record["upi_to_lending_apps_amount_inr"],
        record["atm_vs_4w_avg_pct"],
        record["auto_debit_failures"],
        record["credit_card_utilization_pct"],
        record["credit_inquiries_last_30d"],
        bool(record["paying_minimum_only_flag"]),
        record["mobile_app_logins"],
        record["financial_stress_queries"],
        record["customer_service_calls"],
        bool(record["will_default_next_2_4_weeks"]),
        record.get("source", "dataset_seed"),
        datetime.utcnow()
    ))


def insert_into_db(record: dict):
    try:
        insert_into_postgres(record)
    except Exception as e:
        print(f"[Postgres] Insert failed for {record.get('customer_id')}: {e}")

    try:
        insert_into_cassandra(record)
    except Exception as e:
        print(f"[Cassandra] Insert failed for {record.get('customer_id')}: {e}")


for message in consumer:
    record = message.value

    print(f"customer={record['customer_id']} | "
          f"week={record['observation_week']} | "
          f"salary_delay={record['salary_delay_days']}d | "
          f"balance=₹{float(record['avg_daily_balance_inr']):,.0f} | "
          f"auto_debit_failures={record['auto_debit_failures']} | "
          f"default_risk={record['will_default_next_2_4_weeks']}")

    insert_into_db(record)