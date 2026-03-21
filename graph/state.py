from typing import TypedDict, List, Dict, Any, Optional

VALID_STRESS_TYPES = {"income_shock", "overspending", "structural", "debt", "unknown"}
RELATIONSHIP_VALUES = {"High", "Medium", "Low"}
CHANNELS = {"voice", "sms_whatsapp", "email", "none"}


class shap(TypedDict):
    feature: str
    value: float
    contribution: float
    direction: str


class customer_profile(TypedDict):
    customer_id: str
    name: str
    tenure_months: float
    loan_type: str
    loan_amount: float
    relationship_value: str
    fraud_flag: bool
    existing_restructuring: bool
    previous_payment_holiday: bool
    legal_npa_flag: bool
    kyc_lapsed: bool


class stress_context(TypedDict):
    narrative: str
    stress_type: str
    severity: str


class voice_result(TypedDict):
    escalate: bool
    escalate_reason: Optional[str]
    outcome: str
    turns_taken: int
    language_detected: str
    call_memory: dict


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

    # for message agent
    Message_Tone: str
    Message_content: str

    # Intervention
    Intervention_method: str
    Intervention_justification: str

    # Channel dispatch fields
    selected_channel: Optional[str]
    channel_dispatch_result: Optional[dict]

    # Voice agent fields
    voice_payload: Optional[dict]
    voice_result: Optional[voice_result]
