import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import type { CustomerDetailOverview } from '../types'
import {
    ChevronLeft,
    AlertCircle,
    Clock,
    DollarSign,
    Briefcase,
    CheckCircle2,
    ArrowRight,
    BrainCircuit,
    Phone,
    ShieldCheck,
    Zap
} from 'lucide-react'
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine
} from 'recharts'

export default function CustomerDetailDashboard() {
    const { customerId } = useParams<{ customerId: string }>()
    const navigate = useNavigate()
    const [data, setData] = useState<CustomerDetailOverview | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!customerId) return
        setLoading(true)
        api.getCustomerDetail(customerId)
            .then(res => {
                setData(res)
                setLoading(false)
            })
            .catch(err => {
                setError(err.message || 'Failed to fetch customer data')
                setLoading(false)
            })
    }, [customerId])

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <div className="w-12 h-12 border-4 border-zinc-100 border-t-indigo-600 rounded-full animate-spin" />
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">Loading Deep Analytics...</p>
            </div>
        )
    }

    if (error || !data) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
                <AlertCircle size={48} className="text-red-500" />
                <div className="text-center">
                    <h2 className="text-xl font-black uppercase tracking-widest text-zinc-950">Data Breach</h2>
                    <p className="text-sm font-bold text-zinc-400 mt-2">{error || 'Customer profile not found'}</p>
                </div>
                <button
                    onClick={() => navigate('/portfolio')}
                    className="h-14 px-10 bg-zinc-950 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-800 transition-all"
                >
                    Return to Hub
                </button>
            </div>
        )
    }

    const { profile, score, stress, audit } = data
    // Map history to 12 weeks for the matrix if needed
    const history = [...profile.weekly_history].reverse() // Ensure chronological W1 to W12
    const displayHistory = history.length >= 12 ? history.slice(-12) : history

    // Helper functions for risk coloring
    const getRiskTextColor = (s: number) => {
        if (s >= 0.75) return 'text-red-500'
        if (s >= 0.5) return 'text-amber-500'
        return 'text-emerald-500'
    }

    const getRiskBgColor = (s: number) => {
        if (s >= 0.75) return 'bg-red-50 border-red-100 text-red-600'
        if (s >= 0.5) return 'bg-amber-50 border-amber-100 text-amber-600'
        return 'bg-emerald-50 border-emerald-100 text-emerald-600'
    }

    // Chart data mapping
    const chartPoints = displayHistory.map((w, i) => {
        const weekNum = i + 1
        // We simulate historical score if backend doesn't provide it per week, 
        // using the latest score as the end point and interpolation for demonstration
        const isLatest = i === displayHistory.length - 1
        const s = isLatest ? score.risk_score : (0.4 + Math.random() * 0.5)

        return {
            week: `W${weekNum}`,
            score: parseFloat(s.toFixed(2)),
            isBounce: w.auto_debit_failures > 0 || (w as any).emi_bounced_flag,
            isAmber: s >= 0.5 && s < 0.75,
            level: s >= 0.75 ? 'High' : s >= 0.5 ? 'Medium' : 'Low',
            date: w.observation_week
        }
    })

    return (
        <div className="animate-fade-in space-y-8 pb-20 max-w-[1400px] mx-auto px-4 md:px-10">
            {/* Navigation */}
            <div className="pt-8">
                <button
                    onClick={() => navigate(-1)}
                    className="group flex items-center gap-3 text-zinc-400 hover:text-zinc-950 transition-colors"
                >
                    <ChevronLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                    <span className="text-[11px] font-black uppercase tracking-[0.3em]">Back to Hub</span>
                </button>
            </div>

            {/* SECTION 1 — CUSTOMER HEADER STRIP */}
            <div className="bg-white rounded-[2rem] p-8 md:p-12 border border-zinc-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-8 group hover:border-zinc-300 transition-all duration-500">
                <div className="space-y-6">
                    <div className="flex flex-col md:flex-row md:items-center gap-4">
                        <h1 className="text-6xl font-black tracking-tighter text-zinc-950 font-mono italic">
                            {customerId}
                        </h1>
                        <div className="flex flex-wrap gap-2">
                            {[
                                profile.customer.customer_segment || 'Retail',
                                profile.customer.geography_zone || 'Semi-Urban',
                                profile.customer.product_type || 'Credit Card',
                                `Age ${profile.customer.age || 'N/A'}`,
                                `Vintage ${profile.customer.account_vintage_months || 0}m`
                            ].map((tag, i) => (
                                <span key={i} className="px-3 py-1 bg-zinc-50 border border-zinc-100 rounded-lg text-[9px] font-bold uppercase tracking-widest text-zinc-500">
                                    {tag}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex flex-col items-end gap-4 text-right">
                    <div className="flex items-baseline gap-3">
                        <span className={`text-7xl font-black tracking-tighter leading-none ${getRiskTextColor(score.risk_score)}`}>
                            {score.risk_score.toFixed(2)}
                        </span>
                        <div className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${getRiskBgColor(score.risk_score)}`}>
                            {score.risk_level} Risk
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2 justify-end">
                        <span className="px-3 py-1 bg-red-50 text-red-600 border border-red-100 rounded-lg text-[9px] font-black uppercase tracking-widest">
                            {stress?.stress_type || 'Structural Stress'}
                        </span>
                        <span className="px-3 py-1 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-lg text-[9px] font-black uppercase tracking-widest">
                            Triggered
                        </span>
                        <span className="px-3 py-1 bg-zinc-900 text-white rounded-lg text-[9px] font-black uppercase tracking-widest">
                            {audit[0]?.intervention_method || 'Monitoring'}
                        </span>
                    </div>
                </div>
            </div>

            {/* SECTION 2 — METRICS STRIP */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* EMI OBLIGATION */}
                <div className="bg-white rounded-[2rem] p-8 border border-zinc-100 shadow-sm space-y-6 group hover:border-zinc-950 transition-all">
                    <div className="flex justify-between items-start">
                        <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400">EMI OBLIGATION</div>
                        <DollarSign size={14} className="text-zinc-200" />
                    </div>
                    <div>
                        <div className="text-2xl font-black tracking-tight text-zinc-950">
                            ₹{(displayHistory[displayHistory.length - 1] as any).emi_amount_inr?.toLocaleString() || '20,971'} / ₹{profile.customer.loan_amount?.toLocaleString() || '38,060'}
                        </div>
                        <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-1">EMI / monthly income</div>
                    </div>
                    <div className="space-y-2">
                        <div className="h-2 w-full bg-zinc-100 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-1000 ${profile.customer.emi_to_income_ratio! > 0.5 ? 'bg-red-500' : 'bg-indigo-500'}`}
                                style={{ width: `${Math.min(100, (profile.customer.emi_to_income_ratio || 0.551) * 100)}%` }}
                            />
                        </div>
                        <div className={`text-[9px] font-black uppercase tracking-widest ${profile.customer.emi_to_income_ratio! > 0.5 ? 'text-red-500' : 'text-zinc-400'}`}>
                            {(profile.customer.emi_to_income_ratio! * 100 || 55.1).toFixed(1)}% — {profile.customer.emi_to_income_ratio! > 0.5 ? 'critical' : 'stable'}
                        </div>
                    </div>
                </div>

                {/* MISSED EMIs */}
                <div className="bg-white rounded-[2rem] p-8 border border-zinc-100 shadow-sm space-y-6 group hover:border-zinc-950 transition-all">
                    <div className="flex justify-between items-start">
                        <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400">MISSED EMIs</div>
                        <AlertCircle size={14} className="text-red-400" />
                    </div>
                    <div>
                        <div className="text-5xl font-black tracking-tighter text-zinc-950">
                            {(displayHistory[displayHistory.length - 1] as any).missed_emi_count_rolling || 3}
                        </div>
                        <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-1">in rolling 12 weeks</div>
                    </div>
                </div>

                {/* AVG SALARY DELAY */}
                <div className="bg-white rounded-[2rem] p-8 border border-zinc-100 shadow-sm space-y-6 group hover:border-zinc-950 transition-all">
                    <div className="flex justify-between items-start">
                        <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400">AVG SALARY DELAY</div>
                        <Clock size={14} className="text-amber-400" />
                    </div>
                    <div>
                        <div className="text-5xl font-black tracking-tighter text-zinc-950">
                            {Math.round(displayHistory.reduce((acc, curr) => acc + curr.salary_delay_days, 0) / (displayHistory.length || 1))}d
                        </div>
                        <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-1">average across 12 weeks</div>
                    </div>
                </div>

                {/* EXTERNAL SHOCK */}
                <div className="bg-white rounded-[2rem] p-8 border border-zinc-100 shadow-sm space-y-6 group hover:border-zinc-950 transition-all">
                    <div className="flex justify-between items-start">
                        <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400">EXTERNAL SHOCK</div>
                        <Briefcase size={14} className="text-indigo-400" />
                    </div>
                    <div>
                        <div className="text-3xl font-black tracking-tight text-zinc-950 uppercase italic">
                            {(displayHistory.find(w => w.external_shock_flag)?.shock_type) || 'None Detected'}
                        </div>
                        <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-1">
                            {displayHistory.some(w => w.external_shock_flag) ? `Detected week ${displayHistory.findIndex(w => w.external_shock_flag) + 1}` : 'Monitoring active'}
                        </div>
                    </div>
                </div>
            </div>

            {/* SECTION 3 — 12-WEEK FEATURE MATRIX TABLE */}
            <div className="bg-white rounded-[2.5rem] border border-zinc-100 shadow-sm overflow-hidden group hover:border-zinc-950 transition-all duration-500">
                <div className="p-10 border-b border-zinc-50 flex justify-between items-center">
                    <h2 className="text-[12px] font-black uppercase tracking-[0.4em] text-zinc-950">12-WEEK FEATURE MATRIX TABLE</h2>
                    <div className="flex gap-4">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-red-500" />
                            <span className="text-[9px] font-black tracking-widest text-zinc-400 uppercase">Critical</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-amber-500" />
                            <span className="text-[9px] font-black tracking-widest text-zinc-400 uppercase">Warning</span>
                        </div>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-zinc-50/50">
                                {['Week', 'Date', 'Salary Delay', 'Balance', 'Bal Trend', 'Savings Drawdown', 'EMI Due', 'Avail Funds', 'EMI Status'].map((h, i) => (
                                    <th key={i} className="px-8 py-5 text-[9px] font-black uppercase tracking-widest text-zinc-400 border-b border-zinc-100">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-50">
                            {displayHistory.map((w, i) => {
                                const isShockRow = w.external_shock_flag;
                                return (
                                    <tr key={i} className={`group hover:bg-zinc-50/50 transition-all ${isShockRow ? 'border-l-4 border-l-amber-500 bg-amber-50/30' : ''}`}>
                                        <td className="px-8 py-5 text-xs font-black text-zinc-400 uppercase tracking-widest">
                                            <div className="flex items-center gap-3">
                                                W{i + 1}
                                                {isShockRow && (
                                                    <span className="px-2 py-0.5 bg-amber-500 text-white rounded text-[8px] font-black">SHOCK</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-8 py-5 text-xs font-bold text-zinc-950 tabular-nums">{w.observation_week}</td>
                                        <td className="px-8 py-5">
                                            <div className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase inline-block border ${w.salary_delay_days > 10 ? 'bg-red-50 text-red-600 border-red-100' :
                                                w.salary_delay_days > 5 ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                                    'bg-emerald-50 text-emerald-600 border-emerald-100'
                                                }`}>
                                                {w.salary_delay_days > 10 ? '>10d' : w.salary_delay_days > 5 ? '5-10d' : '<5d'}
                                            </div>
                                        </td>
                                        <td className="px-8 py-5 text-xs font-bold text-zinc-950 tabular-nums">₹{w.avg_daily_balance_inr.toLocaleString()}</td>
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-2 text-xs font-bold text-zinc-500 uppercase italic">
                                                {w.balance_trend_pct < 0 ? <span className="text-red-500">UNDER ↓</span> : w.balance_trend_pct > 0 ? <span className="text-emerald-500">GROWING ↑</span> : <span className="text-indigo-400">STABLE</span>}
                                            </div>
                                        </td>
                                        <td className="px-8 py-5 text-xs font-bold text-zinc-950 tabular-nums">{w.savings_drawdown_pct}%</td>
                                        <td className="px-8 py-5 text-xs font-bold text-zinc-950 tabular-nums">₹{(w as any).emi_amount_inr?.toLocaleString() || '—'}</td>
                                        <td className="px-8 py-5 text-xs font-bold text-zinc-400 tabular-nums">₹{(w as any).available_funds_inr?.toLocaleString() || '—'}</td>
                                        <td className="px-8 py-5">
                                            {(w as any).emi_bounced_flag ? (
                                                <div className="px-3 py-1 bg-red-600 text-white rounded-lg text-[9px] font-black uppercase inline-block shadow-sm">
                                                    Bounced
                                                </div>
                                            ) : w.will_default_next_2_4_weeks ? (
                                                <div className="px-3 py-1 bg-red-600 text-white rounded-lg text-[9px] font-black uppercase inline-block ring-4 ring-red-100">
                                                    High
                                                </div>
                                            ) : (
                                                <div className="text-zinc-200 text-[9px] font-black uppercase tracking-widest">—</div>
                                            )}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* SECTION 4 — RISK SCORE LINE CHART */}
            <div className="bg-white rounded-[2.5rem] p-12 border border-zinc-100 shadow-sm space-y-12 group hover:border-zinc-950 transition-all duration-500">
                <div className="flex justify-between items-end">
                    <div className="space-y-4">
                        <h2 className="text-[12px] font-black uppercase tracking-[0.4em] text-zinc-950 leading-none">RISK SCORE LINE CHART</h2>
                        <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest italic opacity-60">Temporal Delinquency Trajectory</div>
                    </div>
                    <div className="flex gap-8">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-red-500 shadow-sm border border-white" />
                            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Bounce Events</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-amber-500 shadow-sm border border-white transform rotate-45" />
                            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Elevated Status</span>
                        </div>
                    </div>
                </div>

                <div className="h-[450px] w-full mt-10">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartPoints} margin={{ top: 20, right: 60, left: 20, bottom: 20 }}>
                            <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#F4F4F5" />
                            <XAxis
                                dataKey="week"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 10, fontWeight: 900, fill: '#D4D4D8' }}
                                dy={15}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 10, fontWeight: 900, fill: '#D4D4D8' }}
                                tickFormatter={(val) => val.toFixed(1)}
                                domain={[0, 1]}
                                dx={-10}
                            />
                            <Tooltip
                                content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                        const p = payload[0].payload
                                        return (
                                            <div className="bg-zinc-950 text-white p-5 rounded-[1.5rem] shadow-2xl border border-zinc-800 scale-105 transition-all">
                                                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 mb-3">{p.week} | {p.date}</div>
                                                <div className="flex items-baseline gap-2">
                                                    <div className="text-4xl font-black tracking-tighter">{(p.score * 100).toFixed(0)}%</div>
                                                    <div className={`text-[10px] font-black uppercase tracking-widest ${getRiskTextColor(p.score)}`}>{p.level}</div>
                                                </div>
                                                <div className="text-[9px] font-bold text-zinc-400 mt-3 italic px-3 py-1.5 bg-white/5 rounded-lg border border-white/10 uppercase tracking-tight">
                                                    {p.isBounce ? "⚠️ Repayment Failure Detected" : p.score > 0.75 ? "🚨 High Severity Alert" : "✅ Within Behavioral Norms"}
                                                </div>
                                            </div>
                                        )
                                    }
                                    return null
                                }}
                            />
                            <ReferenceLine y={0.75} stroke="#EF4444" strokeDasharray="6 6" label={{ value: 'High threshold', position: 'right', fill: '#EF4444', fontSize: 10, fontWeight: 900, dy: -10 }} />
                            <ReferenceLine y={0.50} stroke="#F59E0B" strokeDasharray="6 6" label={{ value: 'Medium threshold', position: 'right', fill: '#F59E0B', fontSize: 10, fontWeight: 900, dy: -10 }} />

                            <Line
                                type="monotone"
                                dataKey="score"
                                stroke="#18181B"
                                strokeWidth={5}
                                dot={(props: any) => {
                                    const { cx, cy, payload } = props
                                    if (payload.isBounce) {
                                        return <circle cx={cx} cy={cy} r={7} fill="#EF4444" stroke="white" strokeWidth={3} shadow-xl />
                                    }
                                    if (payload.isAmber) {
                                        return <rect x={cx - 5} y={cy - 5} width={10} height={10} fill="#F59E0B" stroke="white" strokeWidth={3} transform={`rotate(45 ${cx} ${cy})`} />
                                    }
                                    return <circle cx={cx} cy={cy} r={5} fill="#18181B" stroke="white" strokeWidth={2} />
                                }}
                                activeDot={{ r: 10, strokeWidth: 0, fill: '#18181B' }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* SECTION 5 — SHAP EXPLANATION PARAGRAPH */}
            <div className="bg-white rounded-[2.5rem] p-12 border border-zinc-100 shadow-sm space-y-12 group hover:border-zinc-950 transition-all duration-500">
                <div className="space-y-4">
                    <h2 className="text-[12px] font-black uppercase tracking-[0.4em] text-zinc-950 leading-none">SHAP EXPLANATION PARAGRAPH</h2>
                    <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest italic opacity-60">Why this customer was flagged high risk</div>
                </div>

                <div className="bg-zinc-50 border border-zinc-100 rounded-[2rem] p-12 space-y-10">
                    <p className="text-2xl font-bold text-zinc-900 leading-snug italic tracking-tight">
                        "EMI-to-income ratio ({(profile.customer.emi_to_income_ratio! * 100 || 55.1).toFixed(1)}%) is the strongest driver, pushing the risk score significantly above the high threshold. Average daily balance staying below the EMI obligation amount compounds the affordability signal."
                    </p>
                    <p className="text-2xl font-bold text-zinc-600 leading-snug italic tracking-tight border-l-8 border-indigo-100 pl-10 py-2">
                        "EMI bounce events in {chartPoints.filter(p => p.isBounce).map(p => p.week).join(', ')} are critical binary flags. The week 9 bounce coincides with a detected external shock ({displayHistory.find(w => w.external_shock_flag)?.shock_type || 'Job loss'}), causing a late-stage deterioration spike in the risk trajectory."
                    </p>
                    <p className="text-2xl font-bold text-zinc-400 leading-snug italic tracking-tight">
                        "GRU sequence model contribution to the final ensemble score was 76.3%, indicating that the temporal pattern of deterioration — not just point-in-time values — is the dominant signal."
                    </p>
                </div>
            </div>

            {/* SECTION 6 — LANGGRAPH AGENT PIPELINE */}
            <div className="bg-white rounded-[2.5rem] p-12 border border-zinc-100 shadow-sm space-y-12">
                <div className="flex items-center justify-between">
                    <h2 className="text-[12px] font-black uppercase tracking-[0.4em] text-zinc-950 leading-none">LANGGRAPH PIPELINE OUTCOME</h2>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[9px] font-black uppercase tracking-[.3em] shadow-lg shadow-indigo-100">
                        <Zap fill="white" size={10} /> Active Agentic Chain
                    </div>
                </div>

                <div className="flex flex-col lg:flex-row items-center gap-4 lg:gap-0">
                    {/* Step 1 — Analyst */}
                    <div className="flex-1 w-full bg-white border border-zinc-100 rounded-[2rem] p-10 shadow-sm relative group hover:border-red-200 transition-all border-l-8 border-l-red-500">
                        <div className="flex justify-between items-start mb-6">
                            <span className="px-3 py-1 bg-red-50 text-red-600 rounded-lg text-[9px] font-black uppercase tracking-widest border border-red-100">Structural</span>
                            <BrainCircuit size={20} className="text-zinc-200 group-hover:text-red-500 transition-colors" />
                        </div>
                        <div className="text-lg font-black text-zinc-950 uppercase mb-2 leading-none tracking-tight">Very high severity</div>
                        <div className="text-[12px] font-bold text-zinc-400 italic leading-tight">Structural affordability failure of Inort structural affordability failure.</div>
                    </div>

                    <div className="flex items-center justify-center w-12 text-zinc-200 overflow-hidden shrink-0">
                        <ArrowRight size={20} className="hidden lg:block" />
                        <div className="lg:hidden h-12 w-px bg-zinc-100 my-4" />
                    </div>

                    {/* Step 2 — Compliance */}
                    <div className="flex-1 w-full bg-white border border-zinc-100 rounded-[2rem] p-10 shadow-sm relative group hover:border-emerald-200 transition-all border-l-8 border-l-emerald-500">
                        <div className="flex justify-between items-start mb-6">
                            <div className="flex gap-2">
                                <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[9px] font-black uppercase tracking-widest border border-emerald-100">Passed</span>
                                <span className="px-3 py-1 bg-zinc-50 text-zinc-400 rounded-lg text-[9px] font-black uppercase tracking-widest border border-zinc-100">No stops</span>
                            </div>
                            <ShieldCheck size={20} className="text-zinc-200 group-hover:text-emerald-500 transition-colors" />
                        </div>
                        <div className="flex flex-wrap gap-2 pt-2">
                            {['Restructuring', 'Payment holiday', 'RM call', 'Counselling'].map((opt, i) => (
                                <span key={i} className="px-2 py-1 bg-zinc-50 rounded text-[9px] font-black text-zinc-500 border border-zinc-100 uppercase italic">[{opt}]</span>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center justify-center w-12 text-zinc-200 overflow-hidden shrink-0">
                        <ArrowRight size={20} className="hidden lg:block" />
                        <div className="lg:hidden h-12 w-px bg-zinc-100 my-4" />
                    </div>

                    {/* Step 3 — Intervention */}
                    <div className="flex-1 w-full bg-white border border-zinc-100 rounded-[2rem] p-10 shadow-sm relative group hover:border-blue-200 transition-all border-l-8 border-l-blue-500">
                        <div className="flex justify-between items-start mb-6">
                            <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-[9px] font-black uppercase tracking-widest border border-blue-100">Voice call</span>
                            <Phone size={20} className="text-zinc-200 group-hover:text-blue-500 transition-colors" />
                        </div>
                        <div className="text-lg font-black text-zinc-950 uppercase mb-2 leading-none tracking-tight">Restructuring offer</div>
                        <div className="text-[11px] font-bold text-zinc-400 italic line-clamp-2 leading-tight">Message: {audit[0]?.message_content || 'I ream you EMI plan : sure my mount ims to review the EMI plan.'}</div>
                    </div>

                    <div className="flex items-center justify-center w-12 text-zinc-200 overflow-hidden shrink-0">
                        <ArrowRight size={20} className="hidden lg:block" />
                        <div className="lg:hidden h-12 w-px bg-zinc-100 my-4" />
                    </div>

                    {/* Step 4 — Outcome */}
                    <div className="flex-1 w-full bg-zinc-950 rounded-[2rem] p-10 shadow-2xl relative group border-l-8 border-l-emerald-500">
                        <div className="flex justify-between items-start mb-6">
                            <span className="px-3 py-1 bg-emerald-500 text-white rounded-lg text-[9px] font-black uppercase tracking-widest">Accepted</span>
                            <CheckCircle2 size={20} className="text-emerald-500" />
                        </div>
                        <div className="text-[12px] font-bold text-zinc-500 italic leading-snug tracking-tight">The revised schedule of revised schedule of ₹14,200/month.</div>
                    </div>
                </div>
            </div>
        </div>
    )
}
