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
    PendingSummary,
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
};

// SSE stream hook helper
export function createEventSource(): EventSource {
    return new EventSource(`${BASE}/stream`);
}
