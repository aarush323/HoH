import os
from cassandra.cluster import Cluster, ExecutionProfile, EXEC_PROFILE_DEFAULT
from cassandra.policies import DCAwareRoundRobinPolicy
from dotenv import load_dotenv

load_dotenv()

CASSANDRA_KEYSPACE = os.getenv("CASSANDRA_KEYSPACE", "predelinquency")

profile = ExecutionProfile(
    load_balancing_policy=DCAwareRoundRobinPolicy(local_dc='datacenter1')
)

cluster = Cluster(
    contact_points=["127.0.0.1"],
    port=9043,
    execution_profiles={EXEC_PROFILE_DEFAULT: profile},
    protocol_version=4,
    connect_timeout=30
)

def create_tables_if_not_exist(session):
    session.execute("""
        CREATE TABLE IF NOT EXISTS weekly_feature_snapshots (
            customer_id                     text,
            observation_week                date,
            salary_delay_days               int,
            salary_drop_pct                 float,
            avg_daily_balance_inr           float,
            balance_trend_pct               float,
            net_cashflow_ratio              float,
            savings_drawdown_pct            float,
            savings_withdrawal_count        int,
            utility_payment_delay_days      int,
            num_bills_paid_late_last_4w     int,
            discretionary_spend_inr         float,
            discretionary_vs_4w_avg_pct     float,
            gambling_lottery_spend_inr      float,
            gambling_4w_change_pct          float,
            upi_to_lending_apps_count       int,
            upi_to_lending_apps_amount_inr  float,
            atm_vs_4w_avg_pct               float,
            auto_debit_failures             int,
            credit_card_utilization_pct     float,
            credit_inquiries_last_30d       int,
            paying_minimum_only_flag        boolean,
            mobile_app_logins               int,
            financial_stress_queries        int,
            customer_service_calls          int,
            will_default_next_2_4_weeks     boolean,
            monthly_income_inr              float,
            emi_amount_inr                  float,
            emi_due_this_week               boolean,
            available_funds_inr             float,
            emi_paid_flag                   boolean,
            emi_bounced_flag                boolean,
            missed_emi_count_rolling        int,
            balance_velocity                float,
            salary_delay_delta              float,
            discretionary_velocity          float,
            upi_lending_delta               float,
            savings_drawdown_velocity       float,
            external_shock_flag             boolean,
            shock_type                      text,
            source                          text,
            ingested_at                     timestamp,
            PRIMARY KEY (customer_id, observation_week)
        );
    """)

def get_session():
    s = cluster.connect()
    s.set_keyspace(CASSANDRA_KEYSPACE)
    create_tables_if_not_exist(s)
    return s

def close():
    cluster.shutdown()

def test_connection():
    try:
        s = get_session()
        rows = s.execute(
            "SELECT table_name FROM system_schema.tables WHERE keyspace_name=%s",
            [CASSANDRA_KEYSPACE]
        )
        tables = [r.table_name for r in rows]
        print(f"Cassandra connected. Tables: {tables}")
    except Exception as e:
        print(f"Cassandra connection failed: {e}")
    finally:
        close()

if __name__ == "__main__":
    test_connection()