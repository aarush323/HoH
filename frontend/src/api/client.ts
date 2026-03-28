import type {
    CustomerSummary,
    CustomerDetail,
    VoiceCustomer,
    CustomerFullProfile,
    ScoreResponse,
    AuditRecord,
    InterveneResponse,
    Rules,
    DashboardStats,
    PendingIntervention,
    PendingApprovalsResponse,
    ApproveResponse,
    RejectResponse,
} from '../types';

const BASE = '/api';

async function get<T>(path: string): Promise<T> {
    const res = await fetch(`${BASE}${path}`);
    if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
    return res.json();
}

async function post<T>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : '{}',
    });
    if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
    return res.json();
}

export const api = {
    getCustomers: () => get<CustomerSummary[]>('/customers'),
    getCustomersAll: () => get<CustomerDetail[]>('/customers/all'),
    getCustomersVoice: () => get<VoiceCustomer[]>('/customers/voice'),
    getDashboardStats: () => get<DashboardStats>('/dashboard/stats'),
    getEarlyWarnings: () => get<{
        salary_delayed: number;
        savings_drawdown: number;
        lending_app_activity: number;
        utility_delay: number;
        auto_debit_failures: number;
        emi_bounced: number;
        missed_emis: number;
        gambling_detected: number;
        high_cc_utilization: number;
        external_shocks: number;
    }>('/dashboard/early-warnings'),
    getStressTypes: () => get<{ distribution: Array<{ name: string; value: number }> }>('/dashboard/stress-types'),
    getBehavioral: () => get<{
        lending_app_users: number;
        lending_app_total_amount: number;
        gambling_users: number;
        gambling_total_amount: number;
        high_cc_util_users: number;
        avg_cc_utilization: number;
        savings_drawdown_users: number;
        avg_savings_drawdown: number;
    }>('/dashboard/behavioral'),
    getShocks: () => get<{ shocks: Array<{ name: string; value: number }> }>('/dashboard/shocks'),
    getRiskTrend: () => get<{
        trend: Array<{
            week: string;
            avg_risk_score: number;
            customer_count: number;
            high_risk_count: number;
            medium_risk_count: number;
        }>;
    }>('/dashboard/risk-trend'),
    getCustomer: (id: string) => get<CustomerFullProfile>(`/customers/${id}`),
    getScore: (id: string) => get<ScoreResponse>(`/score/${id}`),
    intervene: (id: string) => post<InterveneResponse>(`/intervene/${id}`),
    getAudit: (id?: string) =>
        get<AuditRecord[]>(id ? `/audit/${id}` : '/audit'),
    getCustomerDetail: (id: string) => get<{
        profile: CustomerFullProfile;
        score: ScoreResponse;
        stress: { narrative: string; stress_type: string; severity: string } | null;
        audit: AuditRecord[];
    }>(`/customer/${id}/detail`),
    getRules: () => get<Rules>('/rules'),
    getHealth: () => get<{ status: string; model: string }>('/health'),
    triggerProducer: () => post<{ status: string; messages_sent: number }>('/trigger-producer'),
    
    // Pending Approvals API
    getPendingApprovals: (riskLevel?: string, status?: string) => {
        let url = '/pending-approvals';
        const params = new URLSearchParams();
        if (riskLevel) params.append('risk_level', riskLevel);
        if (status) params.append('status', status);
        if (params.toString()) url += `?${params.toString()}`;
        return get<PendingApprovalsResponse>(url);
    },
    getPendingDetail: (id: number) => get<PendingIntervention>(`/pending-approvals/${id}`),
    approvePending: (id: number, approvedBy?: string) => 
        post<ApproveResponse>(`/pending-approvals/${id}/approve`, { approved_by: approvedBy || 'manager' }),
    rejectPending: (id: number, reason: string, rejectedBy?: string) =>
        post<RejectResponse>(`/pending-approvals/${id}/reject`, { 
            rejection_reason: reason,
            rejected_by: rejectedBy || 'manager'
        }),

    // Behavioural Feature Inference
    classifyTransaction: (merchant: string, amount: number, mcc?: string) =>
        post<{ category: string; source: string; confidence: number; reason: string }>(
            '/behaviour/classify', { merchant, amount, mcc }
        ),
    classifyBatch: (customerId: string, transactions: Array<{ merchant: string; amount: number; mcc?: string }>) =>
        post<{
            customer_id: string;
            transaction_count: number;
            classified_transactions: Array<{
                merchant: string;
                amount: number;
                category: string;
                source: string;
                confidence: number;
                reason: string;
            }>;
            derived_features: {
                gambling_lottery_spend_inr: number;
                discretionary_spend_inr: number;
                essential_spend_inr: number;
                lending_app_count: number;
                lending_app_amount_inr: number;
                atm_withdrawals: number;
                total_transactions: number;
            };
        }>('/behaviour/batch', { customer_id: customerId, transactions }),
    getSampleTransactions: () =>
        get<{ transactions: Array<{ merchant: string; amount: number }> }>('/behaviour/sample'),
    getSample12Weeks: () =>
        get<{ transactions_by_week: Record<string, Array<{ merchant: string; amount: number }>> }>('/behaviour/sample-12weeks'),
    getProfiles: () =>
        get<{ profiles: Array<{ key: string; name: string; profile: string; description: string }> }>('/behaviour/profiles'),
    analyzeProfile: (profileKey: string) =>
        post<{
            profile_key: string;
            weekly: Record<string, {
                gambling_lottery_spend_inr: number;
                discretionary_spend_inr: number;
                luxury_spend_inr: number;
                gig_income_inr: number;
                recreation_spend_inr: number;
                lending_app_amount_inr: number;
                essential_spend_inr: number;
                salary_income_inr: number;
                total_transactions: number;
            }>;
            totals: {
                gambling_lottery_spend_inr: number;
                discretionary_spend_inr: number;
                luxury_spend_inr: number;
                gig_income_inr: number;
                recreation_spend_inr: number;
                lending_app_amount_inr: number;
                essential_spend_inr: number;
                salary_income_inr: number;
                total_transactions: number;
            };
            trends: Record<string, number>;
            gig_worker_score: number;
            week_count: number;
            classification_breakdown: Array<{
                merchant: string;
                amount: number;
                week: string;
                category: string;
                layer: string;
                confidence: number;
                reason: string;
            }>;
            score_factors: {
                gig_transaction_count: number;
                total_transactions: number;
                gig_ratio: number;
                calculation: string;
                has_gig_income: boolean;
                formula: string;
            };
            category_distribution: Array<{
                category: string;
                count: number;
                percentage: number;
            }>;
        }>('/behaviour/analyze-profile', { profile_key: profileKey }),
};

// SSE stream hook helper
export function createEventSource(): EventSource {
    return new EventSource(`${BASE}/stream`);
}
