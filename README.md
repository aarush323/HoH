# Pre-Delinquency Intervention Engine

A multi-agent pre-delinquency detection and intervention system. Predicts customer payment stress using ensemble ML (LightGBM + GRU), analyzes via LangGraph agent orchestration, and executes proactive outreach through real-time voice calls.

---

## Architecture Overview

```mermaid
flowchart LR
    subgraph Ingest["📥 Ingestion"]
        Kafka[Kafka Topic<br/>customer-weekly-observations]
        Producer[producer.py]
        Consumer[consumer.py<br/>Rule Engine]
    end

    subgraph ML["🤖 ML Engine"]
        Ensemble[Ensemble<br/>LightGBM + GRU]
        SHAP[SHAP<br/>Explainability]
    end

    subgraph Agents["🧠 LangGraph Agents"]
        Analyst[analyst_node]
        Compliance[agent2_compliance<br/>Compliance Node]
        Intervention[intervention_agent]
        VoicePrep[voice_prep_node]
    end

    subgraph Channel["📞 Channel Dispatch"]
        Routing[select_channel]
        Voice[Voice Agent<br/>voice_agent/]
        WA[WhatsApp]
        Email[Email]
    end

    subgraph Store["💾 Storage"]
        PG[(PostgreSQL)]
        Redis[(Redis)]
        Cas[(Cassandra)]
    end

    Kafka --> Producer
    Producer -->|stream| Consumer
    Consumer -->|trigger| Ensemble
    Ensemble -->|score + SHAP| Analyst
    Analyst --> Compliance
    Compliance --> Intervention
    Intervention --> VoicePrep
    VoicePrep --> Routing
    Routing -->|voice| Voice
    Routing -->|whatsapp| WA
    Routing -->|email| Email
    Voice -.-> PG
    Ensemble -.-> PG
```

---

## Key Features

### Ensemble ML
- LightGBM (tabular features) + GRU (temporal features) ensemble
- Weighted formula: `0.6 * lgb + 0.4 * gru`
- SHAP-based feature attribution (top 4 factors)
- Risk levels: HIGH (>= 0.75), MEDIUM (>= 0.50), LOW (< 0.50)
- Fallback weighted formula when models unavailable

### Multi-Agent Orchestration (LangGraph)
- **analyst_node**: Generates stress narrative, identifies stress_type and severity via LLM
- **agent2_compliance**: Hard-stop checks (fraud_flag, legal_npa_flag, existing_restructuring, kyc_lapsed)
- **intervention_agent**: Selects intervention method, generates outreach message and tone
- **voice_prep_node**: Builds voice_payload for voice agent

### Voice Agent (voice_agent/)

```mermaid
sequenceDiagram
    participant U as User
    participant A as voice_agent
    
    A->>U: Opening (speak.py)
    U->>A: Speech (listen.py)
    A->>A: Transcribe (transcribe.py)
    A->>A: Classify Intent (classify.py)
    A->>A: Generate Response (respond.py)
    A->>A: Guardrail Check (guardrail.py)
    A->>U: Speak Response (speak.py)
    U->>A: ... (next turn)
    A->>A: Build Result
```

Components:
- agent.py - run_call() orchestration
- strategy.py - call strategy builder
- speak.py - Text-to-Speech
- listen.py - Audio capture
- transcribe.py - Speech-to-Text
- classify.py - Intent classification
- guardrail.py - Output sanitization
- utils.py - Logging, trajectory

### Channel Routing (select_channel in graph/nodes.py)

```mermaid
flowchart TD
    A[risk_score] --> B{>= 0.85}
    B -->|yes| V[voice]
    B -->|no| C{>= 0.70 + severity<br/>high/very high}
    C -->|yes| V
    C -->|no| D{>= 0.60}
    D -->|yes| E{structural/debt<br/>stress_type}
    E -->|yes| V
    E -->|no| F{intervention<br/>financial_counseling<br/>restructuring/rm_call}
    F -->|yes| V
    F -->|no| WA[whatsapp]
    D -->|no| WA2{>= 0.45}
    WA2 -->|yes| WA
    WA2 -->|no| E2{>= 0.30}
    E2 -->|yes| EM[email]
    E2 -->|no| M[none<br/>monitor_only]
```

### Approval Queue
- Pending interventions queued for manager approval
- Voice calls execute after approval via SSE stream
- Status: PENDING -> APPROVED -> EXECUTED

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Orchestration | LangGraph |
| ML | LightGBM, GRU |
| LLM | LangChain + Groq (Llama 3.1) |
| API | FastAPI |
| Streaming | Kafka, Redis, SSE |
| Database | PostgreSQL, Redis, Cassandra |
| Frontend | React + TypeScript + Vite |
| Voice | gTTS, SpeechRecognition |

---

## Setup

```bash
# Install dependencies
pip install -r requirements.txt

# Start infrastructure
docker-compose up -d

# Set environment variables in .env
# GROQ_API_KEY, CEREBRAS_API_KEY, POSTGRES_*, REDIS_*, KAFKA_BROKER
```

## Run

```bash
# Run prediction pipeline
python app/main.py

# Start API
uvicorn app.api:app --host 0.0.0.0 --port 8000

# Frontend (optional)
cd frontend && npm install && npm run dev
```

---

## Project Structure

```
HoH/
├── app/
│   ├── api.py              # FastAPI endpoints
│   ├── executor.py         # Pipeline executor
│   ├── llm.py             # LLM configuration
│   ├── main.py            # predict() entry point
│   └── ml_engine.py       # LightGBM + GRU scoring
├── graph/
│   ├── __init__.py        # build_graph() - LangGraph workflow
│   ├── nodes.py           # analyst_node, agent2_compliance, intervention_agent, ...
│   ├── state.py           # Main_context TypedDict
│   └── channel_dispatch.py # Channel routing
├── voice_agent/
│   ├── agent.py          # run_call() - Voice orchestration
│   ├── strategy.py       # Call strategy builder
│   ├── speak.py          # Text-to-Speech
│   ├── listen.py         # Audio capture
│   ├── transcribe.py     # Speech-to-Text
│   ├── classify.py       # Intent classification
│   ├── guardrail.py      # Output sanitization
│   └── utils.py         # Logging, trajectory
├── pipeline/
│   ├── producer.py       # Kafka producer
│   ├── consumer.py      # Kafka consumer + Rule Engine
│   └── postgre_schema.sql
├── db/
│   ├── postgres.py      # PostgreSQL connection
│   ├── redis_client.py # Redis client
│   ├── cassandra_component.py
│   └── queries.py     # Database queries
└── frontend/
    └── src/
        ├── pages/    # Dashboard pages
        └── hooks/   # useVoiceStream (SSE)
```

---

## Data Flow

```mermaid
flowchart TD
    A[Kafka Message<br/>customer-weekly-observations] --> B{Rule Engine<br/>should_trigger}
    
    B -->|salary_delay > 3| C[Trigger]
    B -->|auto_debit >= 2| C
    B -->|savings_drawdown < -20%| C
    B -->|utility_delay > 3| C
    B -->|emi_bounced == True| C
    B -->|missed_emi >= 2| C
    
    B -->|no trigger| D[Ingest Only<br/>weekly_features]
    
    C --> E[Ensemble Model<br/>LightGBM + GRU]
    E --> F[LangGraph Workflow]
    
    F --> G1[analyst_node]
    G1 --> G2[agent2_compliance]
    G2 -->|hard_stop| H[persist stress_context]
    G2 -->|continue| G3[intervention_agent]
    G3 --> G4[voice_prep_node]
    G4 --> G5[select_channel]
    G5 --> G6[voice_agent]
    
    G6 --> I[PostgreSQL<br/>persist_to_db]
    I --> J[SSE<br/>Frontend]
    
    D -.-> I
```

---

## LangGraph State

```python
class Main_context(TypedDict):
    prediction_id: int
    observation_week: str
    total_risk_score: float
    risk_level: str
    Shap: List[shap]
    Customer_profile: customer_profile
    Stress_context: stress_context
    eligible_interventions: List[str]
    hard_stop: bool
    hard_stop_reason: Optional[str]
    Message_Tone: str
    Message_content: str
    Intervention_method: str
    Intervention_justification: str
    selected_channel: Optional[str]
    channel_dispatch_result: Optional[dict]
    voice_payload: Optional[dict]
    voice_result: Optional[voice_result]
```

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/dashboard/stats` | GET | Aggregated KPIs |
| `/customers` | GET | All customers with risk |
| `/customers/{id}` | GET | Customer profile |
| `/score/{id}` | GET | ML score + SHAP factors |
| `/pending-approvals` | GET | Pending interventions |
| `/pending-approvals/{id}/approve` | POST | Approve intervention |
| `/pending-approvals/{id}/reject` | POST | Reject intervention |
| `/voice/execute/{id}` | GET | SSE voice call stream |
| `/stream` | GET | SSE live data stream |

---

## Trigger Thresholds

| Rule | Threshold |
|------|-----------|
| salary_delay_days | > 3 |
| auto_debit_failures | >= 2 |
| savings_drawdown_pct | < -20% |
| utility_payment_delay_days | > 3 |
| emi_bounced_flag | == True |
| missed_emi_count_rolling | >= 2 |

---

## Hard Stop Conditions

| Flag | Description |
|------|-------------|
| fraud_flag | Confirmed fraud case |
| legal_npa_flag | Legal NPA classification |
| existing_restructuring | Already in restructuring |
| kyc_lapsed | KYC documents expired |

---

## Intervention Rankings by Stress Type

```mermaid
flowchart LR
    subgraph income_shock
        I1[payment_holiday] --> I2[financial_counseling] --> I3[restructuring] --> I4[rm_call] --> I5[monitor_only]
    end
    
    subgraph overspending
        O1[financial_counseling] --> O2[rm_call] --> O3[payment_holiday] --> O4[restructuring] --> O5[monitor_only]
    end
    
    subgraph structural
        S1[restructuring] --> S2[payment_holiday] --> S3[rm_call] --> S4[financial_counseling] --> S5[monitor_only]
    end
    
    subgraph debt
        D1[financial_counseling] --> D2[payment_holiday] --> D3[restructuring] --> D4[rm_call] --> D5[monitor_only]
    end
```

---

## Voice Call Stages

```mermaid
stateDiagram-v2
    [*] --> opening
    opening --> offer_presented
    offer_presented --> tips_presented
    tips_presented --> [*]
```

## Voice Outcomes

| Outcome | Escalate | Description |
|---------|----------|-------------|
| resolved | False | Customer satisfied |
| accepted_restructuring | True | Accepted restructuring |
| counsellor_requested | True | Requested advisor |
| escalated | True | Urgent issue |
| no_call_needed | False | Monitor only |

---

## Database Tables

- customers
- weekly_features
- model_predictions
- shap_explanations
- stress_context
- interventions
- voice_sessions
- pending_interventions
- model_training_runs
