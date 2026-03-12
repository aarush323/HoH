from typing import TypedDict, List, Dict, Any, Optional

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

class stress_context(TypedDict):
        narrative : str
        stress_type: str
        severity: str

class customer_context(TypedDict):
        tenure_months: float
        loan_type: str
        relationship_value: str
        
class Main_context(TypedDict):
        total_risk_score: float
        risk_level:str
        Shap: List[shap]
        Customer_profile: customer_profile
        Stress_context: stress_context
        Customer_context: customer_context
        eligible_interventions: List[str]
        hard_stop: bool 
        hard_stop_reason: Optional[str]

        #for message agent
        Message_Tone: str
        Message_content : str

        #Intervention
        Intervention_method: str
        Intervention_justification: str


