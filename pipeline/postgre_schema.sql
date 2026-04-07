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
    emi_amount_inr                  NUMERIC(14,2),
    emi_due_this_week               BOOLEAN,
    available_funds_inr             NUMERIC(14,2),
    emi_paid_flag                   BOOLEAN,
    emi_bounced_flag                BOOLEAN,
    missed_emi_count_rolling        INT,
    balance_velocity                NUMERIC(14,2),
    salary_delay_delta              NUMERIC(8,4),
    discretionary_velocity          NUMERIC(14,2),
    upi_lending_delta               NUMERIC(8,4),
    savings_drawdown_velocity       NUMERIC(8,4),
    external_shock_flag             BOOLEAN,
    shock_type                      VARCHAR(50),
    ingested_at                     TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (customer_id, observation_week)
);

CREATE TABLE IF NOT EXISTS customers (
    customer_id                 VARCHAR(20) PRIMARY KEY,
    name                        VARCHAR(100),
    age                         INT,
    customer_segment            VARCHAR(50),
    geography_zone              VARCHAR(50),
    product_type                VARCHAR(50),
    account_vintage_months      INT,
    tenure_months               FLOAT,
    emi_to_income_ratio         NUMERIC(6,4),
    loan_amount                 NUMERIC(14,2),
    relationship_value          VARCHAR(20),
    fraud_flag                  BOOLEAN DEFAULT FALSE,
    existing_restructuring      BOOLEAN DEFAULT FALSE,
    previous_payment_holiday    BOOLEAN DEFAULT FALSE,
    legal_npa_flag              BOOLEAN DEFAULT FALSE,
    kyc_lapsed                  BOOLEAN DEFAULT FALSE,
    created_at                  TIMESTAMPTZ DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ DEFAULT NOW()
);

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
    emi_amount_inr                  NUMERIC(14,2),
    emi_due_this_week               BOOLEAN,
    available_funds_inr             NUMERIC(14,2),
    emi_paid_flag                   BOOLEAN,
    emi_bounced_flag                BOOLEAN,
    missed_emi_count_rolling        INT,
    balance_velocity                NUMERIC(14,2),
    salary_delay_delta              NUMERIC(8,4),
    discretionary_velocity          NUMERIC(14,2),
    upi_lending_delta               NUMERIC(8,4),
    savings_drawdown_velocity       NUMERIC(8,4),
    external_shock_flag             BOOLEAN,
    shock_type                      VARCHAR(50),
    synced_at                       TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (customer_id, observation_week)
);

CREATE INDEX IF NOT EXISTS idx_weekly_features_customer_week
    ON weekly_features (customer_id, observation_week);

CREATE TABLE IF NOT EXISTS model_predictions (
    id                  BIGSERIAL PRIMARY KEY,
    customer_id         VARCHAR(20) REFERENCES customers(customer_id),
    observation_week    DATE,
    lightgbm_score      NUMERIC(6,4),
    gru_score           NUMERIC(6,4),
    ensemble_score      NUMERIC(6,4),
    risk_band           VARCHAR(20),
    model_version       VARCHAR(30),
    predicted_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_predictions_customer
    ON model_predictions (customer_id);

CREATE TABLE IF NOT EXISTS shap_explanations (
    id              BIGSERIAL PRIMARY KEY,
    prediction_id   BIGINT REFERENCES model_predictions(id),
    customer_id     VARCHAR(20),
    feature_name    VARCHAR(100),
    shap_value      NUMERIC(10,6),
    feature_value   NUMERIC(14,4),
    rank            INT
);

CREATE INDEX IF NOT EXISTS idx_shap_customer
    ON shap_explanations (customer_id);

CREATE TABLE IF NOT EXISTS stress_context (
    id              BIGSERIAL PRIMARY KEY,
    customer_id     VARCHAR(20) REFERENCES customers(customer_id),
    prediction_id   BIGINT REFERENCES model_predictions(id),
    narrative       TEXT,
    stress_type     VARCHAR(100),
    severity        VARCHAR(20),
    recommended_action TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS interventions (
    id                          BIGSERIAL PRIMARY KEY,
    customer_id                 VARCHAR(20) REFERENCES customers(customer_id),
    prediction_id               BIGINT REFERENCES model_predictions(id),
    observation_week            DATE,
    stress_context_id           BIGINT REFERENCES stress_context(id),
    intervention_method         VARCHAR(50),
    intervention_justification  TEXT,
    eligible_interventions      TEXT[],
    selected_channel            VARCHAR(20),
    message_tone                VARCHAR(100),
    message_content             TEXT,
    channel_dispatch_result     JSONB,
    hard_stop                   BOOLEAN DEFAULT FALSE,
    hard_stop_reason            TEXT,
    status                      VARCHAR(20),
    outcome                     VARCHAR(30),
    created_at                  TIMESTAMPTZ DEFAULT NOW(),
    resolved_at                 TIMESTAMPTZ,
    UNIQUE (customer_id, observation_week)
);

CREATE INDEX IF NOT EXISTS idx_interventions_customer
    ON interventions (customer_id);

CREATE TABLE IF NOT EXISTS voice_sessions (
    id                      BIGSERIAL PRIMARY KEY,
    intervention_id         BIGINT REFERENCES interventions(id),
    customer_id             VARCHAR(20) REFERENCES customers(customer_id),
    escalate                BOOLEAN,
    escalate_reason         TEXT,
    outcome                 VARCHAR(50),
    turns_taken             INT,
    language_detected       VARCHAR(20),
    call_memory             JSONB,
    call_duration_seconds   INT,
    created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS model_training_runs (
    run_id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_type              VARCHAR(20),
    training_week_start     DATE,
    training_week_end       DATE,
    auc_roc                 NUMERIC(6,4),
    precision_at_threshold  NUMERIC(6,4),
    recall_at_threshold     NUMERIC(6,4),
    hyperparameters         JSONB,
    feature_importance      JSONB,
    trained_at              TIMESTAMPTZ DEFAULT NOW(),
    deployed                BOOLEAN DEFAULT FALSE
);
