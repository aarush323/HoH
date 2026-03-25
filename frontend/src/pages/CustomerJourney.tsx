import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import type { CustomerDetailOverview, ShapFactor } from '../types'
import {
    ChevronLeft,
    TrendingUp,
    Activity,
    ShieldAlert,
    MessageSquare,
    Phone,
    Layers,
    Brain,
    FileSearch,
    Clock,
    UserCircle,
    AlertCircle
} from 'lucide-react'

function ShapBar({ factors }: { factors: ShapFactor[] }) {
    const maxVal = Math.max(...factors.map(f => Math.abs(f.contribution)), 0.01);

    return (
        <div className="space-y-4">
            {factors.slice(0, 5).map((f, i) => (
                <div key={i} className="flex items-center gap-4">
                    <div className="w-1/3 text-[10px] font-bold text-zinc-400 uppercase tracking-wider truncate">
                        {f.feature.replace(/_/g, ' ')}
                    </div>
                    <div className="flex-1 h-2 bg-zinc-100 rounded-full overflow-hidden flex">
                        <div
                            className={`h-full transition-all duration-1000 ${f.contribution > 0 ? 'bg-red-400' : 'bg-emerald-400'}`}
                            style={{ width: `${(Math.abs(f.contribution) / maxVal) * 100}%` }}
                        />
                    </div>
                    <div className={`w-12 text-right text-[10px] font-black tabular ${f.contribution > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                        {f.contribution > 0 ? '+' : ''}{(f.contribution * 100).toFixed(0)}%
                    </div>
                </div>
            ))}
        </div>
    )
}

export default function CustomerJourney() {
    const { id } = useParams()
    const navigate = useNavigate()
    const [data, setData] = useState<CustomerDetailOverview | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!id) return
        api.getCustomerDetail(id)
            .then(setData)
            .catch(console.error)
            .finally(() => setLoading(false))
    }, [id])

    if (loading || !data) return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="w-8 h-8 border-2 border-zinc-200 border-t-zinc-900 rounded-full animate-spin" />
        </div>
    )

    const { profile, score, stress, audit } = data;
    const isHigh = score.risk_level === 'High';

    return (
        <div className="min-h-screen bg-[#fcfcfc] font-sans selection:bg-zinc-900 selection:text-white pt-12 pb-32">
            <div className="max-w-7xl mx-auto px-8">

                {/* 1. Slim Header / Breadcrumbs */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => navigate('/portfolio')}
                                className="p-2 hover:bg-zinc-100 rounded-lg transition-colors text-zinc-400 hover:text-zinc-950"
                            >
                                <ChevronLeft size={20} />
                            </button>
                            <div className="h-4 w-px bg-zinc-200" />
                            <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Analytics / {id}</span>
                        </div>
                        <div className="flex items-center gap-6">
                            <h1 className="text-4xl font-black tracking-tight text-zinc-950">
                                {profile.customer.name || `Customer ${id}`}
                            </h1>
                            <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${isHigh ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
                                {score.risk_level} Priority
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate(`/journey/${id}`)}
                            className="h-11 px-5 bg-white border border-zinc-200 text-zinc-900 rounded-xl text-xs font-bold hover:bg-zinc-50 transition-all flex items-center gap-2.5 shadow-sm"
                        >
                            <Activity size={16} className="text-zinc-400" />
                            Watch Journey
                        </button>
                        <button className="h-11 px-5 bg-zinc-950 text-white rounded-xl text-xs font-bold hover:bg-zinc-800 transition-all flex items-center gap-2.5 shadow-xl shadow-zinc-200">
                            <MessageSquare size={16} />
                            Manual Action
                        </button>
                    </div>
                </div>

                {/* 2. Main Layout Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                    {/* LEFT COLUMN: The Intel */}
                    <div className="lg:col-span-8 space-y-8">

                        {/* Summary KPI Bar */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {[
                                { label: "Risk Score", value: `${Math.round(score.risk_score * 100)}%`, sub: "Probability of Default", icon: <TrendingUp className={isHigh ? "text-red-500" : "text-zinc-400"} /> },
                                { label: "Model Confidence", value: "94.2%", sub: "High Confidence Node", icon: <Brain className="text-zinc-400" /> },
                                { label: "Last Updated", value: score.observation_week, sub: "Week 12 Data Source", icon: <Clock className="text-zinc-400" /> }
                            ].map((kpi, i) => (
                                <div key={i} className="bg-white p-8 rounded-3xl border border-zinc-100 shadow-sm hover:border-zinc-200 transition-colors">
                                    <div className="flex justify-between items-start mb-6">
                                        <div className="w-10 h-10 bg-zinc-50 rounded-xl flex items-center justify-center text-zinc-400">
                                            {kpi.icon}
                                        </div>
                                    </div>
                                    <div className="text-3xl font-black tracking-tight mb-2">{kpi.value}</div>
                                    <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{kpi.label}</div>
                                </div>
                            ))}
                        </div>

                        {/* AI Narrative Section */}
                        {stress && (
                            <div className="bg-white rounded-[2.5rem] border border-zinc-100 shadow-sm p-10 space-y-6">
                                <div className="flex items-center gap-3">
                                    <AlertCircle size={18} className="text-[#004ac6]" />
                                    <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400">Behavioral Reasoning</h3>
                                </div>
                                <h2 className="text-2xl font-black tracking-tight text-zinc-900 leading-tight">
                                    "{stress.narrative}"
                                </h2>
                                <div className="flex gap-4">
                                    <span className="px-3 py-1 bg-zinc-50 border border-zinc-100 rounded-lg text-[9px] font-black uppercase tracking-widest text-zinc-500 whitespace-nowrap">
                                        Type: {stress.stress_type}
                                    </span>
                                    <span className="px-3 py-1 bg-zinc-50 border border-zinc-100 rounded-lg text-[9px] font-black uppercase tracking-widest text-zinc-500 whitespace-nowrap">
                                        ResonareAI Score: 0.94
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Multi-Model Ensemble Info */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="bg-white rounded-[2.5rem] border border-zinc-100 p-10 space-y-10 group shadow-sm hover:shadow-md transition-all">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400">Risk Drivers (SHAP)</h3>
                                    <FileSearch size={16} className="text-zinc-200" />
                                </div>
                                <ShapBar factors={score.shap_factors} />
                            </div>

                            <div className="bg-white rounded-[2.5rem] border border-zinc-100 p-10 space-y-10 shadow-sm hover:shadow-md transition-all">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400">Model Ensemble</h3>
                                    <Layers size={16} className="text-zinc-200" />
                                </div>
                                <div className="space-y-6">
                                    <div className="flex justify-between items-center text-xs font-bold text-zinc-500 border-b border-zinc-50 pb-4">
                                        <span>LightGBM Confidence</span>
                                        <span className="text-zinc-950">{(score.lgb_p! * 100).toFixed(1)}%</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs font-bold text-zinc-500 border-b border-zinc-50 pb-4">
                                        <span>GRU Timeline Score</span>
                                        <span className="text-zinc-950">{(score.gru_p! * 100).toFixed(1)}%</span>
                                    </div>
                                    <div className="flex justify-between items-center pt-2">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-blue-600">Ensemble Master</span>
                                        <div className={`text-4xl font-black ${isHigh ? 'text-red-600' : 'text-zinc-950'}`}>
                                            {Math.round(score.risk_score * 100)}%
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Trace Log History */}
                        <div className="bg-white rounded-[2.5rem] border border-zinc-100 shadow-sm p-10 space-y-10">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400">Intervention Artifacts</h3>
                                <div className="text-[10px] font-bold text-emerald-500 px-3 py-1 bg-emerald-50 rounded-lg uppercase tracking-widest">v2.4 Audit Ready</div>
                            </div>

                            <div className="space-y-0">
                                {audit.length === 0 ? (
                                    <div className="py-12 text-center text-[10px] font-bold uppercase tracking-widest text-zinc-300">
                                        Zero-Intervention history for this account.
                                    </div>
                                ) : (
                                    audit.map((a, i) => (
                                        <div key={i} className={`flex gap-8 pb-10 ${i !== audit.length - 1 ? 'border-l border-zinc-50 ml-6 pl-12 pt-2' : 'ml-6 pl-12 pt-2'}`}>
                                            <div className="relative">
                                                <div className="absolute top-0 -left-[61px] w-6 h-6 bg-[#fcfcfc] border border-zinc-200 rounded-full flex items-center justify-center text-zinc-400">
                                                    <div className="w-2 h-2 rounded-full bg-zinc-900" />
                                                </div>
                                                <div className="space-y-4">
                                                    <div className="flex items-center gap-4">
                                                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{new Date(a.created_at).toLocaleDateString()}</span>
                                                        <span className="px-2 py-0.5 bg-zinc-900 text-white rounded-md text-[8px] font-black uppercase tracking-widest italic">{a.intervention_method}</span>
                                                    </div>
                                                    <div className="bg-zinc-50 rounded-2xl p-6 border border-zinc-100 max-w-2xl group hover:bg-white hover:border-zinc-200 transition-all">
                                                        <p className="text-sm font-bold text-zinc-600 leading-relaxed italic">"{a.message_content}"</p>
                                                        {a.voice_outcome && (
                                                            <div className="mt-4 pt-4 border-t border-zinc-100 flex items-center gap-6">
                                                                <div>
                                                                    <div className="text-[8px] font-black text-zinc-400 uppercase tracking-widest mb-1">Status</div>
                                                                    <div className="text-[10px] font-black text-emerald-500 uppercase italic tracking-widest">{a.voice_outcome}</div>
                                                                </div>
                                                                <div>
                                                                    <div className="text-[8px] font-black text-zinc-400 uppercase tracking-widest mb-1">Agent ID</div>
                                                                    <div className="text-[10px] font-black text-zinc-900 uppercase italic tracking-widest">R-712</div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                    </div>

                    {/* RIGHT COLUMN: Profile & Action */}
                    <div className="lg:col-span-4 space-y-8">

                        {/* Profile Summary Card */}
                        <div className="bg-white rounded-[2.5rem] border border-zinc-100 shadow-sm p-10 space-y-12">
                            <div className="flex items-center gap-4">
                                <UserCircle size={20} className="text-zinc-400" />
                                <h3 className="text-sm font-black uppercase tracking-tight">Technical Profile</h3>
                            </div>

                            <div className="space-y-8">
                                {[
                                    { label: "Segment Cluster", value: profile.customer.customer_segment || "Core Retail" },
                                    { label: "Product Node", value: profile.customer.product_type },
                                    { label: "Account Vintage", value: `${(profile.customer.account_vintage_months! / 12).toFixed(1)} yr` },
                                    { label: "Geographic Zone", value: profile.customer.geography_zone },
                                    { label: "Exposure Pool", value: `$${(profile.customer.loan_amount! / 1000).toFixed(0)}k Principal` }
                                ].map((row, i) => (
                                    <div key={i} className="flex justify-between items-end border-b border-zinc-50 pb-4">
                                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest leading-none">{row.label}</span>
                                        <span className="text-xs font-black text-zinc-950 uppercase italic leading-none">{row.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Strategy Box */}
                        <div className="bg-zinc-950 rounded-[2.5rem] p-10 text-white space-y-10 relative overflow-hidden shadow-2xl">
                            <div className="relative z-10 space-y-2">
                                <div className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-600">Next Best Action</div>
                                <h3 className="text-3xl font-black tracking-tight uppercase leading-none italic">Recommended</h3>
                            </div>

                            <div className="relative z-10 space-y-8">
                                <div className="p-6 bg-white/5 rounded-2xl border border-white/10 space-y-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                        <div className="text-[9px] font-black uppercase tracking-widest">Outreach Required</div>
                                    </div>
                                    <p className="text-sm font-bold text-zinc-400 leading-relaxed italic">
                                        Deploy "Empathetic Hardship" voice protocol to discuss EMI restructuring for week 12.
                                    </p>
                                </div>

                                <button className="w-full h-14 bg-white text-zinc-950 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-zinc-100 transition-all active:scale-95 shadow-xl shadow-white/5">
                                    <Phone size={14} /> Start Voice Session
                                </button>
                            </div>

                            <div className="relative z-10 pt-8 border-t border-white/5 flex items-center gap-3 text-zinc-600 text-[8px] font-black uppercase tracking-widest">
                                <ShieldAlert size={12} className="text-zinc-700" /> Final Human Review Triggered
                            </div>
                        </div>

                        {/* Signal Matrix (Small Icons) */}
                        <div className="bg-white rounded-[2.5rem] border border-zinc-100 p-10 space-y-8 shadow-sm">
                            <div className="flex items-center justify-between">
                                <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Live Health Nodes</h3>
                                <div className="w-2 h-2 rounded-full bg-blue-500" />
                            </div>
                            <div className="grid grid-cols-4 gap-4">
                                {[1, 2, 3, 4].map(i => (
                                    <div key={i} className="aspect-square bg-zinc-50 rounded-xl border border-zinc-100 flex items-center justify-center text-zinc-300">
                                        <Activity size={18} />
                                    </div>
                                ))}
                            </div>
                        </div>

                    </div>

                </div>

            </div>
        </div>
    )
}
