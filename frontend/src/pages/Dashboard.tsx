import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import type { CustomerSummary, AuditRecord } from '../types'
import {
    Zap,
    ShieldAlert,
    ChevronRight,
    ArrowUpRight,
    Play,
    Activity,
    Users,
    MessageSquare,
    PieChart as PieIcon
} from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'

export default function Dashboard() {
    const navigate = useNavigate()
    const [customers, setCustomers] = useState<CustomerSummary[]>([])
    const [audit, setAudit] = useState<AuditRecord[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        Promise.all([api.getCustomers(), api.getAudit()])
            .then(([c, a]) => {
                setCustomers(c);
                setAudit(a);
            })
            .catch(console.error)
            .finally(() => setLoading(false))
    }, [])

    if (loading) return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="w-12 h-12 border-4 border-zinc-100 border-t-indigo-600 rounded-full animate-spin" />
        </div>
    )

    const highRisk = customers.filter(c => c.risk_level === 'High').length
    const totalExposure = customers.length * 450000 // Average loan size
    const interventionSuccess = audit.filter(a => a.status === 'Resolved').length

    const pieData = [
        { name: 'High', value: highRisk, color: '#ef4444' },
        { name: 'Medium', value: customers.filter(c => c.risk_level === 'Medium').length, color: '#6366f1' },
        { name: 'Low', value: customers.filter(c => c.risk_level === 'Low').length, color: '#10b981' }
    ]

    return (
        <div className="animate-fade-in pb-32 max-w-[1400px] mx-auto px-10 font-sans text-zinc-900 leading-tight">

            {/* 1. Executive Top Header */}
            <div className="pt-20 mb-20 flex flex-col md:flex-row justify-between items-end gap-10">
                <div className="space-y-4">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-zinc-900 text-white rounded-lg text-[9px] font-black uppercase tracking-[.3em] shadow-xl shadow-indigo-100/50">
                        <Zap fill="white" size={10} /> v2.4 Topology Active
                    </div>
                    <h1 className="text-7xl font-black tracking-tighter text-zinc-950 leading-[.85]">
                        BIRD'S EYE <br />
                        <span className="text-zinc-300">SUMMARY.</span>
                    </h1>
                </div>

                <div className="flex gap-4">
                    <button
                        onClick={() => navigate('/portfolio')}
                        className="h-14 px-8 bg-zinc-950 text-white rounded-2xl text-[10px] font-bold tracking-[.15em] uppercase hover:bg-indigo-600 transition-all active:scale-95 shadow-xl shadow-zinc-200"
                    >
                        Full Portfolio
                    </button>
                </div>
            </div>

            {/* 2. Primary KPI Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-20">
                {[
                    { label: "Portfolio Stress", value: `${Math.round((highRisk / customers.length) * 100 || 0)}%`, desc: "Aggregate Risk Factor", icon: <ShieldAlert size={16} className="text-red-500" />, accent: "bg-red-50 text-red-900 border-red-100" },
                    { label: "Total Asset Value", value: `$${(totalExposure / 1000000).toFixed(1)}M`, desc: "Intervension Thresholds Active", icon: <Users size={16} className="text-zinc-400" />, accent: "bg-zinc-50 border-zinc-100" },
                    { label: "Agent Success", value: `${interventionSuccess}`, desc: "Resolved Autonomous Cases", icon: <Activity size={16} className="text-emerald-500" />, accent: "bg-emerald-50 text-emerald-900 border-emerald-100" },
                    { label: "Live Signals", value: `${customers.length}`, desc: "Concurrent Ingestion Pulses", icon: <PieIcon size={16} className="text-indigo-400" />, accent: "bg-indigo-50 text-indigo-900 border-indigo-100" }
                ].map((kpi, i) => (
                    <div key={i} className={`p-10 rounded-[2.5rem] border transition-all ${kpi.accent} shadow-sm group hover:-translate-y-1 hover:shadow-xl`}>
                        <div className="flex justify-between items-start mb-10">
                            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                                {kpi.icon}
                            </div>
                            <ArrowUpRight size={14} className="text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div className="text-[10px] font-black uppercase tracking-widest opacity-50 mb-2">{kpi.label}</div>
                        <div className="text-5xl font-black tracking-tighter mb-4">{kpi.value}</div>
                        <div className="text-[10px] font-bold uppercase tracking-widest opacity-40">{kpi.desc}</div>
                    </div>
                ))}
            </div>

            {/* 3. Deep Analysis Section (Pie + Watchlist) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">

                {/* Visual Distribution */}
                <div className="lg:col-span-5 bg-white rounded-[3rem] p-12 border border-zinc-100 shadow-sm relative overflow-hidden group hover:shadow-2xl transition-all">
                    <div className="relative z-10 space-y-2 mb-12">
                        <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Risk Segmentation</div>
                        <h3 className="text-3xl font-black tracking-tight uppercase leading-none">Portfolio Heatmap</h3>
                    </div>

                    <div className="h-[300px] w-full relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={pieData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={80}
                                    outerRadius={120}
                                    paddingAngle={8}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {pieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <div className="text-4xl font-black tracking-tight">{customers.length}</div>
                            <div className="text-[9px] font-black uppercase text-zinc-300 tracking-[.4em]">ACCOUNTS</div>
                        </div>
                    </div>

                    {/* Legend */}
                    <div className="mt-12 flex justify-between gap-4 border-t border-zinc-50 pt-10">
                        {pieData.map((d, i) => (
                            <div key={i} className="flex flex-col gap-1">
                                <span className={`text-[10px] font-black uppercase tracking-widest`} style={{ color: d.color }}>{d.name}</span>
                                <span className="text-lg font-black tracking-tight">{d.value}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Critical Stress Watchlist */}
                <div className="lg:col-span-7 bg-zinc-950 rounded-[3rem] p-12 border border-zinc-900 shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-12 opacity-10 group-hover:scale-150 transition-transform duration-1000">
                        <ShieldAlert size={120} className="text-red-500" />
                    </div>

                    <div className="relative z-10 space-y-2 mb-12 flex justify-between items-end">
                        <div>
                            <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500">ML Criticals</div>
                            <h3 className="text-3xl font-black tracking-tight uppercase leading-none text-white">Active Stress Watchlist</h3>
                        </div>
                        <button
                            onClick={() => navigate('/live')}
                            className="flex items-center gap-2 group/btn text-zinc-500 hover:text-white transition-colors"
                        >
                            <span className="text-[9px] font-black uppercase tracking-widest">Live Stream</span>
                            <Play size={12} fill="currentColor" />
                        </button>
                    </div>

                    <div className="space-y-4">
                        {customers.filter(c => c.risk_level === 'High').slice(0, 4).map((c, i) => (
                            <div
                                key={i}
                                onClick={() => navigate(`/customer/${c.customer_id}`)}
                                className="group/item flex items-center justify-between p-6 bg-zinc-900/50 rounded-2xl border border-zinc-800/50 hover:bg-red-500/10 hover:border-red-500/30 transition-all cursor-pointer"
                            >
                                <div className="flex items-center gap-6">
                                    <div className="text-zinc-700 font-black italic group-hover/item:text-red-500 transition-colors">#{i + 1}</div>
                                    <div>
                                        <div className="text-[10px] font-black uppercase text-zinc-500 tracking-[.2em]">{c.customer_id}</div>
                                        <div className="text-base font-black text-white tracking-tight">{c.product_type}</div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-10">
                                    <div className="text-right">
                                        <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">ML Score</div>
                                        <div className="text-xl font-black text-red-500 tabular">{Math.round(c.risk_score * 100)}%</div>
                                    </div>
                                    <ChevronRight size={16} className="text-zinc-700 group-hover/item:text-white transition-colors group-hover/item:translate-x-1" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

            </div>

        </div>
    )
}
