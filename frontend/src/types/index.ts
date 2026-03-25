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
    } | null;
    audit: AuditRecord[];
}
