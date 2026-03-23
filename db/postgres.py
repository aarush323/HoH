import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = (
    f"postgresql://{os.getenv('POSTGRES_USER', 'admin')}:"
    f"{os.getenv('POSTGRES_PASSWORD', 'admin123')}@"
    f"{os.getenv('POSTGRES_HOST', 'localhost')}:"
    f"{os.getenv('POSTGRES_PORT', '5432')}/"
    f"{os.getenv('POSTGRES_DB', 'pre_delinquency')}"
)

engine = create_engine(DATABASE_URL, pool_size=5, max_overflow=10)
SessionLocal = sessionmaker(bind=engine)

def get_connection():
    return engine.connect()

def test_connection():
    try:
        with get_connection() as conn:
            result = conn.execute(text("SELECT COUNT(*) FROM customers"))
            print(f"Postgres connected. customers rows: {result.scalar()}")
    except Exception as e:
        print(f"Postgres connection failed: {e}")

if __name__ == "__main__":
    test_connection()


def create_tables_if_not_exist():
    with get_connection() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS raw_observations_staging (
                customer_id                     VARCHAR(20),
                observation_week                DATE,
                age                             INT,
                customer_segment                VARCHAR(50),
                geography_zone                  VARCHAR(50),
                product_type                    VARCHAR(50),
                account_vintage_months          INT,
                emi_to_income_ratio             NUMERIC(6,4),
                salary_delay_days               INT,
                salary_drop_pct                 NUMERIC(8,4),
                avg_daily_balance_inr           NUMERIC(14,2),
                balance_trend_pct               NUMERIC(8,4),
                net_cashflow_ratio              NUMERIC(8,4),
                savings_drawdown_pct            NUMERIC(8,4),
                savings_withdrawal_count        INT,
                utility_payment_delay_days      INT,
                num_bills_paid_late_last_4w     INT,
                discretionary_spend_inr         NUMERIC(12,2),
                discretionary_vs_4w_avg_pct     NUMERIC(8,4),
                gambling_lottery_spend_inr      NUMERIC(12,2),
                gambling_4w_change_pct          NUMERIC(8,4),
                upi_to_lending_apps_count       INT,
                upi_to_lending_apps_amount_inr  NUMERIC(12,2),
                atm_vs_4w_avg_pct               NUMERIC(8,4),
                auto_debit_failures             INT,
                credit_card_utilization_pct     NUMERIC(6,2),
                credit_inquiries_last_30d       INT,
                paying_minimum_only_flag        BOOLEAN,
                mobile_app_logins               INT,
                financial_stress_queries        INT,
                customer_service_calls          INT,
                will_default_next_2_4_weeks     BOOLEAN,
                monthly_income_inr              NUMERIC(14,2),
                emi_amount_inr                  NUMERIC(12,2),
                emi_due_this_week               BOOLEAN,
                available_funds_inr             NUMERIC(14,2),
                emi_paid_flag                   BOOLEAN,
                emi_bounced_flag                BOOLEAN,
                missed_emi_count_rolling        INT,
                balance_velocity                NUMERIC(12,4),
                salary_delay_delta              NUMERIC(8,4),
                discretionary_velocity          NUMERIC(12,4),
                upi_lending_delta               NUMERIC(12,4),
                savings_drawdown_velocity       NUMERIC(8,4),
                external_shock_flag             BOOLEAN,
                shock_type                      VARCHAR(64),
                ingested_at                     TIMESTAMPTZ DEFAULT NOW(),
                PRIMARY KEY (customer_id, observation_week)
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS weekly_features (
                id                              BIGSERIAL PRIMARY KEY,
                customer_id                     VARCHAR(20) REFERENCES customers(customer_id),
                observation_week                DATE,
                salary_delay_days               INT,
                salary_drop_pct                 NUMERIC(8,4),
                avg_daily_balance_inr           NUMERIC(14,2),
                balance_trend_pct               NUMERIC(8,4),
                net_cashflow_ratio              NUMERIC(8,4),
                savings_drawdown_pct            NUMERIC(8,4),
                savings_withdrawal_count        INT,
                utility_payment_delay_days      INT,
                num_bills_paid_late_last_4w     INT,
                discretionary_spend_inr         NUMERIC(12,2),
                discretionary_vs_4w_avg_pct     NUMERIC(8,4),
                gambling_lottery_spend_inr      NUMERIC(12,2),
                gambling_4w_change_pct          NUMERIC(8,4),
                upi_to_lending_apps_count       INT,
                upi_to_lending_apps_amount_inr  NUMERIC(12,2),
                atm_vs_4w_avg_pct               NUMERIC(8,4),
                auto_debit_failures             INT,
                credit_card_utilization_pct     NUMERIC(6,2),
                credit_inquiries_last_30d       INT,
                paying_minimum_only_flag        BOOLEAN,
                mobile_app_logins               INT,
                financial_stress_queries        INT,
                customer_service_calls          INT,
                will_default_next_2_4_weeks     BOOLEAN,
                monthly_income_inr              NUMERIC(14,2),
                emi_amount_inr                  NUMERIC(12,2),
                emi_due_this_week               BOOLEAN,
                available_funds_inr             NUMERIC(14,2),
                emi_paid_flag                   BOOLEAN,
                emi_bounced_flag                BOOLEAN,
                missed_emi_count_rolling        INT,
                balance_velocity                NUMERIC(12,4),
                salary_delay_delta              NUMERIC(8,4),
                discretionary_velocity          NUMERIC(12,4),
                upi_lending_delta               NUMERIC(12,4),
                savings_drawdown_velocity       NUMERIC(8,4),
                external_shock_flag             BOOLEAN,
                shock_type                      VARCHAR(64),
                synced_at                       TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE (customer_id, observation_week)
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS interventions (
                id                   SERIAL PRIMARY KEY,
                customer_id          VARCHAR(50) NOT NULL,
                observation_week     DATE,
                risk_score           FLOAT,
                risk_level           VARCHAR(20),
                hard_stop            BOOLEAN DEFAULT FALSE,
                hard_stop_reason     TEXT,
                selected_channel     VARCHAR(50),
                intervention_method  TEXT,
                message_content      TEXT,
                full_result_json     JSONB,
                created_at           TIMESTAMPTZ DEFAULT NOW()
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS voice_sessions (
                id                   SERIAL PRIMARY KEY,
                customer_id          VARCHAR(50) NOT NULL,
                intervention_id      INT REFERENCES interventions(id),
                voice_outcome        VARCHAR(50),
                voice_turns          INT,
                offer_accepted       BOOLEAN,
                intent_history       JSONB,
                sentiment_trajectory JSONB,
                topics_raised        JSONB,
                escalate             BOOLEAN DEFAULT FALSE,
                escalate_reason      TEXT,
                created_at           TIMESTAMPTZ DEFAULT NOW()
            )
        """))
        
        alter_statements = [
            "ALTER TABLE raw_observations_staging ADD COLUMN IF NOT EXISTS monthly_income_inr NUMERIC(14,2);",
            "ALTER TABLE raw_observations_staging ADD COLUMN IF NOT EXISTS emi_amount_inr NUMERIC(12,2);",
            "ALTER TABLE raw_observations_staging ADD COLUMN IF NOT EXISTS emi_due_this_week BOOLEAN;",
            "ALTER TABLE raw_observations_staging ADD COLUMN IF NOT EXISTS available_funds_inr NUMERIC(14,2);",
            "ALTER TABLE raw_observations_staging ADD COLUMN IF NOT EXISTS emi_paid_flag BOOLEAN;",
            "ALTER TABLE raw_observations_staging ADD COLUMN IF NOT EXISTS emi_bounced_flag BOOLEAN;",
            "ALTER TABLE raw_observations_staging ADD COLUMN IF NOT EXISTS missed_emi_count_rolling INT;",
            "ALTER TABLE raw_observations_staging ADD COLUMN IF NOT EXISTS balance_velocity NUMERIC(12,4);",
            "ALTER TABLE raw_observations_staging ADD COLUMN IF NOT EXISTS salary_delay_delta NUMERIC(8,4);",
            "ALTER TABLE raw_observations_staging ADD COLUMN IF NOT EXISTS discretionary_velocity NUMERIC(12,4);",
            "ALTER TABLE raw_observations_staging ADD COLUMN IF NOT EXISTS upi_lending_delta NUMERIC(12,4);",
            "ALTER TABLE raw_observations_staging ADD COLUMN IF NOT EXISTS savings_drawdown_velocity NUMERIC(8,4);",
            "ALTER TABLE raw_observations_staging ADD COLUMN IF NOT EXISTS external_shock_flag BOOLEAN;",
            "ALTER TABLE raw_observations_staging ADD COLUMN IF NOT EXISTS shock_type VARCHAR(64);",
            
            "ALTER TABLE weekly_features ADD COLUMN IF NOT EXISTS monthly_income_inr NUMERIC(14,2);",
            "ALTER TABLE weekly_features ADD COLUMN IF NOT EXISTS emi_amount_inr NUMERIC(12,2);",
            "ALTER TABLE weekly_features ADD COLUMN IF NOT EXISTS emi_due_this_week BOOLEAN;",
            "ALTER TABLE weekly_features ADD COLUMN IF NOT EXISTS available_funds_inr NUMERIC(14,2);",
            "ALTER TABLE weekly_features ADD COLUMN IF NOT EXISTS emi_paid_flag BOOLEAN;",
            "ALTER TABLE weekly_features ADD COLUMN IF NOT EXISTS emi_bounced_flag BOOLEAN;",
            "ALTER TABLE weekly_features ADD COLUMN IF NOT EXISTS missed_emi_count_rolling INT;",
            "ALTER TABLE weekly_features ADD COLUMN IF NOT EXISTS balance_velocity NUMERIC(12,4);",
            "ALTER TABLE weekly_features ADD COLUMN IF NOT EXISTS salary_delay_delta NUMERIC(8,4);",
            "ALTER TABLE weekly_features ADD COLUMN IF NOT EXISTS discretionary_velocity NUMERIC(12,4);",
            "ALTER TABLE weekly_features ADD COLUMN IF NOT EXISTS upi_lending_delta NUMERIC(12,4);",
            "ALTER TABLE weekly_features ADD COLUMN IF NOT EXISTS savings_drawdown_velocity NUMERIC(8,4);",
            "ALTER TABLE weekly_features ADD COLUMN IF NOT EXISTS external_shock_flag BOOLEAN;",
            "ALTER TABLE weekly_features ADD COLUMN IF NOT EXISTS shock_type VARCHAR(64);"
        ]
        
        for stmt in alter_statements:
            conn.execute(text(stmt))
            
        conn.commit()