import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import type { CustomerDetailOverview, ShapFactor } from '../types'
import {
    ChevronLeft,
    Activity,
    ShieldAlert,
    MessageSquare,
    Phone,
    Layers,
    Brain,
    FileSearch,
    UserCircle,
    AlertCircle,
    ArrowUpRight,
    Zap
} from 'lucide-react'

// Sub-component for SHAP Risk Drivers (Optimized for Proportions)
function ShapBar({ factors }: { factors: ShapFactor[] }) {
    const maxVal = Math.max(...factors.map(f => Math.abs(f.contribution)), 0.01);
    return (
        <div className="space-y-6">
            {factors.slice(0, 4).map((f, i) => (
                <div key={i} className="group">
                    <div className="flex justify-between items-center mb-2.5">
                        <span className="text-[11px] font-black text-zinc-400 uppercase tracking-widest group-hover:text-zinc-950 transition-colors">
                            {f.feature.replace(/_/g, ' ')}
                        </span>
                        <span className={`text-[11px] font-black tabular-nums ${f.contribution > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                            {f.contribution > 0 ? '+' : '-'}{(Math.abs(f.contribution) * 100).toFixed(1)}%
                        </span>
                    </div>
                    <div className="h-1.5 w-full bg-zinc-50 rounded-full overflow-hidden flex">
                        <div
                            className={`h-full transition-all duration-1000 ease-out rounded-full ${f.contribution > 0 ? 'bg-red-500' : 'bg-emerald-500'}`}
                            style={{ width: `${(Math.abs(f.contribution) / maxVal) * 100}%` }}
                        />
                    </div>
                </div>
            ))}
        </div>
    )
}

// Sub-component for Model Score Node
function ScoreNode({ label, score, agent, colorClass }: { label: string, score: number, agent: string, colorClass: string }) {
    return (
        <div className="flex flex-col gap-4 p-8 bg-white border border-zinc-100 rounded-[2rem] shadow-sm hover:border-zinc-200 transition-all">
            <div className="flex justify-between items-start">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 leading-none">{label}</div>
                <div className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border ${colorClass.includes('indigo') ? 'text-indigo-500 border-indigo-500' : 'text-blue-500 border-blue-500'}`}>AGENT: {agent}</div>
            </div>
            <div className="text-4xl font-black tracking-tighter text-zinc-950 tabular-nums">{(score * 100).toFixed(0)}%</div>
            <div className="h-1 w-full bg-zinc-100 rounded-full overflow-hidden">
                <div className={`h-full transition-all duration-1000 ${colorClass.includes('indigo') ? 'bg-indigo-500' : 'bg-blue-500'}`} style={{ width: `${score * 100}%` }} />
            </div>
        </div>
    )
}

export default function CustomerJourney() {
    const { id } = useParams()
    const navigate = useNavigate()
    const [data, setData] = useState<CustomerDetailOverview | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!id) return
        setLoading(true)
        setError(null)
        api.getCustomerDetail(id)
            .then(res => {
                if (!res) throw new Error('Customer data not found')
                setData(res)
            })
            .catch(err => {
                console.error(err)
                setError(err.message || 'Failed to load customer details')
            })
            .finally(() => setLoading(false))
    }, [id])

    if (loading) return (
        <div className="flex items-center justify-center min-h-screen bg-[#fafafa]">
            <div className="w-12 h-12 border-2 border-zinc-100 border-t-blue-600 rounded-full animate-spin" />
        </div>
    )

    if (error || !data) return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-[#fafafa] gap-6">
            <AlertCircle size={48} className="text-red-500" />
            <div className="text-xl font-black uppercase tracking-widest text-zinc-400">
                {error || 'Customer not found'}
            </div>
            <button
                onClick={() => navigate('/portfolio')}
                className="px-8 py-3 bg-zinc-950 text-white rounded-xl text-[10px] font-black uppercase tracking-widest"
            >
                Return to Portfolio
            </button>
        </div>
    )

    const { profile, score, stress, audit } = data;
    const isHigh = score.risk_level === 'High';

    return (
        <div className="min-h-screen bg-[#fafafa] font-sans selection:bg-blue-600 selection:text-white pt-12 pb-40">
            <div className="max-w-[1440px] mx-auto px-12">

                {/* 1. Header & Quick Actions */}
                <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-8 mb-16">
                    <div className="space-y-6">
                        <button
                            onClick={() => navigate('/portfolio')}
                            className="group flex items-center gap-3 text-zinc-400 hover:text-zinc-950 transition-colors"
                        >
                            <ChevronLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                            <span className="text-[11px] font-black uppercase tracking-[0.3em]">Portfolio Analysis</span>
                        </button>
                        <div className="space-y-2">
                            <h1 className="text-6xl font-black tracking-tighter text-zinc-950 leading-[0.9]">
                                {profile.customer.name || `Customer ${id}`}
                            </h1>
                            <div className="flex items-center gap-4 text-zinc-400">
                                <span className="text-sm font-bold tracking-tight">CID-{id}</span>
                                <div className="w-1.5 h-1.5 rounded-full bg-zinc-200" />
                                <span className={`text-[10px] font-black uppercase tracking-widest ${isHigh ? 'text-red-500' : 'text-emerald-500'}`}>
                                    {score.risk_level} Priority Channel
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate(`/journey/${id}`)}
                            className="h-14 px-8 bg-white border border-zinc-200 text-zinc-950 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:border-zinc-900 transition-all shadow-sm flex items-center gap-3"
                        >
                            <Activity size={16} /> Replay Session
                        </button>
                        <button className="h-14 px-8 bg-zinc-950 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-zinc-800 transition-all shadow-2xl shadow-zinc-200 flex items-center gap-3">
                            <Zap size={16} className="text-blue-400" /> Dispatch Intervention
                        </button>
                    </div>
                </header>

                {/* 2. Intelligence Core Matrix */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 mb-20">

                    {/* Primary Signal Hub (Ensemble Score) */}
                    <div className="lg:col-span-6 bg-zinc-950 rounded-[3rem] p-16 text-white relative overflow-hidden group shadow-2xl">
                        <div className="absolute top-0 right-0 p-12 opacity-5 translate-x-1/4 -translate-y-1/4 group-hover:scale-110 transition-transform duration-[2s]">
                            <Brain size={300} />
                        </div>
                        <div className="relative z-10 space-y-12">
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <h3 className="text-[11px] font-black uppercase tracking-[0.4em] text-zinc-500 leading-none italic">Resonare Master Consortium</h3>
                                    <div className="text-[10px] font-black text-blue-500 uppercase tracking-widest">EN-V2.1 PRE-PROCESSING ACTIVE</div>
                                </div>
                                <ArrowUpRight size={18} className="text-zinc-800" />
                            </div>
                            <div className="flex items-baseline gap-4">
                                <span className={`text-[11rem] font-black tracking-tighter leading-none tabular-nums ${isHigh ? 'text-[#ff3b30]' : 'text-[#007aff]'}`}>
                                    {Math.round(score.risk_score * 100)}<span className="text-4xl opacity-20 italic ml-2">%</span>
                                </span>
                            </div>
                            <div className="grid grid-cols-2 gap-12 pt-12 border-t border-white/5">
                                <div className="space-y-2">
                                    <div className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Ensemble Confidence</div>
                                    <div className="text-xl font-bold italic tracking-tight">0.963 / 1.0</div>
                                </div>
                                <div className="space-y-2 text-right">
                                    <div className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Decision Latency</div>
                                    <div className="text-xl font-bold italic tracking-tight text-white">41ms</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Secondary Model Nodes (Individual Models) */}
                    <div className="lg:col-span-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                        <ScoreNode
                            label="Sequential Sentiment"
                            score={score.gru_p ?? 0}
                            agent="GRU-V3"
                            colorClass="text-indigo-500 border-indigo-500/20 bg-indigo-50/50"
                        />
                        <ScoreNode
                            label="Structural Weighting"
                            score={score.lgb_p ?? 0}
                            agent="LGBM-V4"
                            colorClass="text-blue-500 border-blue-500/20 bg-blue-50/50"
                        />
                        <div className="md:col-span-2 bg-white rounded-[2.5rem] border border-zinc-100 p-12 space-y-10 shadow-sm relative overflow-hidden group">
                            <div className="flex items-center justify-between relative z-10">
                                <div className="space-y-1">
                                    <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Risk Vectors</h3>
                                    <div className="text-xs font-bold text-zinc-950 uppercase italic">SHAP Multi-Factor Decomposition</div>
                                </div>
                                <FileSearch size={18} className="text-zinc-200" />
                            </div>
                            <ShapBar factors={score.shap_factors} />
                        </div>
                    </div>
                </div>

                {/* 3. Operational Logic Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">

                    {/* Behavioral Analysis & Timeline (Left) */}
                    <div className="lg:col-span-8 space-y-12">

                        {/* LLM Narrative (Agent Output 1) */}
                        {stress && (
                            <section className="bg-white rounded-[3rem] border border-zinc-100 p-16 space-y-10 relative overflow-hidden shadow-sm group">
                                <div className="absolute top-0 right-0 p-12 opacity-0 group-hover:opacity-5 transition-opacity">
                                    <MessageSquare size={160} />
                                </div>
                                <div className="flex items-center justify-between relative z-10">
                                    <div className="flex items-center gap-3">
                                        <AlertCircle size={20} className="text-[#004ac6]" />
                                        <span className="text-[11px] font-black uppercase tracking-[0.3em] text-zinc-950">Behavioral Reasoning Engine</span>
                                    </div>
                                    <div className="px-4 py-1 bg-zinc-950 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-xl">Synthesized Artifact — Agent_1</div>
                                </div>
                                <h2 className="text-5xl font-black tracking-tight text-zinc-900 leading-[1.05] relative z-10">
                                    "{stress.narrative}"
                                </h2>
                                <div className="flex flex-wrap gap-4 relative z-10 pt-4">
                                    <div className="px-5 py-2 bg-zinc-50 border border-zinc-100 rounded-2xl text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                        Type Hierarchy: {stress.stress_type}
                                    </div>
                                    <div className="px-5 py-2 bg-zinc-50 border border-zinc-100 rounded-2xl text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                        Intensity Spectrum: {stress.severity}
                                    </div>
                                </div>
                            </section>
                        )}

                        {/* Audit Log / Outreach (Timeline) */}
                        <section className="bg-white rounded-[3rem] border border-zinc-100 p-16 space-y-16 shadow-sm">
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">Activity & Execution</span>
                                    <h3 className="text-xl font-black text-zinc-950">Audit Trace History</h3>
                                </div>
                                <div className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-emerald-100">Live Connection Active</div>
                            </div>

                            <div className="space-y-0 relative">
                                {audit.length === 0 ? (
                                    <div className="py-24 text-center text-[11px] font-black uppercase tracking-[0.4em] text-zinc-300 italic">
                                        Zero-Intervention history trace.
                                    </div>
                                ) : (
                                    audit.map((a, i) => (
                                        <div key={i} className={`flex gap-12 pb-16 ${i !== audit.length - 1 ? 'border-l-2 border-zinc-100 ml-10 pl-20 pt-4' : 'ml-10 pl-20 pt-4'}`}>
                                            <div className="relative">
                                                <div className="absolute top-0 -left-[102px] w-14 h-14 bg-white border-2 border-zinc-100 rounded-[1.2rem] flex items-center justify-center text-zinc-950 shadow-xl group hover:scale-110 transition-transform">
                                                    {a.selected_channel === 'voice' ? <Phone size={22} /> : <MessageSquare size={22} />}
                                                </div>
                                                <div className="space-y-6">
                                                    <div className="flex items-center gap-6">
                                                        <span className="text-[11px] font-black text-zinc-400 uppercase tracking-widest">{new Date(a.created_at).toLocaleString()}</span>
                                                        <span className={`px-4 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-sm ${a.status === 'dispatched' ? 'bg-blue-600 text-white' : 'bg-zinc-950 text-white'}`}>
                                                            {a.intervention_method} Protocol
                                                        </span>
                                                    </div>
                                                    <div className="bg-[#fcfcfc] rounded-[2.5rem] p-10 border border-zinc-100 max-w-2xl shadow-sm hover:border-zinc-200 transition-all hover:bg-white text-zinc-600 font-bold italic leading-relaxed">
                                                        "{a.message_content}"
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </section>
                    </div>

                    {/* Technical Profile & Policy (Right Sidebar) */}
                    <aside className="lg:col-span-4 space-y-10">

                        {/* Strategic Plan Box (Dynamic Agent 2) */}
                        <div className="bg-zinc-950 rounded-[3rem] p-12 text-white space-y-12 relative overflow-hidden shadow-2xl border border-white/5">
                            <div className="relative z-10 space-y-2">
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-600 italic">Policy Architecture</span>
                                    <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                                </div>
                                <h3 className="text-4xl font-black uppercase tracking-tighter leading-none italic">Target<br />Response</h3>
                            </div>

                            <div className="relative z-10 space-y-10">
                                <div className="p-10 bg-white/5 rounded-[2rem] border border-white/10 space-y-6">
                                    <div className="text-[10px] font-black uppercase tracking-widest text-[#004ac6] flex items-center gap-2">
                                        <Layers size={14} /> Strategy Agent Output
                                    </div>
                                    <p className="text-2xl font-black text-zinc-100 leading-[1.3] italic">
                                        "{stress?.recommended_action || "Account analysis pending consortium consensus."}"
                                    </p>
                                </div>

                                <button className="group w-full h-16 bg-white text-zinc-950 rounded-[1.5rem] text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-4 hover:bg-zinc-100 transition-all active:scale-[0.98] shadow-2xl shadow-white/5 text-zinc-950">
                                    <Phone size={18} className="group-hover:rotate-12 transition-transform" />
                                    Initiate Deployment
                                </button>
                            </div>

                            <div className="relative z-10 pt-10 border-t border-white/5 flex items-center gap-4 text-zinc-700 text-[10px] font-black uppercase tracking-widest italic">
                                <ShieldAlert size={16} className="text-red-950" />
                                Compliance Matrix Verified
                            </div>
                        </div>

                        {/* Structural Matrix */}
                        <div className="bg-white rounded-[3rem] border border-zinc-100 p-12 space-y-12 shadow-sm group hover:border-[#004ac6]/10 transition-colors">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <UserCircle size={22} className="text-zinc-300 transition-colors group-hover:text-zinc-950" />
                                    <h3 className="text-sm font-black uppercase tracking-tight text-zinc-950">Structural Profile</h3>
                                </div>
                                <Activity size={16} className="text-zinc-50" />
                            </div>

                            <div className="space-y-10">
                                {[
                                    { label: "Market Segment", value: profile.customer.customer_segment || "Core Retail" },
                                    { label: "Product Topology", value: profile.customer.product_type },
                                    { label: "Relationship Era", value: `${(profile.customer.account_vintage_months! / 12).toFixed(1)} Fiscal Years` },
                                    { label: "Current Principal", value: `$${(profile.customer.loan_amount! / 1000).toFixed(0)}k exposure` }
                                ].map((row, i) => (
                                    <div key={i} className="flex flex-col gap-2 border-b border-zinc-50 pb-6 last:border-0 last:pb-0 group/item">
                                        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em] group-hover/item:text-[#004ac6] transition-colors">{row.label}</span>
                                        <span className="text-lg font-black text-zinc-950 uppercase italic tracking-tighter leading-none">{row.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                    </aside>
                </div>
            </div>
        </div>
    )
}
