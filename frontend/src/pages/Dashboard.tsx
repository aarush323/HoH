import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import type { CustomerSummary, AuditRecord } from '../types'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'

function KpiCard({ label, value, badge, badgeColor, valueColor, accent }: {
    label: string; value: string; badge?: string; badgeColor?: string; valueColor?: string; accent?: string
}) {
    return (
        <div className={`bg-white p-6 rounded-2xl ghost-border shadow-sm hover:shadow-md transition-all ${accent || ''}`}>
            <div className="flex justify-between items-start mb-4">
                <span className="text-[11px] uppercase tracking-wider font-bold text-[#737686]">{label}</span>
                {badge && (
                    <span className={`text-xs font-bold flex items-center gap-1 px-2 py-0.5 rounded-full ${badgeColor}`}>
                        {badge}
                    </span>
                )}
            </div>
            <div className={`text-[2.5rem] font-black tracking-tighter tabular leading-none ${valueColor || ''}`}>
                {value}
            </div>
        </div>
    )
}

const RISK_COLORS = { High: '#ef4444', Medium: '#f59e0b', Low: '#10b981' }

export default function Dashboard() {
    const [customers, setCustomers] = useState<CustomerSummary[]>([])
    const [audit, setAudit] = useState<AuditRecord[]>([])
    const [loading, setLoading] = useState(true)
    const navigate = useNavigate()

    useEffect(() => {
        Promise.all([api.getCustomers(), api.getAudit()])
            .then(([c, a]) => { setCustomers(c); setAudit(a) })
            .catch(console.error)
            .finally(() => setLoading(false))
    }, [])

    if (loading) return <div className="flex items-center justify-center min-h-[60vh] text-zinc-400 text-sm">Loading dashboard...</div>

    const counts = { High: 0, Medium: 0, Low: 0 }
    customers.forEach((c) => { if (c.risk_level in counts) counts[c.risk_level as keyof typeof counts]++ })

    const pieData = Object.entries(counts).map(([name, value]) => ({ name, value }))
    const total = customers.length
    const highPct = total ? ((counts.High / total) * 100).toFixed(1) : '0'

    // Channel counts from audit
    const channels: Record<string, number> = {}
    const methods: Record<string, number> = {}
    let accepted = 0
    audit.forEach((a) => {
        if (a.selected_channel) channels[a.selected_channel] = (channels[a.selected_channel] || 0) + 1
        if (a.intervention_method) methods[a.intervention_method] = (methods[a.intervention_method] || 0) + 1
        if (a.voice_outcome === 'accepted' || a.outcome === 'accepted') accepted++
    })
    const successRate = audit.length ? ((accepted / audit.length) * 100).toFixed(1) : '—'

    return (
        <div className="animate-fade-in-up">
            {/* Header */}
            <div className="mb-10 flex justify-between items-end">
                <div>
                    <span className="text-[10px] uppercase tracking-widest font-bold text-[#737686] mb-1 block">
                        Institutional Grade
                    </span>
                    <h1 className="text-[1.75rem] font-bold tracking-tight text-zinc-900 leading-none">
                        Executive Dashboard
                    </h1>
                </div>
            </div>

            {/* KPI Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <KpiCard label="Total Customers" value={total.toLocaleString()} badge={`↑ ${highPct}% high`} badgeColor="bg-blue-50 text-[#004ac6]" />
                <KpiCard label="High Risk Count" value={counts.High.toLocaleString()} badge="⚠" badgeColor="bg-red-50 text-red-600" valueColor="text-red-500" accent="border-l-4 border-red-500" />
                <KpiCard label="Interventions" value={audit.length.toLocaleString()} badge="Active" badgeColor="bg-orange-50 text-orange-600" valueColor="text-orange-600" />
                <KpiCard label="Success Rate" value={`${successRate}%`} badge="✓ Stable" badgeColor="bg-emerald-50 text-emerald-600" valueColor="text-emerald-600" />
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
                {/* Risk Distribution */}
                <div className="lg:col-span-4 bg-white p-6 rounded-2xl ghost-border shadow-sm">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-[#737686] mb-6">Risk Distribution</h3>
                    <div className="flex items-center gap-6">
                        <ResponsiveContainer width={120} height={120}>
                            <PieChart>
                                <Pie data={pieData} cx="50%" cy="50%" innerRadius={35} outerRadius={55} dataKey="value" stroke="none">
                                    {pieData.map((d) => (
                                        <Cell key={d.name} fill={RISK_COLORS[d.name as keyof typeof RISK_COLORS]} />
                                    ))}
                                </Pie>
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="flex flex-col gap-3">
                            {pieData.map((d) => (
                                <div key={d.name} className="flex items-center justify-between gap-6">
                                    <div className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: RISK_COLORS[d.name as keyof typeof RISK_COLORS] }} />
                                        <span className="text-sm font-medium">{d.name}</span>
                                    </div>
                                    <span className="text-sm font-bold tabular">{d.value.toLocaleString()}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Channel Distribution */}
                <div className="lg:col-span-4 bg-white p-6 rounded-2xl ghost-border shadow-sm">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-[#737686] mb-6">Channel Distribution</h3>
                    <div className="space-y-3">
                        {Object.entries(channels).map(([ch, cnt]) => (
                            <div key={ch} className="flex items-center justify-between">
                                <span className="text-sm font-medium capitalize">{ch.replace('_', ' ')}</span>
                                <div className="flex items-center gap-3">
                                    <div className="w-32 h-2 bg-zinc-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-[#004ac6] rounded-full"
                                            style={{ width: `${(cnt / Math.max(...Object.values(channels))) * 100}%` }}
                                        />
                                    </div>
                                    <span className="text-sm font-bold tabular w-8 text-right">{cnt}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Intervention Funnel */}
                <div className="lg:col-span-4 bg-white p-6 rounded-2xl ghost-border shadow-sm">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-[#737686] mb-6">Intervention Funnel</h3>
                    <div className="space-y-4">
                        {[
                            { label: 'Flagged', value: counts.High + counts.Medium, pct: 100 },
                            { label: 'Triggered', value: audit.length, pct: total ? (audit.length / (counts.High + counts.Medium)) * 100 : 0 },
                            { label: 'Dispatched', value: audit.filter((a) => a.status === 'dispatched').length, pct: audit.length ? (audit.filter((a) => a.status === 'dispatched').length / audit.length) * 100 : 0 },
                            { label: 'Accepted', value: accepted, pct: audit.length ? (accepted / audit.length) * 100 : 0 },
                        ].map((s) => (
                            <div key={s.label}>
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-sm font-semibold">{s.label}</span>
                                    <span className="text-sm font-bold tabular">{s.value}</span>
                                </div>
                                <div className="h-3 w-full bg-zinc-100 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full ${s.label === 'Accepted' ? 'bg-emerald-500' : 'bg-[#2563eb]'}`}
                                        style={{ width: `${Math.min(100, s.pct)}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Recent Activity Table */}
            <section className="bg-white rounded-2xl ghost-border shadow-sm overflow-hidden">
                <div className="p-6 border-b border-zinc-100 flex justify-between items-center">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-900">Recent Activity Feed</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-zinc-50 text-[10px] uppercase tracking-widest font-bold text-[#737686]">
                                <th className="px-6 py-3">Customer ID</th>
                                <th className="px-6 py-3">Risk Tier</th>
                                <th className="px-6 py-3">Intervention</th>
                                <th className="px-6 py-3">Channel</th>
                                <th className="px-6 py-3">Status</th>
                                <th className="px-6 py-3 text-right">Time</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-50">
                            {audit.slice(0, 10).map((a) => {
                                const cust = customers.find((c) => c.customer_id === a.customer_id)
                                const rl = cust?.risk_level || 'Medium'
                                return (
                                    <tr
                                        key={a.id}
                                        className="hover:bg-zinc-50 transition-colors cursor-pointer"
                                        onClick={() => navigate(`/customer/${a.customer_id}`)}
                                    >
                                        <td className="px-6 py-4 text-sm font-bold tabular">{a.customer_id}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase ${rl === 'High' ? 'bg-red-50 text-red-700' : rl === 'Medium' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
                                                }`}>{rl}</span>
                                        </td>
                                        <td className="px-6 py-4 text-sm font-medium capitalize">{a.intervention_method?.replace(/_/g, ' ') || '—'}</td>
                                        <td className="px-6 py-4 text-sm text-zinc-500 capitalize">{a.selected_channel?.replace(/_/g, ' ') || '—'}</td>
                                        <td className="px-6 py-4">
                                            <span className={`flex items-center gap-1.5 text-xs font-semibold ${a.voice_outcome === 'accepted' || a.outcome === 'accepted' ? 'text-emerald-600' :
                                                    a.status === 'dispatched' ? 'text-blue-600' :
                                                        a.hard_stop ? 'text-red-600' : 'text-amber-600'
                                                }`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${a.voice_outcome === 'accepted' || a.outcome === 'accepted' ? 'bg-emerald-600' :
                                                        a.status === 'dispatched' ? 'bg-blue-600' :
                                                            a.hard_stop ? 'bg-red-600' : 'bg-amber-600'
                                                    }`} />
                                                {a.voice_outcome || a.outcome || a.status || '—'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm tabular text-zinc-400 text-right">
                                            {a.created_at ? new Date(a.created_at).toLocaleTimeString() : '—'}
                                        </td>
                                    </tr>
                                )
                            })}
                            {audit.length === 0 && (
                                <tr><td colSpan={6} className="px-6 py-12 text-center text-zinc-400 text-sm">No intervention records yet. Start the Kafka pipeline to see data.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    )
}
