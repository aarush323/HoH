import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import json
from datetime import datetime
from kafka import KafkaConsumer
from db.postgres import get_connection
from db.cassandra_component import get_session
from sqlalchemy import text
import httpx
from db.redis_client import publish_event

KAFKA_TOPIC = "customer-weekly-observations"
KAFKA_BROKER = "127.0.0.1:9093"

_consumer = None
_cassandra_session = None


def get_consumer():
    global _consumer
    if _consumer is None:
        try:
            _consumer = KafkaConsumer(
                KAFKA_TOPIC,
                bootstrap_servers=KAFKA_BROKER,
                auto_offset_reset="earliest",
                enable_auto_commit=True,
                group_id="pre-delinquency-consumer",
                value_deserializer=lambda m: json.loads(m.decode("utf-8")),
                api_version=(2, 0, 2),
            )
            print(f"[Consumer] Connected to Kafka at {KAFKA_BROKER}")
        except Exception as e:
            print(f"[Consumer] Kafka connection failed: {e}")
            raise
    return _consumer


def get_cassandra_session():
    global _cassandra_session
    if _cassandra_session is None:
        _cassandra_session = get_session()
    return _cassandra_session


STRESS_THRESHOLDS = {
    "salary_delay_days": 3,
    "auto_debit_failures": 2,
    "savings_drawdown_pct": -20.0,
    "utility_payment_delay_days": 3,
}
API_BASE = "http://localhost:8000"


def should_trigger(record: dict) -> bool:
    salary_delay = record.get("salary_delay_days", 0)
    auto_debit = record.get("auto_debit_failures", 0)
    savings_drawdown = record.get("savings_drawdown_pct", 0.0)
    utility_delay = record.get("utility_payment_delay_days", 0)
    emi_bounced = record.get("emi_bounced_flag", False)
    missed_emi = record.get("missed_emi_count_rolling", 0)

    triggered = (
        salary_delay > STRESS_THRESHOLDS["salary_delay_days"]
        or auto_debit >= STRESS_THRESHOLDS["auto_debit_failures"]
        or savings_drawdown < STRESS_THRESHOLDS["savings_drawdown_pct"]
        or utility_delay > STRESS_THRESHOLDS["utility_payment_delay_days"]
        or emi_bounced == True
        or missed_emi >= 2
    )

    print(
        f"[Rules] salary_delay={salary_delay}(>3:{salary_delay > 3}) "
        f"auto_debit={auto_debit}(>=2:{auto_debit >= 2}) "
        f"savings_drawdown={savings_drawdown}(<-20:{savings_drawdown < -20.0}) "
        f"triggered={triggered}"
    )

    return triggered


def fire_intervention(record: dict):
    """Pass raw Kafka message to API — predict() computes score there, not here."""
    try:
        response = httpx.post(
            f"{API_BASE}/intervene/{record['customer_id']}",
            json={"kafka_message": record},
            timeout=120.0,  # voice agent needs time
        )
        print(f"[Trigger] {record['customer_id']} → HTTP {response.status_code}")
    except Exception as e:
        print(f"[Trigger] Failed for {record['customer_id']}: {e}")


def push_event(
    record: dict,
    stage: str,
    triggered: bool | None = None,
    risk_score: float | None = None,
    agent_result: dict | None = None,
):
    """Helper to push granular events to SSE."""
    event = {
        "customer_id": record["customer_id"],
        "stage": stage,
    }
    if stage != "CUSTOMER_DONE":
        event["week"] = record.get("observation_week")

    if triggered is not None:
        event["triggered"] = triggered

    if risk_score is not None:
        event["risk_score"] = risk_score

    # Build structured pipeline_details instead of raw agent_result blob
    if agent_result is not None:
        pipeline_details = {
            "risk_score": agent_result.get("total_risk_score")
            or agent_result.get("risk_score")
            or risk_score
            or 0,
            "risk_level": agent_result.get("risk_level")
            or (
                "HIGH"
                if (agent_result.get("total_risk_score") or 0) >= 0.7
                else "MEDIUM"
                if (agent_result.get("total_risk_score") or 0) >= 0.4
                else "LOW"
            ),
            "lgb_p": agent_result.get("lgb_p"),
            "gru_p": agent_result.get("gru_p"),
            "ensemble_score": agent_result.get("total_risk_score")
            or agent_result.get("risk_score"),
            "top_factors": (agent_result.get("shap_factors") or [])[:5],
            "stress_context": agent_result.get("Stress_context") or {},
            "intervention": {
                "method": agent_result.get("intervention_method") or "",
                "channel": agent_result.get("channel") or "",
                "message": agent_result.get("message_content") or "",
                "justification": agent_result.get("intervention_justification") or "",
            },
            "compliance": {
                "hard_stop": agent_result.get("hard_stop", False),
                "hard_stop_reason": agent_result.get("hard_stop_reason"),
                "eligible_interventions": agent_result.get("eligible_interventions")
                or [],
            },
        }
        event["pipeline_details"] = pipeline_details

    if stage in ["INGEST", "INGEST_TRIGGERED"]:
        event["balance"] = float(record.get("avg_daily_balance_inr", 0))
        event["salary_delay"] = int(record.get("salary_delay_days", 0))
        event["archetype"] = record.get("customer_segment", "Unknown")

    if stage == "OUTREACH":
        if risk_score is not None:
            if risk_score >= 0.7:
                event["global_risk"] = "HIGH"
            elif risk_score >= 0.4:
                event["global_risk"] = "MEDIUM"
            else:
                event["global_risk"] = "LOW"
        else:
            event["global_risk"] = "LOW"

    publish_event(event)


def insert_into_postgres(record: dict):
    with get_connection() as conn:
        conn.execute(
            text("""
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
                will_default_next_2_4_weeks,
                monthly_income_inr, emi_amount_inr, emi_due_this_week,
                available_funds_inr, emi_paid_flag, emi_bounced_flag,
                missed_emi_count_rolling, balance_velocity,
                salary_delay_delta, discretionary_velocity,
                upi_lending_delta, savings_drawdown_velocity,
                external_shock_flag, shock_type
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
                :will_default_next_2_4_weeks,
                :monthly_income_inr, :emi_amount_inr, :emi_due_this_week,
                :available_funds_inr, :emi_paid_flag, :emi_bounced_flag,
                :missed_emi_count_rolling, :balance_velocity,
                :salary_delay_delta, :discretionary_velocity,
                :upi_lending_delta, :savings_drawdown_velocity,
                :external_shock_flag, :shock_type
            )
            ON CONFLICT (customer_id, observation_week) DO NOTHING
        """),
            record,
        )

        conn.execute(
            text("""
            INSERT INTO customers (
                customer_id, age, customer_segment, geography_zone,
                product_type, account_vintage_months, emi_to_income_ratio
            ) VALUES (
                :customer_id, :age, :customer_segment, :geography_zone,
                :product_type, :account_vintage_months, :emi_to_income_ratio
            )
            ON CONFLICT (customer_id) DO UPDATE
                SET updated_at = NOW()
        """),
            record,
        )

        conn.execute(
            text("""
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
                customer_service_calls, will_default_next_2_4_weeks,
                monthly_income_inr, emi_amount_inr, emi_due_this_week,
                available_funds_inr, emi_paid_flag, emi_bounced_flag,
                missed_emi_count_rolling, balance_velocity,
                salary_delay_delta, discretionary_velocity,
                upi_lending_delta, savings_drawdown_velocity,
                external_shock_flag, shock_type
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
                :customer_service_calls, :will_default_next_2_4_weeks,
                :monthly_income_inr, :emi_amount_inr, :emi_due_this_week,
                :available_funds_inr, :emi_paid_flag, :emi_bounced_flag,
                :missed_emi_count_rolling, :balance_velocity,
                :salary_delay_delta, :discretionary_velocity,
                :upi_lending_delta, :savings_drawdown_velocity,
                :external_shock_flag, :shock_type
            )
            ON CONFLICT (customer_id, observation_week) DO NOTHING
        """),
            record,
        )

        conn.commit()


def insert_into_cassandra(record: dict):
    session = get_cassandra_session()
    session.execute(
        """
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
            monthly_income_inr, emi_amount_inr, emi_due_this_week,
            available_funds_inr, emi_paid_flag, emi_bounced_flag,
            missed_emi_count_rolling, balance_velocity,
            salary_delay_delta, discretionary_velocity,
            upi_lending_delta, savings_drawdown_velocity,
            external_shock_flag, shock_type,
            source, ingested_at
        ) VALUES (
            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
            %s, %s
        ) IF NOT EXISTS
    """,
        (
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
            float(record.get("monthly_income_inr", 0.0)),
            float(record.get("emi_amount_inr", 0.0)),
            bool(record.get("emi_due_this_week", False)),
            float(record.get("available_funds_inr", 0.0)),
            bool(record.get("emi_paid_flag", False)),
            bool(record.get("emi_bounced_flag", False)),
            int(record.get("missed_emi_count_rolling", 0)),
            float(record.get("balance_velocity", 0.0)),
            float(record.get("salary_delay_delta", 0.0)),
            float(record.get("discretionary_velocity", 0.0)),
            float(record.get("upi_lending_delta", 0.0)),
            float(record.get("savings_drawdown_velocity", 0.0)),
            bool(record.get("external_shock_flag", False)),
            record.get("shock_type", ""),
            record.get("source", "dataset_seed"),
            datetime.utcnow(),
        ),
    )


def insert_into_db(record: dict):
    try:
        insert_into_postgres(record)
    except Exception as e:
        print(f"[Postgres] Insert failed for {record.get('customer_id')}: {e}")

    try:
        insert_into_cassandra(record)
    except Exception as e:
        print(f"[Cassandra] Insert failed for {record.get('customer_id')}: {e}")


def run_consumer():
    """Main consumer loop - call this to start consuming from Kafka."""
    try:
        cons = get_consumer()

        # Reset offset to beginning for fresh start (demo purposes)
        print("[Consumer] Resetting offset to beginning for fresh start...")
        for partition in cons.assignment() or []:
            cons.seek_to_beginning(partition)

        print(f"[Consumer] Listening on topic '{KAFKA_TOPIC}'...\n")

        last_customer_id = None

        for message in cons:
            record = message.value
            customer_id = record["customer_id"]

            if last_customer_id and customer_id != last_customer_id:
                push_event({"customer_id": last_customer_id}, "CUSTOMER_DONE")
            last_customer_id = customer_id

            # Check rules FIRST
            triggered = should_trigger(record)

            # Step 1: INGEST
            push_event(record, "INGEST", triggered=triggered)

            print(
                f"customer={customer_id} | "
                f"week={record['observation_week']} | "
                f"salary_delay={record['salary_delay_days']}d | "
                f"balance=₹{float(record['avg_daily_balance_inr']):,.0f} | "
                f"auto_debit_failures={record['auto_debit_failures']} | "
                f"default_risk={record['will_default_next_2_4_weeks']}"
            )

            print(f"[Consumer] Rules check: triggered={triggered}")

            if triggered:
                push_event(record, "INGEST_TRIGGERED", triggered=True)
                # Route: ingest → predict → intervene
                try:
                    ingest_resp = httpx.post(
                        f"{API_BASE}/ingest", json=record, timeout=60.0
                    )
                    print(
                        f"[Consumer] DB stored: {customer_id} → {ingest_resp.status_code}"
                    )
                except Exception as e:
                    print(f"[Consumer Error] Ingest failed for {customer_id}: {e}")
                    continue

                try:
                    predict_resp = httpx.post(
                        f"{API_BASE}/predict", json=record, timeout=60.0
                    )
                    ml_result = predict_resp.json()
                    risk_score = ml_result.get("risk_score")
                    print(f"[Consumer] ML completed: {customer_id} → risk={risk_score}")
                    push_event(record, "SCORE", risk_score=risk_score, triggered=True)
                except Exception as e:
                    print(f"[Consumer Error] Predict failed for {customer_id}: {e}")
                    continue

                try:
                    intervene_resp = httpx.post(
                        f"{API_BASE}/intervene/{customer_id}",
                        json={"kafka_message": record, "ml_result": ml_result},
                        timeout=120.0,
                    )
                    agent_result = intervene_resp.json()
                    print(
                        f"[Consumer] Agents completed: {customer_id} → {intervene_resp.status_code}"
                    )
                    # Push result in ANALYSE and OUTREACH stages
                    push_event(
                        record,
                        "ANALYSE",
                        risk_score=risk_score,
                        agent_result=agent_result,
                        triggered=True,
                    )
                    push_event(
                        record,
                        "OUTREACH",
                        risk_score=risk_score,
                        agent_result=agent_result,
                        triggered=True,
                    )
                except Exception as e:
                    print(f"[Consumer Error] Intervene failed for {customer_id}: {e}")
            else:
                # Route: ingest only (DB persistence, no ML, no agents)
                push_event(record, "SKIPPED", triggered=False)
                try:
                    ingest_resp = httpx.post(
                        f"{API_BASE}/ingest", json=record, timeout=60.0
                    )
                    print(
                        f"[Consumer] DB stored (not triggered): {customer_id} → {ingest_resp.status_code}"
                    )
                except Exception as e:
                    print(f"[Consumer Error] Ingest failed for {customer_id}: {e}")

            # Commit Kafka offset after successful processing
            try:
                cons.commit()
            except Exception as e:
                print(f"[Consumer] Offset commit failed: {e}")

    except KeyboardInterrupt:
        print("[Consumer] Shutting down...")
    except Exception as e:
        print(f"[Consumer] Fatal error: {e}")
        raise


if __name__ == "__main__":
    run_consumer()
