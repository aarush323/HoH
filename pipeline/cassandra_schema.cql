CREATE KEYSPACE IF NOT EXISTS predelinquency
WITH replication = {'class': 'SimpleStrategy', 'replication_factor': 1};

USE predelinquency;

CREATE TABLE IF NOT EXISTS raw_transactions (
    customer_id         TEXT,
    event_timestamp     TIMESTAMP,
    event_type          TEXT,
    amount_inr          DECIMAL,
    merchant_category   TEXT,
    channel             TEXT,
    status              TEXT,
    device_id           TEXT,
    kafka_offset        BIGINT,
    PRIMARY KEY (customer_id, event_timestamp)
) WITH CLUSTERING ORDER BY (event_timestamp DESC);

CREATE TABLE IF NOT EXISTS weekly_feature_snapshots (
    customer_id                     TEXT,
    observation_week                DATE,
    salary_delay_days               INT,
    salary_drop_pct                 FLOAT,
    avg_daily_balance_inr           DECIMAL,
    balance_trend_pct               FLOAT,
    net_cashflow_ratio              FLOAT,
    savings_drawdown_pct            FLOAT,
    savings_withdrawal_count        INT,
    utility_payment_delay_days      INT,
    num_bills_paid_late_last_4w     INT,
    discretionary_spend_inr         DECIMAL,
    discretionary_vs_4w_avg_pct     FLOAT,
    gambling_lottery_spend_inr      DECIMAL,
    gambling_4w_change_pct          FLOAT,
    upi_to_lending_apps_count       INT,
    upi_to_lending_apps_amount_inr  DECIMAL,
    atm_vs_4w_avg_pct               FLOAT,
    auto_debit_failures             INT,
    credit_card_utilization_pct     FLOAT,
    credit_inquiries_last_30d       INT,
    paying_minimum_only_flag        BOOLEAN,
    mobile_app_logins               INT,
    financial_stress_queries        INT,
    customer_service_calls          INT,
    will_default_next_2_4_weeks     BOOLEAN,
    monthly_income_inr              DECIMAL,
    emi_amount_inr                  DECIMAL,
    emi_due_this_week               BOOLEAN,
    available_funds_inr             DECIMAL,
    emi_paid_flag                   BOOLEAN,
    emi_bounced_flag                BOOLEAN,
    missed_emi_count_rolling        INT,
    balance_velocity                FLOAT,
    salary_delay_delta              FLOAT,
    discretionary_velocity          FLOAT,
    upi_lending_delta               FLOAT,
    savings_drawdown_velocity       FLOAT,
    external_shock_flag             BOOLEAN,
    shock_type                      TEXT,
    source                          TEXT,
    ingested_at                     TIMESTAMP,
    PRIMARY KEY (customer_id, observation_week)
) WITH CLUSTERING ORDER BY (observation_week ASC);

CREATE TABLE IF NOT EXISTS auto_debit_failures_log (
    customer_id         TEXT,
    failure_timestamp   TIMESTAMP,
    emi_amount_inr      DECIMAL,
    lender_id           TEXT,
    failure_reason      TEXT,
    retry_count         INT,
    PRIMARY KEY (customer_id, failure_timestamp)
) WITH CLUSTERING ORDER BY (failure_timestamp DESC);