# Pre-Delinquency Intervention Engine - Backend Documentation

> AI-powered pre-delinquency detection and intervention system for banking operations.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Data Ingestion Flow](#data-ingestion-flow)
3. [Rule Engine (Trigger Logic)](#rule-engine-trigger-logic)
4. [ML Pipeline](#ml-pipeline)
5. [AI Agent Graph](#ai-agent-graph)
6. [Voice Agent System](#voice-agent-system)
7. [Channel Dispatch](#channel-dispatch)
8. [API Endpoints](#api-endpoints)
9. [Database Schema](#database-schema)
10. [State Management](#state-management)
11. [Configuration](#configuration)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         SYSTEM ARCHITECTURE                                      │
└─────────────────────────────────────────────────────────────────────────────────┘

                              ┌──────────────────┐
                              │   Kafka Topic    │
                              │ customer-weekly- │
                              │  observations    │
                              └────────┬─────────┘
                                       │
                                       ▼
                        ┌──────────────────────────┐
                        │   pipeline/consumer.py    │
                        │      (Rule Engine)       │
                        └────────────┬─────────────┘
                                     │
                          ┌──────────┴──────────┐
                          │  should_trigger()?   │
                          └──────────┬──────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    ▼                                 ▼
            ┌───────────────┐               ┌─────────────────────┐
            │   Ingest      │               │   Full Pipeline      │
            │   Only        │               │   (ML + Agents)       │
            └───────┬───────┘               └──────────┬──────────┘
                    │                              │
                    ▼                              ▼
            ┌───────────────┐               ┌─────────────────────┐
            │ customers     │               │   app/main.py        │
            │ weekly_       │               │   predict()          │
            │ features      │               └──────────┬──────────┘
            └───────────────┘                          │
                                                       ▼
                                    ┌─────────────────────────────────┐
                                    │      LangGraph Workflow          │
                                    │         (AI Agents)              │
                                    │                                  │
                                    │  analyst → compliance →          │
                                    │  intervention → voice_prep →     │
                                    │  channel_dispatch → voice_agent  │
                                    │  → persist_to_db                 │
                                    └─────────────────┬───────────────┘
                                                      │
                    ┌─────────────────────────────────┼─────────────────────────────────┐
                    ▼                                 ▼                                 ▼
            ┌───────────────┐               ┌─────────────────┐               ┌─────────────────┐
            │ model_        │               │ stress_context   │               │ interventions   │
            │ predictions   │               │                 │               │                 │
            │ shap_         │               │                 │               │ voice_sessions  │
            │ explanations  │               │                 │               │                 │
            └───────────────┘               └─────────────────┘               └─────────────────┘
```

---

## Data Ingestion Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    DATA INGESTION PIPELINE                        │
└─────────────────────────────────────────────────────────────────┘

  Kafka Message
       │
       ▼
  ┌─────────────────────────────────────────────────────────────┐
  │                    /ingest Endpoint                          │
  │                      (api.py:80-145)                         │
  └────────────────────────────┬────────────────────────────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
       ┌──────────┐     ┌──────────┐     ┌──────────────┐
       │raw_      │     │weekly_   │     │customers     │
       │observations│     │features  │     │(upsert)      │
       │_staging  │     │          │     │              │
       └──────────┘     └──────────┘     └──────────────┘
              │                │                │
              ▼                ▼                ▼
       ┌──────────┐     ┌──────────┐     ┌──────────────┐
       │ raw_     │     │weekly_   │     │ customers    │
       │ observations│     │features  │     │ table       │
       │_staging  │     │(Cassandra)│     │ updated     │
       └──────────┘     └──────────┘     └──────────────┘
```

### Ingestion Process

1. **Kafka Consumer** listens to `customer-weekly-observations` topic
2. **Rule Engine** evaluates if customer should trigger full ML + agent pipeline
3. **Upsert** customer data to `customers` table
4. **Store** features to `weekly_features` (Postgres + Cassandra)
5. If triggered: **Run ML + Graph pipeline**
6. **Publish** SSE update via Redis pub/sub

---

## Rule Engine (Trigger Logic)

**File:** `pipeline/consumer.py`

### Trigger Thresholds

| Rule | Threshold | Condition |
|------|-----------|-----------|
| `salary_delay_days` | > 3 | Days salary delayed |
| `auto_debit_failures` | >= 2 | Failed auto-payments |
| `savings_drawdown_pct` | < -20% | Savings depletion |
| `utility_payment_delay_days` | > 3 | Utility bill delays |
| `emi_bounced_flag` | == True | EMI bounce detected |
| `missed_emi_count_rolling` | >= 2 | Rolling missed EMI count |

### Logic

```python
def should_trigger(record: dict) -> bool:
    return (
        salary_delay > 3
        or auto_debit >= 2
        or savings_drawdown < -20.0
        or utility_delay > 3
        or emi_bounced == True
        or missed_emi >= 2
    )
```

- **Trigger = True**: Full ML + AI Agent pipeline runs
- **Trigger = False**: Data ingested only (no intervention)

---

## ML Pipeline

**File:** `app/ml_engine.py`, `app/main.py`

### Two-Model Ensemble

```
┌─────────────────────────────────────────────────────────────────┐
│                    ML SCORING ARCHITECTURE                       │
└─────────────────────────────────────────────────────────────────┘

                     Kafka Message
                          │
            ┌─────────────┴─────────────┐
            ▼                           ▼
     ┌─────────────┐            ┌─────────────┐
     │  LightGBM   │            │    GRU      │
     │  (Tabular)  │            │ (Temporal)  │
     └──────┬──────┘            └──────┬──────┘
            │                           │
            ▼                           ▼
     lgb_p + SHAP              gru_p + gradients
            │                           │
            └───────────┬───────────────┘
                        │
                        ▼
               ┌─────────────────┐
               │    Ensemble     │
               │ 0.6*lgb + 0.4*gru │
               └────────┬─────────┘
                        │
                        ▼
               ┌─────────────────┐
               │   risk_score    │
               │   risk_level    │
               │   shap_factors  │
               └─────────────────┘
```

### LightGBM Model
- **Input:** ~40 tabular features (numeric + encoded categoricals)
- **Output:** Probability + SHAP values for feature attribution

### GRU (Temporal) Model
- **Input:** 12-week history of velocity/delta features
- **Output:** Probability + gradient attribution for time patterns

### Risk Thresholds

| Risk Level | Score Range | Action |
|------------|-------------|--------|
| **High** | ≥ 0.75 | Immediate intervention |
| **Medium** | ≥ 0.50 | Standard intervention |
| **Low** | < 0.50 | Monitor only |

### Fallback Scoring

When ML models fail to load:

```
base_score = (salary_delay/10)*0.25 + (auto_debit_fail/5)*0.30 + 
             (abs(savings_drawdown)/100)*0.25 + (utility_delay/10)*0.20
```

### SHAP Factors

Top contributors explaining risk prediction:
- `salary_delay_days` → income stress
- `savings_drawdown_pct` → savings depletion
- `auto_debit_failures` → payment failure
- `utility_payment_delay_days` → bill payment stress
- `upi_to_lending_apps_count` → debt seeking behavior
- `credit_card_utilization_pct` → credit strain

---

## AI Agent Graph

**File:** `graph/__init__.py`, `graph/nodes.py`

### LangGraph Workflow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         LANGGRAPH WORKFLOW                                   │
└─────────────────────────────────────────────────────────────────────────────┘

                              START
                                │
                                ▼
                    ┌───────────────────────┐
                    │   1. Analyst Node      │
                    │   (Stress Analysis)    │
                    │                       │
                    │   Input:  Risk score  │
                    │            SHAP vals  │
                    │   Output: Narrative   │
                    │            Stress type│
                    │            Severity   │
                    └───────────┬───────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │  2. Compliance Node    │
                    │   (Hard Stop Check)    │
                    │                       │
                    │   Checks:              │
                    │   ✗ fraud_flag        │
                    │   ✗ legal_npa_flag    │
                    │   ✗ restructuring    │
                    │   ✗ kyc_lapsed       │
                    └───────────┬───────────┘
                                │
                    ┌───────────┴───────────┐
                    ▼                       ▼
              ┌───────────┐       ┌─────────────────┐
              │ HARD STOP │       │    CONTINUE      │
              │           │       │                 │
              │ Store     │       │ 3. Intervention  │
              │ analysis  │       │    Agent         │
              │ only      │       │                 │
              │           │       │ Ranks:           │
              └─────┬─────┘       │ payment_holiday  │
                    │             │ financial_counsel│
                    │             │ restructuring    │
                    │             │ rm_call          │
                    │             │ monitor_only     │
                    │             └────────┬─────────┘
                    │                      │
                    │                      ▼
                    │             ┌─────────────────┐
                    │             │ 4. Voice Prep    │
                    │             │    Node          │
                    │             │                  │
                    │             │ Builds payload   │
                    │             │ for voice agent  │
                    │             └────────┬─────────┘
                    │                      │
                    │                      ▼
                    │             ┌─────────────────┐
                    │             │ 5. Channel      │
                    │             │    Dispatch     │
                    │             │                 │
                    │             │ Voice: High/Med │
                    │             │ Email: Low      │
                    │             └────────┬─────────┘
                    │                      │
                    │                      ▼
                    │             ┌─────────────────┐
                    │             │ 6. Voice Agent   │
                    │             │    (Real Call)  │
                    │             │                 │
                    │             │ Transcribe →    │
                    │             │ Classify →      │
                    │             │ Respond → Loop  │
                    │             └────────┬─────────┘
                    │                      │
                    └──────────────────────┼──────────────────┘
                                           │
                                           ▼
                               ┌───────────────────────┐
                               │  7. Persist Node      │
                               │                       │
                               │ Store to:            │
                               │ • stress_context     │
                               │ • interventions      │
                               │ • voice_sessions     │
                               └───────────┬───────────┘
                                           │
                                           ▼
                                          END
```

### Node Details

#### 1. Analyst Node (`analyst_node`)
Generates stress narrative using LLM.

**Output:**
```python
{
    "narrative": "Customer showing 45% savings depletion with 6-day salary delay...",
    "stress_type": "income_shock",  # income_shock|overspending|structural|debt|unknown
    "severity": "high",             # very high|high|medium|low
    "recommended_action": "Immediate RM call recommended..."
}
```

#### 2. Compliance Node (`agent2_compliance`)
Hard stop conditions prevent outreach to high-risk accounts.

**Hard Stop Conditions:**
| Flag | Description |
|------|-------------|
| `fraud_flag` | Confirmed fraud case |
| `legal_npa_flag` | Legal NPA classification |
| `existing_restructuring` | Already restructured |
| `kyc_lapsed` | KYC documents expired |

**If hard stop:** Pipeline ends after storing stress_context only.

#### 3. Intervention Agent (`intervention_agent`)
Selects intervention method based on stress type.

**Intervention Ranking by Stress Type:**
| Stress Type | Intervention Priority |
|-------------|----------------------|
| income_shock | payment_holiday → financial_counseling → restructuring → rm_call → monitor_only |
| overspending | financial_counseling → rm_call → payment_holiday → restructuring → monitor_only |
| structural | restructuring → payment_holiday → rm_call → financial_counseling → monitor_only |
| debt | financial_counseling → payment_holiday → restructuring → rm_call → monitor_only |

#### 4. Voice Prep Node (`voice_prep_node`)
Prepares structured payload for voice agent.

**Payload Structure:**
```python
{
    "customer_id": "C001",
    "name": "Rahul",
    "risk_level": "high",
    "stress_type": "income_shock",
    "severity": "high",
    "intervention": "payment_holiday",
    "offer_detail": "2-month payment holiday",
    "emi_amount": "₹15,000",
    "language_hint": "english",
    "max_turns": 8,
    "fallback_message": "..."
}
```

---

## Voice Agent System

**File:** `voice_agent/`

### Voice Agent Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         VOICE AGENT SYSTEM                                  │
└─────────────────────────────────────────────────────────────────────────────┘

                    Voice Payload
                         │
                         ▼
            ┌────────────────────────┐
            │    Strategy Builder    │
            │  (voice_agent/strategy)│
            │                        │
            │  • Opening message     │
            │  • Offer detail        │
            │  • Talking points      │
            └───────────┬────────────┘
                        │
                        ▼
            ┌────────────────────────┐
            │    Speak Opening       │
            │  (voice_agent/speak)  │
            └───────────┬────────────┘
                        │
                        ▼
            ┌────────────────────────────────────────┐
            │              CALL LOOP                 │
            │  ┌──────────────────────────────────┐ │
            │  │ 1. Listen (Microphone)           │ │
            │  │    voice_agent/listen.py         │ │
            │  └──────────────┬───────────────────┘ │
            │                 │                     │
            │  ┌───────────────▼───────────────────┐ │
            │  │ 2. Transcribe (STT)              │ │
            │  │    voice_agent/transcribe.py     │ │
            │  └──────────────┬───────────────────┘ │
            │                 │                     │
            │  ┌───────────────▼───────────────────┐ │
            │  │ 3. Stage Classification            │ │
            │  │    voice_agent/classify.py       │ │
            │  │                                  │ │
            │  │ Stages:                          │ │
            │  │  • opening                       │ │
            │  │  • offer_presented               │ │
            │  │  • tips_presented                │ │
            │  └──────────────┬───────────────────┘ │
            │                 │                     │
            │  ┌───────────────▼───────────────────┐ │
            │  │ 4. Guardrail Check                │ │
            │  │    voice_agent/guardrail.py       │ │
            │  │                                  │ │
            │  │ • PII protection                 │ │
            │  │ • Sensitive data masking         │ │
            │  │ • Fallback response              │ │
            │  └──────────────┬───────────────────┘ │
            │                 │                     │
            │  ┌───────────────▼───────────────────┐ │
            │  │ 5. Speak Response                │ │
            │  │    voice_agent/speak.py          │ │
            │  └──────────────────────────────────┘ │
            │                                       │
            └───────────────┬─────────────────────┘
                            │
                    ┌───────┴───────┐
                    ▼               ▼
              Continue            Exit
              Loop              Call
                    │               │
                    ▼               ▼
            ┌─────────────────┐  ┌─────────────────┐
            │  Increment      │  │ Build Result    │
            │  Turn           │  │ & Return        │
            │  Next Stage     │  │                 │
            └────────┬────────┘  └─────────────────┘
                     │                     │
                     └──────────┬──────────┘
                                │
                                ▼
                       Call Result
                       (voice_result)
```

### Voice Agent Components

| Component | File | Purpose |
|-----------|------|---------|
| `strategy` | `voice_agent/strategy.py` | Builds conversation strategy from payload |
| `speak` | `voice_agent/speak.py` | Text-to-Speech output |
| `listen` | `voice_agent/listen.py` | Audio capture from microphone |
| `transcribe` | `voice_agent/transcribe.py` | Speech-to-Text conversion |
| `classify` | `voice_agent/classify.py` | Intent classification by stage |
| `guardrail` | `voice_agent/guardrail.py` | Output sanitization + safety |
| `respond` | `voice_agent/respond.py` | Response generation |
| `utils` | `voice_agent/utils.py` | Logging, trajectory, outcome |

### Call Stages

```
┌─────────────────────────────────────────────────────────────────┐
│                        CALL STAGES                                │
└─────────────────────────────────────────────────────────────────┘

  opening ──────► offer_presented ──────► tips_presented
     │                   │                      │
     │                   │                      │
     ▼                   ▼                      ▼
  Greet &           Present the            Offer tips for
  establish         payment holiday         financial management
  rapport          or intervention         if customer receptive
                       │
                       ▼
                  Handle objection
                  or acceptance
```

### Call Outcomes

| Outcome | Description |
|---------|-------------|
| `resolved` | Customer satisfied, call complete |
| `accepted_restructuring` | Customer accepted restructuring offer |
| `counsellor_requested` | Customer requested financial counselor |
| `escalated` | Urgent issue requiring human attention |
| `no_call_needed` | Monitor only, no voice outreach |

### Escalation Triggers

| Trigger | Reason |
|---------|--------|
| `accepted_restructuring` | Customer accepted restructuring specialist |
| `requested_advisor` | Customer wants financial counselor |
| `human_requested` | Explicit request for human agent |
| `unclear_streak` | 2+ consecutive unclear responses |
| `escalate_urgent` | Distressed or dispute detected |

### Guardrail System

Prevents sensitive data leakage:

- **PII Protection:** Names, account numbers masked
- **Amount Rules:** EMI amounts shown only if `show_emi_amount=True`
- **Fallback Responses:** Generic messages when guardrail triggers

---

## Channel Dispatch

**File:** `graph/channel_dispatch.py`

### Channel Selection Logic

```
┌─────────────────────────────────────────────────────────────────┐
│                    CHANNEL SELECTION                             │
└─────────────────────────────────────────────────────────────────┘

                    Intervention Method
                           │
            ┌──────────────┼──────────────┐
            │              │              │
            ▼              ▼              ▼
     monitor_only     High/Medium      Low Risk
            │           Risk             │
            ▼              │              ▼
          "none"        "voice"        "email"
                               │
                               ▼
                        ┌──────────┐
                        │ Generate │
                        │ Message  │
                        └──────────┘
```

### Channel Formats

| Channel | Format | Max Length |
|---------|--------|------------|
| **SMS** | Plain text | 160 chars |
| **WhatsApp** | Plain text | ~1000 chars |
| **Email** | Subject + Body | Unlimited |
| **Voice** | Real-time call | ~8 turns |

---

## API Endpoints

**File:** `app/api.py`

### Core Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/customers` | GET | List customers with risk summary |
| `/customers/all` | GET | Full customer data + analysis |
| `/customers/voice` | GET | Voice intervention customers |
| `/dashboard/stats` | GET | Aggregated KPIs + top stress factors |
| `/customers/{id}` | GET | Single customer profile |
| `/score/{id}` | GET | ML scores + SHAP factors |
| `/intervene/{id}` | POST | Run full ML + agent pipeline |
| `/outreach/{id}` | GET | Intervention history |
| `/customer/{id}/detail` | GET | Combined profile + score + stress + audit |
| `/stream` | GET | SSE live customer stream |
| `/journey-stream/{id}` | GET | SSE week-by-week customer history |

### Utility Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/ingest` | POST | Ingest Kafka message |
| `/trigger-producer` | POST | Trigger test data generation |
| `/rules` | GET | Current rule thresholds |
| `/audit` | GET | Full intervention audit log |
| `/health` | GET | Service health status |

### Response Schemas

#### GET /customers/all
```json
{
  "customer_id": "C001",
  "name": "Rahul Sharma",
  "risk_score": 0.82,
  "risk_level": "High",
  "product_type": "Home Loan",
  "analysis": {
    "stress_type": "income_shock",
    "severity": "high",
    "narrative": "Customer showing 45% savings depletion...",
    "recommended_action": "Immediate RM call recommended"
  },
  "signals": {
    "salary_delay": 6,
    "auto_debit_failures": 2,
    "savings_drawdown": -45.2,
    "utility_delay": 4
  }
}
```

#### GET /dashboard/stats
```json
{
  "total_customers": 1250,
  "high_risk_count": 45,
  "medium_risk_count": 180,
  "low_risk_count": 1025,
  "total_exposure": 450000000,
  "at_risk_percentage": 18.0,
  "channel_mix": {
    "voice": 120,
    "email": 340,
    "sms": 89
  },
  "active_interventions": 23,
  "resolution_rate": 67.5,
  "acceptance_rate": 34.2,
  "top_stress_factors": [
    {"factor": "salary_delay_days", "count": 89, "avg_contribution": 0.182}
  ]
}
```

---

## Database Schema

**File:** `db/postgres.py`, `db/cassandra_component.py`

### PostgreSQL Tables

#### customers
```sql
CREATE TABLE customers (
    customer_id               VARCHAR(20) PRIMARY KEY,
    name                      VARCHAR(100),
    age                       INT,
    customer_segment          VARCHAR(50),
    geography_zone            VARCHAR(50),
    product_type              VARCHAR(50),
    account_vintage_months    INT,
    emi_to_income_ratio      NUMERIC(6,4),
    loan_amount              NUMERIC(14,2),
    relationship_value        VARCHAR(20),
    fraud_flag                BOOLEAN DEFAULT FALSE,
    existing_restructuring    BOOLEAN DEFAULT FALSE,
    previous_payment_holiday  BOOLEAN DEFAULT FALSE,
    legal_npa_flag           BOOLEAN DEFAULT FALSE,
    kyc_lapsed               BOOLEAN DEFAULT FALSE,
    created_at               TIMESTAMPTZ DEFAULT NOW(),
    updated_at                TIMESTAMPTZ DEFAULT NOW()
);
```

#### weekly_features
```sql
CREATE TABLE weekly_features (
    id                          BIGSERIAL PRIMARY KEY,
    customer_id                  VARCHAR(20) REFERENCES customers(customer_id),
    observation_week             DATE,
    -- Behavioral Features
    salary_delay_days            INT,
    salary_drop_pct             NUMERIC(8,4),
    auto_debit_failures         INT,
    savings_drawdown_pct        NUMERIC(8,4),
    utility_payment_delay_days  INT,
    -- Financial Health
    credit_card_utilization_pct  NUMERIC(6,2),
    emi_to_income_ratio         NUMERIC(6,4),
    emi_bounced_flag            BOOLEAN,
    missed_emi_count_rolling   INT,
    -- Spending Patterns
    discretionary_spend_inr      NUMERIC(12,2),
    discretionary_vs_4w_avg_pct NUMERIC(8,4),
    gambling_lottery_spend_inr  NUMERIC(12,2),
    -- Velocity Features
    balance_velocity            NUMERIC(14,2),
    salary_delay_delta          NUMERIC(8,4),
    discretionary_velocity      NUMERIC(14,2),
    savings_drawdown_velocity   NUMERIC(8,4),
    -- External Events
    external_shock_flag         BOOLEAN,
    shock_type                  VARCHAR(50),
    UNIQUE (customer_id, observation_week)
);
```

#### model_predictions
```sql
CREATE TABLE model_predictions (
    id                BIGSERIAL PRIMARY KEY,
    customer_id       VARCHAR(20) REFERENCES customers(customer_id),
    observation_week  DATE,
    lightgbm_score    NUMERIC(6,4),
    gru_score         NUMERIC(6,4),
    ensemble_score    NUMERIC(6,4),
    risk_band         VARCHAR(20),
    model_version     VARCHAR(30),
    predicted_at      TIMESTAMPTZ DEFAULT NOW()
);
```

#### shap_explanations
```sql
CREATE TABLE shap_explanations (
    id              BIGSERIAL PRIMARY KEY,
    prediction_id   BIGINT REFERENCES model_predictions(id),
    customer_id     VARCHAR(20),
    feature_name    VARCHAR(100),
    shap_value      NUMERIC(10,6),
    feature_value   NUMERIC(14,4),
    rank            INT
);
```

#### stress_context
```sql
CREATE TABLE stress_context (
    id                   BIGSERIAL PRIMARY KEY,
    customer_id          VARCHAR(20) REFERENCES customers(customer_id),
    prediction_id       BIGINT REFERENCES model_predictions(id),
    narrative           TEXT,
    stress_type         VARCHAR(100),
    severity            VARCHAR(20),
    recommended_action  TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);
```

#### interventions
```sql
CREATE TABLE interventions (
    id                          BIGSERIAL PRIMARY KEY,
    customer_id                 VARCHAR(20) REFERENCES customers(customer_id),
    prediction_id              BIGINT REFERENCES model_predictions(id),
    observation_week           DATE,
    stress_context_id         BIGINT REFERENCES stress_context(id),
    intervention_method       VARCHAR(50),
    intervention_justification TEXT,
    eligible_interventions     TEXT[],
    selected_channel          VARCHAR(20),
    message_tone               VARCHAR(100),
    message_content            TEXT,
    channel_dispatch_result    JSONB,
    hard_stop                  BOOLEAN DEFAULT FALSE,
    hard_stop_reason           TEXT,
    status                     VARCHAR(20),
    outcome                    VARCHAR(30),
    created_at                 TIMESTAMPTZ DEFAULT NOW(),
    resolved_at                TIMESTAMPTZ,
    UNIQUE (customer_id, observation_week)
);
```

#### voice_sessions
```sql
CREATE TABLE voice_sessions (
    id                    BIGSERIAL PRIMARY KEY,
    intervention_id       BIGINT REFERENCES interventions(id),
    customer_id           VARCHAR(20) REFERENCES customers(customer_id),
    escalate              BOOLEAN DEFAULT FALSE,
    escalate_reason       TEXT,
    outcome               VARCHAR(50),
    turns_taken           INT,
    language_detected     VARCHAR(20),
    call_memory           JSONB,
    call_duration_seconds INT,
    created_at            TIMESTAMPTZ DEFAULT NOW()
);
```

### Cassandra Tables

#### weekly_feature_snapshots
```sql
CREATE TABLE weekly_feature_snapshots (
    customer_id         TEXT,
    observation_week    DATE,
    -- All weekly_features columns
    source              TEXT,
    ingested_at         TIMESTAMP,
    PRIMARY KEY (customer_id, observation_week)
);
```

---

## State Management

**File:** `graph/state.py`

### Main_context TypedDict

```python
class Main_context(TypedDict):
    # Prediction Info
    prediction_id: int
    observation_week: str
    total_risk_score: float
    risk_level: str
    
    # ML Output
    Shap: List[shap]
    
    # Customer Profile
    Customer_profile: customer_profile
    
    # Stress Analysis (Agent 1)
    Stress_context: stress_context
    eligible_interventions: List[str]
    
    # Compliance
    hard_stop: bool
    hard_stop_reason: Optional[str]
    
    # Intervention (Agent 3)
    Message_Tone: str
    Message_content: str
    Intervention_method: str
    Intervention_justification: str
    
    # Channel Dispatch
    selected_channel: Optional[str]
    channel_dispatch_result: Optional[dict]
    
    # Voice Agent
    voice_payload: Optional[dict]
    voice_result: Optional[voice_result]
```

### Sub-Types

```python
class shap(TypedDict):
    feature: str
    value: float
    contribution: float
    direction: str  # "+" or "-"

class customer_profile(TypedDict):
    customer_id: str
    name: str
    tenure_months: float
    loan_type: str
    loan_amount: float
    relationship_value: str  # High|Medium|Low
    fraud_flag: bool
    existing_restructuring: bool
    previous_payment_holiday: bool
    legal_npa_flag: bool
    kyc_lapsed: bool

class stress_context(TypedDict):
    narrative: str
    stress_type: str  # income_shock|overspending|structural|debt|unknown
    severity: str     # very high|high|medium|low
    recommended_action: Optional[str]

class voice_result(TypedDict):
    escalate: bool
    escalate_reason: Optional[str]
    outcome: str
    turns_taken: int
    language_detected: str
    call_memory: dict
```

---

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `POSTGRES_HOST` | localhost | PostgreSQL host |
| `POSTGRES_PORT` | 5433 | PostgreSQL port |
| `POSTGRES_DB` | pre_delinquency | Database name |
| `POSTGRES_USER` | admin | Database user |
| `POSTGRES_PASSWORD` | admin123 | Database password |
| `REDIS_HOST` | localhost | Redis host |
| `REDIS_PORT` | 6379 | Redis port |
| `KAFKA_BROKER` | 127.0.0.1:9093 | Kafka broker |

### Risk Thresholds (Configurable)

| Threshold | Value | File |
|-----------|-------|------|
| `salary_delay_days` | > 3 | `pipeline/consumer.py` |
| `auto_debit_failures` | >= 2 | `pipeline/consumer.py` |
| `savings_drawdown_pct` | < -20% | `pipeline/consumer.py` |
| `utility_payment_delay_days` | > 3 | `pipeline/consumer.py` |
| `High Risk` | >= 0.75 | `app/ml_engine.py` |
| `Medium Risk` | >= 0.50 | `app/ml_engine.py` |

### Model Configuration

| Parameter | Value |
|------------|-------|
| LightGBM Weight | 0.6 |
| GRU Weight | 0.4 |
| Voice Max Turns | 8 |
| SHAP Top Factors | 3 |

---

## Data Flow Summary

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         COMPLETE DATA FLOW                                    │
└─────────────────────────────────────────────────────────────────────────────┘

  1. KAFKA INGEST
     Kafka Message ──► Rule Engine ──► Ingest to DB
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
               customers      weekly_features   raw_observations
                                    │
                                    ▼
  2. ML SCORING                     │
     ┌──────────────────────────────┤
     ▼                              ▼
  LightGBM ───────────────────► Ensemble Score
  GRU ────────────────────────► + SHAP Factors
     │                              │
     └──────────────────────────────┘
                    │
                    ▼
  3. AI AGENTS                       │
     ┌────────────────────────────────┤
     ▼                                ▼
  Analyst ──► Narrative         Compliance ──► Hard Stop?
  │           + Stress Type              │
  │                                     ▼
  └──────────────────┐     ┌───────────┴───────────┐
                      │     ▼                       ▼
                      │  YES                     NO
                      │ Hard Stop               ┌────────────────┐
                      │                         │ Intervention    │
                      │                         │ Selection       │
                      │                         └───────┬────────┘
                      │                                 │
                      │                                 ▼
  4. CHANNEL DISPATCH                         ┌────────────────┐
     ┌────────────────────────────────────────┤ Voice Prep     │
     ▼                                        └───────┬────────┘
  Risk Level                                        │
     │                                             ▼
     ├─ High/Medium ──► Voice Call ──► Voice Agent ──┐
     │                                                │
     ├─ Low ──────────► Email ────────────────────────┤
     │                                                │
     └─ Monitor ───────► No Outreach ─────────────────┘
                    │
                    ▼
  5. PERSIST
     ┌─────────────────────────────────────────────┐
     │                                             │
     ▼                     ▼                       ▼
  model_predictions     stress_context         interventions
  shap_explanations                          voice_sessions
                    │
                    ▼
  6. SSE PUBLISH
     Redis Pub/Sub ──► /stream endpoint ──► Frontend Dashboard
```

---

## Error Handling

### Fallback Mechanisms

| Component | Fallback | Trigger |
|-----------|----------|---------|
| ML Models | Weighted formula | Model load failure |
| LLM Agents | Structured response | API failure |
| Kafka | Direct DB insert | Consumer failure |
| Redis | Polling | Pub/Sub failure |

### Logging

All components write to:
- Console (stdout)
- `agent_output_fallback.log` (agent failures)

---

## Security

### Hard Stop Conditions
Prevents outreach to:
- Fraud cases
- Legal NPAs
- Existing restructured accounts
- Lapsed KYC accounts

### Guardrails
- PII masking in voice responses
- Amount disclosure controls
- Fallback responses for sensitive queries

---

## Monitoring

### Key Metrics

| Metric | Source |
|--------|--------|
| Total Customers | `customers` table |
| At-Risk % | `model_predictions` |
| Resolution Rate | `interventions.outcome` |
| Acceptance Rate | `interventions.outcome` |
| Active Interventions | `interventions.status` |

### Health Checks

| Check | Endpoint |
|-------|----------|
| Service Status | `GET /health` |
| Model Version | `GET /health` |
| Database Connection | Internal |

---

*Document generated: Backend Documentation v1.0*
