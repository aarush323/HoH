// === API Response Types ===

export interface CustomerSummary {
    customer_id: string;
    name: string;
    risk_score: number;
    risk_level: 'High' | 'Medium' | 'Low';
    observation_week: string;
    product_type: string;
    customer_segment: string;
    pipeline_status?: {
        ingested: boolean;
        scored: boolean;
        analysed: boolean;
        outreach: boolean;
    };
    signals: {
        salary_delay: number;
        auto_debit_failures: number;
        savings_drawdown: number;
        utility_delay: number;
    }
}

export interface ShapFactor {
    feature: string;
    value: number;
    contribution: number;
    direction: string;
}

export interface ScoreResponse {
    customer_id: string;
    risk_score: number;
    lgb_p?: number;
    gru_p?: number;
    risk_level: string;
    shap_factors: ShapFactor[];
    observation_week: string;
    model_version: string;
    source: string;
}

export interface WeeklyFeature {
    customer_id: string;
    observation_week: string;
    salary_delay_days: number;
    salary_drop_pct: number;
    avg_daily_balance_inr: number;
    balance_trend_pct: number;
    net_cashflow_ratio: number;
    savings_drawdown_pct: number;
    savings_withdrawal_count: number;
    utility_payment_delay_days: number;
    num_bills_paid_late_last_4w: number;
    discretionary_spend_inr: number;
    discretionary_vs_4w_avg_pct: number;
    gambling_lottery_spend_inr: number;
    gambling_4w_change_pct: number;
    upi_to_lending_apps_count: number;
    upi_to_lending_apps_amount_inr: number;
    atm_vs_4w_avg_pct: number;
    auto_debit_failures: number;
    credit_card_utilization_pct: number;
    credit_inquiries_last_30d: number;
    paying_minimum_only_flag: boolean;
    mobile_app_logins: number;
    financial_stress_queries: number;
    customer_service_calls: number;
    will_default_next_2_4_weeks: boolean;
    external_shock_flag?: boolean;
    shock_type?: string;
}

export interface CustomerProfile {
    customer_id: string;
    name?: string;
    age?: number;
    customer_segment?: string;
    geography_zone?: string;
    product_type?: string;
    account_vintage_months?: number;
    tenure_months?: number;
    emi_to_income_ratio?: number;
    loan_amount?: number;
    relationship_value?: string;
    fraud_flag?: boolean;
    existing_restructuring?: boolean;
    previous_payment_holiday?: boolean;
    legal_npa_flag?: boolean;
    kyc_lapsed?: boolean;
}

export interface CustomerFullProfile {
    customer: CustomerProfile;
    weekly_history: WeeklyFeature[];
}

export interface AuditRecord {
    id: number;
    customer_id: string;
    observation_week: string;
    intervention_method: string;
    intervention_justification: string;
    eligible_interventions: string[];
    selected_channel: string;
    message_tone: string;
    message_content: string;
    hard_stop: boolean;
    hard_stop_reason: string | null;
    status: string;
    outcome: string | null;
    created_at: string;
    resolved_at: string | null;
    voice_outcome: string | null;
    voice_turns: number | null;
    voice_escalate: boolean | null;
    voice_escalate_reason: string | null;
}

export interface InterveneResponse {
    customer_id: string;
    risk_score: number;
    risk_level: string;
    hard_stop: boolean;
    hard_stop_reason: string | null;
    intervention_method: string;
    selected_channel: string | null;
    message_content: string;
    voice_outcome: string | null;
    offer_accepted: boolean | null;
    turns_taken: number | null;
}

export interface Rules {
    thresholds: Record<string, number>;
    score_weights: Record<string, number>;
    risk_levels: Record<string, number>;
}

export interface CustomerDetailOverview {
    profile: CustomerFullProfile;
    score: ScoreResponse;
    stress: {
        narrative: string;
        stress_type: string;
        severity: string;
        recommended_action?: string;
    } | null;
    audit: AuditRecord[];
}

// Extended customer type for tabular display with additional fields
export interface CustomerDetail extends CustomerSummary {
    loan_amount: number;
    last_channel: string | null;
    last_outcome: string | null;
    last_status: string | null;
    analysis?: {
        stress_type: string | null;
        severity: string | null;
        narrative: string | null;
        recommended_action: string | null;
    };
}

// Voice customer with intervention details
export interface VoiceCustomer extends CustomerDetail {
    intervention_method: string;
    intervention_date: string | null;
}

// Dashboard statistics
export interface DashboardStats {
    total_customers: number;
    high_risk_count: number;
    medium_risk_count: number;
    low_risk_count: number;
    total_exposure: number;
    at_risk_percentage: number;
    channel_mix: {
        voice: number;
        email: number;
        sms: number;
    };
    active_interventions: number;
    resolution_rate: number;
    acceptance_rate: number;
    risk_by_product: {
        home_loan: { at_risk: number };
        credit_card: { at_risk: number };
        personal_loan: { at_risk: number };
    };
    top_stress_factors: {
        factor: string;
        count: number;
        avg_contribution: number;
    }[];
}

// Journey page SSE event types
export interface JourneyCustomerEvent {
    type: 'customer';
    data: {
        customer: {
            customer_id: string;
            name?: string;
            age?: number;
            customer_segment?: string;
            geography_zone?: string;
            product_type?: string;
            account_vintage_months?: number;
            loan_amount?: number;
        };
    };
}

export interface JourneyWeekEvent {
    type: 'week';
    week: number;
    week_number: number;
    score: number;
    lgb_p: number;
    gru_p: number;
    risk_level: string;
    shap_factors: ShapFactor[];
    top_factor?: string;
    top_factor_direction?: string;
    top_factor_value?: number;
    threshold_crossed: boolean;
    signals: {
        salary_delay_days: number;
        auto_debit_failures: number;
        avg_daily_balance_inr: number;
        emi_bounced_flag: boolean;
    };
}

export interface JourneyInterventionEvent {
    type: 'intervention';
    week: number;
    week_number: number;
    score: number;
    risk_level: string;
    method: string;
    channel: string;
    message: string;
    voice_outcome: string | null;
    offer_accepted?: boolean;
    hard_stop: boolean;
    hard_stop_reason: string | null;
}

export interface JourneyCompleteEvent {
    type: 'complete';
    triggered: boolean;
}

export type JourneyEvent =
    | JourneyCustomerEvent
    | JourneyWeekEvent
    | JourneyInterventionEvent
    | JourneyCompleteEvent
    | { type: 'ping' }
    | { type: 'error'; message: string };

// === Pending Approvals Types ===

export interface PendingIntervention {
    id: number;
    customer_id: string;
    name: string;
    observation_week: string;
    risk_score: number;
    risk_level: string;
    intervention_method: string;
    intervention_justification: string;
    channel: 'voice' | 'whatsapp' | 'email' | 'none';
    message_preview: string;
    voice_script_preview: string | null;
    compliance_status: string;
    hard_stop_reason: string | null;
    status: 'PENDING' | 'APPROVED' | 'EXECUTED' | 'REJECTED';
    approved_by?: string;
    approved_at?: string;
    rejected_by?: string;
    rejection_reason?: string;
    rejected_at?: string;
    executed_at?: string;
    created_at: string;
    customer_segment?: string;
    product_type?: string;
    loan_amount?: number;
}

export interface PendingSummary {
    total: number;
    pending: number;
    approved: number;
    executed: number;
    rejected: number;
    by_risk_level: { high: number; medium: number; low: number };
    by_channel: { voice: number; whatsapp: number; email: number };
}

export interface PendingApprovalsResponse {
    pending: PendingIntervention[];
    summary: PendingSummary;
}

export interface ApproveResponse {
    status: string;
    pending_id: number;
    customer_id: string;
    channel: string;
    intervention_method: string;
    execution_result?: unknown;
    approved_by: string;
    error?: string;
}

export interface RejectResponse {
    status: string;
    pending_id: number;
    rejected_by: string;
    reason: string;
    error?: string;
}
