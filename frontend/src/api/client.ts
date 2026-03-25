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
};

// SSE stream hook helper
export function createEventSource(): EventSource {
    return new EventSource(`${BASE}/stream`);
}
