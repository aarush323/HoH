import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import type { CustomerSummary } from '../types'
import {
    User,
    ChevronRight,
    ArrowRightCircle,
    Activity,
    ShieldAlert,
    Search
} from 'lucide-react'

export default function PortfolioInsights() {
    const [customers, setCustomers] = useState<CustomerSummary[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [riskFilter, setRiskFilter] = useState<'All' | 'High' | 'Medium' | 'Low'>('All')
    const navigate = useNavigate()

    useEffect(() => {
        api.getCustomers()
            .then(setCustomers)
            .catch(console.error)
            .finally(() => setLoading(false))
    }, [])

    const filtered = customers.filter(c => {
        const matchesSearch = c.customer_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.product_type.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesRisk = riskFilter === 'All' || c.risk_level === riskFilter;
        return matchesSearch && matchesRisk;
    })

    if (loading) return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="w-12 h-12 border-4 border-zinc-100 border-t-indigo-600 rounded-full animate-spin" />
        </div>
    )

    return (
        <div className="animate-fade-in pb-32 max-w-[1240px] mx-auto px-6 font-sans text-zinc-900 selection:bg-indigo-50 selection:text-indigo-900 leading-tight">

            {/* Header Section with Search */}
            <div className="pt-20 mb-16 space-y-12">
                <div className="flex flex-col md:flex-row justify-between items-end gap-10">
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="px-3 py-1 bg-zinc-900 text-white rounded-lg text-[9px] font-black uppercase tracking-[0.3em] shadow-lg">
                                Portfolio v2.4
                            </div>
                            <div className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">Inventory Status</div>
                        </div>
                        <h1 className="text-6xl font-black tracking-tighter text-zinc-950 leading-none">Customer <span className="text-zinc-300 italic">Dashboard.</span></h1>
                    </div>

                    <div className="flex items-center gap-4 w-full md:w-[400px]">
                        <div className="relative flex-1 h-16 bg-white rounded-2xl border border-zinc-100 px-6 flex items-center gap-4 transition-all focus-within:ring-4 focus-within:ring-blue-500/5 focus-within:border-blue-500/20 group shadow-sm">
                            <Search size={18} className="text-zinc-300 group-focus-within:text-blue-500 transition-colors" />
                            <input
                                type="text"
                                placeholder="Search by ID or Product..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="bg-transparent border-none text-sm font-bold text-zinc-950 placeholder-zinc-300 outline-none w-full"
                            />
                        </div>
                    </div>
                </div>

                {/* Risk Filter Bar */}
                <div className="flex items-center gap-3 p-2 bg-zinc-50 rounded-2xl border border-zinc-100 w-fit">
                    {(['All', 'High', 'Medium', 'Low'] as const).map((level) => (
                        <button
                            key={level}
                            onClick={() => setRiskFilter(level)}
                            className={`px-6 py-3 rounded-[1.25rem] text-[10px] font-black uppercase tracking-widest transition-all ${riskFilter === level ? 'bg-zinc-950 text-white shadow-xl shadow-zinc-900/10' : 'text-zinc-400 hover:text-zinc-950'}`}
                        >
                            {level}
                        </button>
                    ))}
                </div>
            </div>

            {/* The Ranked Card Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                {filtered.length === 0 ? (
                    <div className="col-span-full py-32 text-center bg-zinc-50 rounded-[3rem] border border-dashed border-zinc-200">
                        <div className="text-[11px] font-black uppercase tracking-[0.3em] text-zinc-300">No Match Detected in Cluster</div>
                    </div>
                ) : (
                    filtered.map((c) => {
                        const isHigh = c.risk_level === 'High';
                        const isMedium = c.risk_level === 'Medium';
                        const scorePct = Math.round(c.risk_score * 100);

                        return (
                            <div
                                key={c.customer_id}
                                className={`group relative bg-white rounded-[3rem] p-10 border transition-all duration-700 hover:-translate-y-2 hover:shadow-[0_50px_100px_-20px_rgba(0,0,0,0.1)] ${isHigh ? 'border-red-100 shadow-xl shadow-red-500/5' : 'border-zinc-100 shadow-sm'}`}
                            >
                                {/* Card Header Area */}
                                <div className="flex justify-between items-start mb-12">
                                    <div className="flex items-center gap-5">
                                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 ${isHigh ? 'bg-red-50 text-red-500' : 'bg-zinc-50 text-zinc-400 group-hover:bg-[#004ac6] group-hover:text-white'}`}>
                                            <User size={24} />
                                        </div>
                                        <div>
                                            <div className="text-[10px] font-black text-zinc-300 uppercase tracking-widest leading-none mb-2">{c.product_type}</div>
                                            <div className="text-xl font-black tracking-tighter text-zinc-950 leading-none uppercase">{c.customer_id}</div>
                                        </div>
                                    </div>
                                    <div className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest ${isHigh ? 'bg-red-50 text-red-500 border border-red-100' : 'bg-emerald-50 text-emerald-500 border border-emerald-100'}`}>
                                        {c.risk_level}
                                    </div>
                                </div>

                                {/* Main High-Impact Risk Display */}
                                <div className="mb-12">
                                    <div className="flex items-baseline gap-3">
                                        <div className={`text-8xl font-black tracking-tighter leading-none ${isHigh ? 'text-red-500' : isMedium ? 'text-amber-500' : 'text-emerald-500'}`}>
                                            {scorePct}<span className="text-3xl opacity-30 italic font-black">%</span>
                                        </div>
                                        <div className="text-[10px] font-black text-zinc-300 uppercase tracking-[0.2em] leading-tight">
                                            Risk <br /> Index
                                        </div>
                                    </div>
                                </div>

                                {/* Secondary Metrics Bar */}
                                <div className="grid grid-cols-2 gap-4 mb-10">
                                    <div className="bg-zinc-50/50 rounded-2xl p-6 border border-zinc-100/50 transition-all group-hover:bg-white group-hover:border-zinc-200/50">
                                        <div className="flex items-center gap-2 text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-3">
                                            <Activity size={12} strokeWidth={3} /> Salary Delay
                                        </div>
                                        <div className={`text-3xl font-black tabular ${isHigh && c.signals.salary_delay > 5 ? 'text-red-500' : 'text-zinc-950'}`}>
                                            {c.signals.salary_delay}d
                                        </div>
                                    </div>
                                    <div className="bg-zinc-50/50 rounded-2xl p-6 border border-zinc-100/50 transition-all group-hover:bg-white group-hover:border-zinc-200/50">
                                        <div className="flex items-center gap-2 text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-3">
                                            <ShieldAlert size={12} strokeWidth={3} /> Bounce Rate
                                        </div>
                                        <div className={`text-3xl font-black tabular ${isHigh && c.signals.auto_debit_failures > 0 ? 'text-red-500' : 'text-zinc-950'}`}>
                                            {c.signals.auto_debit_failures}
                                        </div>
                                    </div>
                                </div>

                                {/* Status Statement */}
                                <div className="mb-12 h-12 flex items-center">
                                    <p className={`text-[11px] font-bold leading-relaxed ${isHigh ? 'text-red-500' : 'text-zinc-400'}`}>
                                        {isHigh
                                            ? "Threshold breached. Deploying autonomous debt-mitigation sequence."
                                            : isMedium
                                                ? "Elevated monitoring protocol active. Watch for liquidity volatility."
                                                : "Stability confirmed. No active intervention currently required."}
                                    </p>
                                </div>

                                {/* Primary Actions */}
                                <div className="flex items-center gap-4 pt-4 border-t border-zinc-50">
                                    <button
                                        onClick={() => navigate(`/journey/${c.customer_id}`)}
                                        className="flex-1 flex items-center justify-center gap-4 h-16 bg-zinc-950 text-white rounded-2xl text-[10px] font-black tracking-[0.2em] uppercase hover:bg-red-500 transition-all active:scale-95 shadow-2xl shadow-zinc-900/10"
                                    >
                                        Watch Journey
                                        <ChevronRight size={16} strokeWidth={3} />
                                    </button>
                                    <button
                                        onClick={() => navigate(`/customer/${c.customer_id}`)}
                                        className="w-16 h-16 flex items-center justify-center bg-zinc-50 text-zinc-400 rounded-2xl hover:bg-zinc-950 hover:text-white transition-all shadow-sm active:scale-90 border border-zinc-100"
                                        title="Deep Analytics"
                                    >
                                        <ArrowRightCircle size={24} />
                                    </button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    )
}
