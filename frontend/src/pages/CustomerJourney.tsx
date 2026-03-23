import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../api/client'
import type { CustomerFullProfile, ScoreResponse, AuditRecord, WeeklyFeature } from '../types'

// ─── Sparkline Bar Component ───
function SparkBars({ data, threshold, inverted, color }: {
    data: number[]; threshold?: number; inverted?: boolean; color: string
}) {
    const max = Math.max(...data.map(Math.abs), 1)
    return (
        <div className={`h-16 relative flex ${inverted ? 'items-start' : 'items-end'} justify-between px-1`}>
            {threshold !== undefined && (
                <div
                    className={`absolute w-full border-t border-red-500/30 border-dashed`}
                    style={inverted ? { bottom: `${(Math.abs(threshold) / max) * 100}%` } : { top: `${100 - (threshold / max) * 100}%` }}
                />
            )}
            {data.map((v, i) => {
                const h = Math.max(5, (Math.abs(v) / max) * 100)
                const breach = threshold !== undefined && (inverted ? v < threshold : v > threshold)
                return (
                    <div
                        key={i}
                        className={`w-1 rounded-t-sm relative ${breach ? 'bg-red-500' : `bg-[${color}]`}`}
                        style={{ height: `${h}%`, backgroundColor: breach ? '#ef4444' : color }}
                    >
                        {i === data.length - 1 && breach && (
                            <div className="absolute -top-1 -left-0.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white" />
                        )}
                    </div>
                )
            })}
        </div>
    )
}

export default function CustomerJourney() {
    const { id } = useParams<{ id: string }>()
    const [profile, setProfile] = useState<CustomerFullProfile | null>(null)
    const [score, setScore] = useState<ScoreResponse | null>(null)
    const [audit, setAudit] = useState<AuditRecord[]>([])
    const [loading, setLoading] = useState(true)
    const [intervening, setIntervening] = useState(false)

    useEffect(() => {
        if (!id) return
        Promise.all([api.getCustomer(id), api.getScore(id), api.getAudit(id)])
            .then(([p, s, a]) => { setProfile(p); setScore(s); setAudit(a) })
            .catch(console.error)
            .finally(() => setLoading(false))
    }, [id])

    const handleIntervene = async () => {
        if (!id) return
        setIntervening(true)
        try {
            await api.intervene(id)
            const a = await api.getAudit(id)
            setAudit(a)
        } catch (e) { console.error(e) }
        finally { setIntervening(false) }
    }

    if (loading) return (
        <div className="flex items-center justify-center min-h-[60vh] text-zinc-400 text-sm">
            <div className="w-8 h-8 border-4 border-zinc-200 border-t-blue-600 rounded-full animate-spin mr-3" />
            Loading customer journey...
        </div>
    )
    if (!profile || !score) return <div className="text-center py-20 text-zinc-400">Customer not found</div>

    const c = profile.customer
    const history = [...profile.weekly_history].reverse()
    const latest: WeeklyFeature | undefined = profile.weekly_history[0]
    const initials = (c.customer_id || 'XX').slice(-2).toUpperCase()

    // SHAP data
    const shapData = (score.shap_factors || []).slice(0, 5)
    const maxShap = Math.max(...shapData.map((f) => Math.abs(f.contribution)), 0.01)

    // Helper to get weekly values
    const getWeekly = (key: keyof WeeklyFeature): number[] =>
        history.map((h) => Number(h[key]) || 0)

    const latestVal = (key: keyof WeeklyFeature): string => {
        if (!latest) return '—'
        const v = Number(latest[key])
        if (isNaN(v)) return '—'
        return key.includes('inr') ? `${(v / 1000).toFixed(1)}k` : key.includes('pct') ? `${v.toFixed(1)}%` : `${v}`
    }

    const complianceFlags = [
        { label: 'Fraud Flag', val: c.fraud_flag },
        { label: 'Existing Restructuring', val: c.existing_restructuring },
        { label: 'Payment Holiday', val: c.previous_payment_holiday },
        { label: 'NPA Flag', val: c.legal_npa_flag },
        { label: 'KYC Lapsed', val: c.kyc_lapsed },
    ]

    const riskColor = score.risk_level === 'High' ? '#ef4444' : score.risk_level === 'Medium' ? '#f59e0b' : '#10b981'
    const riskBg = score.risk_level === 'High' ? 'bg-red-500' : score.risk_level === 'Medium' ? 'bg-amber-500' : 'bg-emerald-500'

    return (
        <div className="animate-fade-in-up space-y-12 pb-28">

            {/* ─── Section 1: Identity ─── */}
            <section className="bg-white rounded-2xl p-8 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
                <div className="flex items-center gap-6">
                    <div className="w-20 h-20 rounded-full bg-[#2563eb] flex items-center justify-center text-white text-2xl font-bold tracking-tight shrink-0">
                        {initials}
                    </div>
                    <div className="space-y-1">
                        <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900">Customer {c.customer_id}</h1>
                        <p className="text-sm font-medium text-zinc-400 tabular uppercase tracking-widest">ID: {c.customer_id}</p>
                        <div className="flex flex-wrap gap-2 mt-3">
                            {[
                                c.customer_segment,
                                c.geography_zone,
                                c.product_type,
                                c.account_vintage_months ? `${c.account_vintage_months} months` : null,
                                c.loan_amount ? `₹${Number(c.loan_amount).toLocaleString()}` : null,
                                c.emi_to_income_ratio ? `Ratio ${Number(c.emi_to_income_ratio).toFixed(2)}` : null,
                            ].filter(Boolean).map((tag) => (
                                <span key={tag} className="px-3 py-1 bg-zinc-100 text-xs font-bold rounded-full uppercase tracking-tight">{tag}</span>
                            ))}
                            {c.relationship_value && (
                                <span className="px-3 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-full uppercase tracking-tight">{c.relationship_value}</span>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex flex-wrap gap-3 md:justify-end">
                    {complianceFlags.map((f) => (
                        <div
                            key={f.label}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold shadow-sm border ${f.val ? 'bg-red-50 text-red-700 border-red-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                }`}
                        >
                            <span className="material-symbols-outlined text-[16px]">{f.val ? 'cancel' : 'check_circle'}</span>
                            {f.label}
                        </div>
                    ))}
                </div>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">

                {/* ─── Section 2: Risk Score & SHAP ─── */}
                <div className="lg:col-span-4 space-y-6">
                    <div className="bg-white rounded-2xl p-8 shadow-sm flex flex-col items-center text-center">
                        <h3 className="text-[10px] font-bold text-zinc-400 mb-8 self-start uppercase tracking-[0.2em]">Credit Risk Intelligence</h3>

                        {/* Arc gauge */}
                        <div className="relative w-48 h-24 mb-4 overflow-hidden">
                            <div className="absolute inset-0 border-[12px] border-zinc-100 rounded-t-full" />
                            <div
                                className="absolute inset-0 border-[12px] rounded-t-full"
                                style={{
                                    borderColor: riskColor,
                                    clipPath: 'inset(0 0 0 0)',
                                    transform: `rotate(${Math.min(180, (score.risk_score || 0) * 180)}deg)`,
                                    transformOrigin: 'center bottom',
                                }}
                            />
                            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-2 text-4xl font-black tabular tracking-tighter">
                                {score.risk_score?.toFixed(2)}
                            </div>
                        </div>
                        <span className={`px-6 py-1.5 ${riskBg} text-white text-[10px] font-black rounded-full uppercase tracking-[0.2em] mb-8`}>
                            {score.risk_level}
                        </span>

                        {/* SHAP Bars */}
                        <div className="w-full space-y-4">
                            {shapData.map((f) => {
                                const pct = Math.min(100, (Math.abs(f.contribution) / maxShap) * 100)
                                const isUp = f.direction === 'increases_risk' || f.direction === '+' || f.contribution > 0
                                return (
                                    <div key={f.feature} className="group cursor-default">
                                        <div className="flex justify-between text-xs mb-1.5">
                                            <span className="font-medium text-zinc-500">{f.feature}</span>
                                            <span className={`font-bold ${isUp ? 'text-red-500' : 'text-emerald-500'}`}>
                                                {isUp ? '+' : ''}{f.contribution.toFixed(2)}
                                            </span>
                                        </div>
                                        <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full ${isUp ? 'bg-red-500' : 'bg-emerald-500'}`}
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        {/* Model weights */}
                        <div className="flex gap-2 mt-8 w-full">
                            <div className="flex-1 bg-zinc-50 p-3 rounded-xl border border-zinc-200/30 text-center">
                                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                                    {score.source === 'ensemble' ? 'LightGBM' : score.source || 'Model'}
                                </p>
                                <p className="text-lg font-black tabular">{score.model_version || '—'}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ─── Section 3 & 4: Engagement + Trends ─── */}
                <div className="lg:col-span-8 space-y-12">

                    {/* Engagement Signals */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            { label: 'App Logins', val: latest?.mobile_app_logins, severity: (latest?.mobile_app_logins || 0) < 3 ? 'amber' : 'green', tag: (latest?.mobile_app_logins || 0) < 3 ? 'MODERATE' : 'ACTIVE' },
                            { label: 'Stress Queries', val: latest?.financial_stress_queries, severity: (latest?.financial_stress_queries || 0) > 0 ? 'amber' : 'green', tag: (latest?.financial_stress_queries || 0) > 0 ? 'HIGH' : 'NONE' },
                            { label: 'Service Calls', val: latest?.customer_service_calls, severity: (latest?.customer_service_calls || 0) >= 3 ? 'red' : 'amber', tag: (latest?.customer_service_calls || 0) >= 3 ? 'CRITICAL' : 'NORMAL' },
                        ].map((s) => (
                            <div
                                key={s.label}
                                className={`bg-white p-6 rounded-2xl shadow-sm border-l-4 ${s.severity === 'red' ? 'border-red-500' : s.severity === 'amber' ? 'border-amber-400' : 'border-emerald-400'
                                    }`}
                            >
                                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.1em] mb-4">{s.label}</p>
                                <div className="flex items-end gap-2">
                                    <span className="text-4xl font-black tabular leading-none">{s.val ?? '—'}</span>
                                    <span className={`text-[10px] font-bold mb-1 ${s.severity === 'red' ? 'text-red-600' : s.severity === 'amber' ? 'text-amber-600' : 'text-emerald-600'
                                        }`}>{s.tag}</span>
                                </div>
                            </div>
                        ))}
                        <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-200/30 flex flex-col justify-center">
                            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-[0.1em] mb-2">GRU Intelligence</p>
                            <p className="text-sm font-bold leading-snug">
                                Stress Peak:<br />
                                <span className="text-blue-700 font-black">Week {history.length} of 12</span>
                            </p>
                        </div>
                    </div>

                    {/* Weekly Trends */}
                    <div className="bg-white rounded-2xl p-8 shadow-sm">
                        <div className="flex justify-between items-center mb-10">
                            <h2 className="text-xl font-extrabold tracking-tight">12-Week Behavioral History</h2>
                            <div className="flex gap-4 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                                <span className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-full bg-red-500" /> Breach</span>
                                <span className="flex items-center gap-1.5"><i className="w-2 h-2 border-t border-red-500 border-dashed" /> Threshold</span>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-16">
                            {[
                                { key: 'salary_delay_days' as keyof WeeklyFeature, label: 'Salary Delay Days', threshold: 3, color: '#004ac6' },
                                { key: 'avg_daily_balance_inr' as keyof WeeklyFeature, label: 'Avg Daily Balance ₹', color: '#004ac6' },
                                { key: 'auto_debit_failures' as keyof WeeklyFeature, label: 'Auto Debit Failures', threshold: 2, color: '#004ac6' },
                                { key: 'savings_drawdown_pct' as keyof WeeklyFeature, label: 'Savings Drawdown %', threshold: -20, color: '#004ac6', inverted: true },
                                { key: 'discretionary_spend_inr' as keyof WeeklyFeature, label: 'Discretionary Spend ₹', color: '#e8e8e8' },
                                { key: 'credit_card_utilization_pct' as keyof WeeklyFeature, label: 'CC Utilization %', threshold: 70, color: '#004ac6' },
                            ].map(({ key, label, threshold, color, inverted }) => {
                                const vals = getWeekly(key)
                                const latV = latestVal(key)
                                const breach = threshold !== undefined && vals.length > 0 &&
                                    (inverted ? vals[vals.length - 1] < threshold : vals[vals.length - 1] > threshold)
                                return (
                                    <div key={key} className="space-y-4">
                                        <div className="flex justify-between items-start">
                                            <p className="text-xs font-bold text-zinc-900 uppercase tracking-tight">{label}</p>
                                            <p className={`text-xs font-black tabular ${breach ? 'text-red-500' : ''}`}>{latV}</p>
                                        </div>
                                        <SparkBars data={vals} threshold={threshold} inverted={inverted} color={color} />
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {/* ─── Section 5: Intervention Timeline ─── */}
            <section className="space-y-8">
                <h2 className="text-xl font-extrabold tracking-tight">Engagement History</h2>
                <div className="relative pl-8 space-y-12 before:absolute before:left-0 before:top-2 before:bottom-0 before:w-px before:bg-zinc-200">
                    {audit.length === 0 ? (
                        <div className="text-sm text-zinc-400 py-8">No interventions yet. Click "Trigger New Intervention" below.</div>
                    ) : (
                        audit.map((a, i) => (
                            <div key={a.id} className={`relative group ${i > 0 ? 'opacity-60 hover:opacity-100 transition-opacity' : ''}`}>
                                {/* Timeline dot */}
                                <div className={`absolute top-1.5 w-${i === 0 ? '4' : '3'} h-${i === 0 ? '4' : '3'} rounded-full ${i === 0 ? 'bg-blue-600 ring-4 ring-white shadow-md -left-[37px]' : 'bg-zinc-400 ring-4 ring-white -left-[35px]'
                                    } z-10`} />

                                {i === 0 ? (
                                    /* Current (expanded) intervention */
                                    <div className="bg-white border-2 border-blue-200/40 rounded-2xl p-8 shadow-md">
                                        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                                            <div className="flex items-center gap-3">
                                                <span className="px-2 py-0.5 bg-blue-600 text-white text-[10px] font-black rounded uppercase">Current</span>
                                                <h4 className="text-lg font-bold capitalize">{a.intervention_method?.replace(/_/g, ' ') || 'Intervention'}</h4>
                                            </div>
                                            <div className="flex gap-4">
                                                {a.selected_channel && (
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Channel</span>
                                                        <span className="text-sm font-bold capitalize">{a.selected_channel.replace(/_/g, ' ')}</span>
                                                    </div>
                                                )}
                                                <div className="flex flex-col items-end">
                                                    <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Status</span>
                                                    <span className={`text-sm font-bold ${a.voice_outcome === 'accepted' ? 'text-emerald-600' :
                                                            a.voice_outcome === 'declined' ? 'text-red-600' :
                                                                a.hard_stop ? 'text-red-600' : 'text-amber-600'
                                                        }`}>
                                                        {a.voice_outcome || a.outcome || a.status || '—'} {a.voice_outcome === 'accepted' ? '✅' : a.voice_outcome === 'declined' ? '❌' : ''}
                                                    </span>
                                                </div>
                                                {a.voice_turns && (
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Turns</span>
                                                        <span className="text-sm font-black tabular">{a.voice_turns}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {a.message_content && (
                                            <div className="bg-zinc-50 p-6 rounded-xl italic text-zinc-600 relative mb-6">
                                                <span className="material-symbols-outlined absolute -top-3 -left-3 bg-white p-1 rounded-full text-blue-600">format_quote</span>
                                                "{a.message_content}"
                                            </div>
                                        )}

                                        {a.intervention_justification && (
                                            <p className="text-xs italic text-zinc-500 mb-8 border-l-2 border-blue-400/40 pl-4">
                                                {a.intervention_justification}
                                            </p>
                                        )}

                                        {a.hard_stop_reason && (
                                            <p className="text-xs text-red-600 font-medium mb-4">⚠ Hard Stop: {a.hard_stop_reason}</p>
                                        )}

                                        {a.voice_escalate && (
                                            <div className="flex flex-wrap gap-6 pt-6 border-t border-zinc-100">
                                                <div>
                                                    <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-[0.1em] mb-2">Escalation</p>
                                                    <span className="px-2 py-1 bg-red-50 text-red-700 rounded text-[10px] font-bold">
                                                        {a.voice_escalate_reason || 'Escalated'}
                                                    </span>
                                                </div>
                                            </div>
                                        )}

                                        <div className="text-[10px] text-zinc-400 mt-4">{a.created_at ? new Date(a.created_at).toLocaleString() : ''}</div>
                                    </div>
                                ) : (
                                    /* Past (collapsed) interventions */
                                    <div className="flex items-start justify-between bg-zinc-50/50 rounded-2xl p-6">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-3">
                                                <span className="text-xs font-black text-zinc-400 uppercase tracking-widest capitalize">
                                                    {a.intervention_method?.replace(/_/g, ' ') || 'Monitoring'}
                                                </span>
                                                {a.message_tone && <span className="text-sm font-bold">{a.message_tone} tone</span>}
                                            </div>
                                            <p className="text-xs text-zinc-400 font-medium line-clamp-1">
                                                {a.message_content ? `"${a.message_content}"` : a.intervention_justification || 'Standard notification sent'}
                                            </p>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className="text-xs font-bold uppercase tracking-widest">
                                                {a.created_at ? new Date(a.created_at).toLocaleDateString() : ''}
                                            </p>
                                            <p className="text-xs font-medium text-zinc-400 capitalize">
                                                {a.voice_outcome || a.outcome || a.status || '—'}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </section>

            {/* ─── Section 6: Sticky Bottom Bar ─── */}
            <footer className="fixed bottom-0 left-0 w-full bg-white border-t border-zinc-200/30 shadow-[0_-4px_24px_rgba(0,0,0,0.04)] z-50">
                <div className="max-w-screen-2xl mx-auto px-8 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <span className={`${riskBg} px-4 py-1.5 text-white text-[11px] font-black rounded-full tracking-widest uppercase shadow-md`}>
                            {c.customer_id} — {score.risk_level} Risk
                        </span>
                        <p className="hidden md:block text-xs font-bold text-zinc-500">
                            Model: {score.model_version} · Source: {score.source}
                        </p>
                    </div>
                    <button
                        onClick={handleIntervene}
                        disabled={intervening}
                        className="bg-gradient-to-br from-[#004ac6] to-[#2563eb] text-white px-8 py-3 rounded-full font-bold text-sm shadow-lg shadow-blue-500/20 transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {intervening ? (
                            <>
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Running Pipeline...
                            </>
                        ) : (
                            <>
                                <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>bolt</span>
                                Trigger New Intervention
                            </>
                        )}
                    </button>
                </div>
            </footer>
        </div>
    )
}
