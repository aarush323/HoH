import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import type { CustomerDetail, VoiceCustomer, DashboardStats } from '../types'
import {
    Zap,
    ShieldAlert,
    ChevronRight,
    ArrowUpRight,
    Play,
    Users,
    Phone,
    CheckCircle,
    TrendingUp,
    Activity
} from 'lucide-react'
import {
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
    BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts'

type TabType = 'all' | 'voice'

export default function Dashboard() {
    const navigate = useNavigate()
    const [customers, setCustomers] = useState<CustomerDetail[]>([])
    const [voiceCustomers, setVoiceCustomers] = useState<VoiceCustomer[]>([])
    const [stats, setStats] = useState<DashboardStats | null>(null)
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<TabType>('all')

    useEffect(() => {
        Promise.all([
            api.getCustomersAll(),
            api.getCustomersVoice(),
            api.getDashboardStats()
        ])
            .then(([all, voice, statsData]) => {
                setCustomers(all);
                setVoiceCustomers(voice);
                setStats(statsData);
            })
            .catch(console.error)
            .finally(() => setLoading(false))
    }, [])

    if (loading) return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="w-12 h-12 border-4 border-zinc-100 border-t-indigo-600 rounded-full animate-spin" />
        </div>
    )

    const displayedCustomers = activeTab === 'all' ? customers : voiceCustomers

    // Risk distribution data
    const pieData = [
        { name: 'High', value: stats?.high_risk_count || 0, color: '#ef4444' },
        { name: 'Medium', value: stats?.medium_risk_count || 0, color: '#f59e0b' },
        { name: 'Low', value: stats?.low_risk_count || 0, color: '#10b981' }
    ]

    // Channel mix data
    const channelData = [
        { name: 'Voice', value: stats?.channel_mix?.voice || 0, color: '#6366f1' },
        { name: 'Email', value: stats?.channel_mix?.email || 0, color: '#71717a' },
        { name: 'SMS', value: stats?.channel_mix?.sms || 0, color: '#a1a1aa' }
    ]

    // Product risk data
    const productData = [
        { name: 'Home Loan', atRisk: stats?.risk_by_product?.home_loan?.at_risk || 0 },
        { name: 'Credit Card', atRisk: stats?.risk_by_product?.credit_card?.at_risk || 0 },
        { name: 'Personal Loan', atRisk: stats?.risk_by_product?.personal_loan?.at_risk || 0 }
    ]

    const activeWatchlist = displayedCustomers.filter(c => c.risk_level === 'High' || c.risk_level === 'Medium')

    return (
        <div className="animate-fade-in pb-32 max-w-[1400px] mx-auto px-10 font-sans text-zinc-900 leading-tight">

            {/* 1. Executive Top Header */}
            <div className="pt-20 mb-12 flex flex-col md:flex-row justify-between items-end gap-10">
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

            {/* 2. Tab Bar */}
            <div className="flex items-center gap-2 p-2 bg-zinc-50 rounded-2xl border border-zinc-100 w-fit mb-12">
                <button
                    onClick={() => setActiveTab('all')}
                    className={`flex items-center gap-2 px-6 py-3 rounded-[1.25rem] text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'all'
                            ? 'bg-zinc-950 text-white shadow-xl shadow-zinc-900/10'
                            : 'text-zinc-400 hover:text-zinc-950'
                        }`}
                >
                    <Users size={14} />
                    All Customers
                    <span className={`ml-1 px-2 py-0.5 rounded-full text-[9px] ${activeTab === 'all' ? 'bg-white/20' : 'bg-zinc-200'}`}>
                        {customers.length}
                    </span>
                </button>
                <button
                    onClick={() => setActiveTab('voice')}
                    className={`flex items-center gap-2 px-6 py-3 rounded-[1.25rem] text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'voice'
                            ? 'bg-zinc-950 text-white shadow-xl shadow-zinc-900/10'
                            : 'text-zinc-400 hover:text-zinc-950'
                        }`}
                >
                    <Phone size={14} />
                    Voice Interventions
                    <span className={`ml-1 px-2 py-0.5 rounded-full text-[9px] ${activeTab === 'voice' ? 'bg-white/20' : 'bg-zinc-200'}`}>
                        {voiceCustomers.length}
                    </span>
                </button>
            </div>

            {/* 3. Primary KPI Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-16">
                {[
                    {
                        label: "Portfolio Exposure",
                        value: `₹${((stats?.total_exposure || 0) / 100000).toFixed(1)}L`,
                        desc: "Total Outstanding",
                        icon: <Users size={16} className="text-zinc-400" />,
                        accent: "bg-zinc-50 border-zinc-100"
                    },
                    {
                        label: "At-Risk Accounts",
                        value: `${stats?.at_risk_percentage || 0}%`,
                        desc: "High & Medium Risk",
                        icon: <ShieldAlert size={16} className="text-red-500" />,
                        accent: "bg-red-50 text-red-900 border-red-100"
                    },
                    {
                        label: "Avg Salary Delay",
                        value: `${stats?.avg_salary_delay || 0}d`,
                        desc: "Portfolio Average",
                        icon: <Activity size={16} className="text-amber-500" />,
                        accent: "bg-amber-50 text-amber-900 border-amber-100"
                    },
                    {
                        label: "Active Interventions",
                        value: `${stats?.active_interventions || 0}`,
                        desc: "In Progress",
                        icon: <TrendingUp size={16} className="text-indigo-400" />,
                        accent: "bg-indigo-50 text-indigo-900 border-indigo-100"
                    }
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

            {/* 4. Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 mb-10">

                {/* Risk Distribution Donut */}
                <div className="lg:col-span-4 bg-white rounded-[3rem] p-12 border border-zinc-100 shadow-sm relative overflow-hidden group hover:shadow-2xl transition-all">
                    <div className="relative z-10 space-y-2 mb-8">
                        <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400">ML Analysis</div>
                        <h3 className="text-2xl font-black tracking-tight uppercase leading-none">Risk Distribution</h3>
                    </div>

                    <div className="h-[220px] w-full relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={pieData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={90}
                                    paddingAngle={6}
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
                            <div className="text-3xl font-black tracking-tight">{stats?.total_customers || 0}</div>
                            <div className="text-[9px] font-black uppercase text-zinc-300 tracking-[.4em]">ACCOUNTS</div>
                        </div>
                    </div>

                    {/* Legend */}
                    <div className="mt-8 flex justify-between gap-4 border-t border-zinc-50 pt-8">
                        {pieData.map((d, i) => (
                            <div key={i} className="flex flex-col gap-1">
                                <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: d.color }}>{d.name}</span>
                                <span className="text-lg font-black tracking-tight">{d.value}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Channel Mix */}
                <div className="lg:col-span-4 bg-white rounded-[3rem] p-12 border border-zinc-100 shadow-sm relative overflow-hidden group hover:shadow-2xl transition-all">
                    <div className="space-y-2 mb-8">
                        <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Channel Mix</div>
                        <h3 className="text-2xl font-black tracking-tight uppercase leading-none">Outreach Channels</h3>
                    </div>

                    <div className="h-[220px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={channelData} layout="vertical" margin={{ left: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis type="number" hide />
                                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fontWeight: 600 }} width={60} />
                                <Tooltip />
                                <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                                    {channelData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Resolution & Acceptance */}
                <div className="lg:col-span-4 space-y-6">
                    {/* Stress Search Volume */}
                    <div className="bg-white rounded-[3rem] p-8 border border-zinc-100 shadow-sm">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Behavioral Signal</div>
                                <h3 className="text-xl font-black tracking-tight uppercase">Stress Queries</h3>
                            </div>
                            <ShieldAlert size={20} className="text-red-500" />
                        </div>
                        <div className="flex items-end gap-3 mb-4">
                            <span className="text-5xl font-black tracking-tight text-red-500">{stats?.total_stress_queries || 0}</span>
                            <span className="text-[10px] font-black text-zinc-300 uppercase mb-2">Total Hits</span>
                        </div>
                        <div className="text-[11px] text-zinc-500 font-medium">In-app searches for debt assistance</div>
                    </div>

                    {/* Portfolio Liquidity */}
                    <div className="bg-white rounded-[3rem] p-8 border border-zinc-100 shadow-sm">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Portfolio Health</div>
                                <h3 className="text-xl font-black tracking-tight uppercase">Income Delay</h3>
                            </div>
                            <Activity size={20} className="text-amber-500" />
                        </div>
                        <div className="flex items-end gap-3 mb-4">
                            <span className="text-5xl font-black tracking-tight text-amber-500">{stats?.avg_salary_delay || 0}d</span>
                            <span className="text-[10px] font-black text-zinc-300 uppercase mb-2">Avg Delay</span>
                        </div>
                        <div className="h-3 bg-zinc-100 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-amber-500 rounded-full transition-all duration-500"
                                style={{ width: `${Math.min(((stats?.avg_salary_delay || 0) / 10) * 100, 100)}%` }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* 5. Risk by Product */}
            <div className="bg-white rounded-[3rem] p-12 border border-zinc-100 shadow-sm mb-10">
                <div className="space-y-2 mb-8">
                    <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Product Analysis</div>
                    <h3 className="text-2xl font-black tracking-tight uppercase leading-none">At-Risk by Product Type</h3>
                </div>

                <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={productData} margin={{ left: 20, right: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="name" tick={{ fontSize: 12, fontWeight: 600 }} />
                            <YAxis tick={{ fontSize: 11 }} />
                            <Tooltip />
                            <Bar dataKey="atRisk" name="At-Risk Accounts" fill="#ef4444" radius={[8, 8, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* 6. Critical Stress Watchlist */}
            <div className="bg-zinc-950 rounded-[3rem] p-12 border border-zinc-900 shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-12 opacity-10 group-hover:scale-150 transition-transform duration-1000">
                    <ShieldAlert size={120} className="text-red-500" />
                </div>

                <div className="relative z-10 space-y-2 mb-8 flex justify-between items-end">
                    <div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                            {activeTab === 'voice' ? 'Voice Interventions' : 'ML Criticals'}
                        </div>
                        <h3 className="text-3xl font-black tracking-tight uppercase leading-none text-white">
                            {activeTab === 'voice' ? 'Active Voice Call List' : 'Active Stress Watchlist'}
                        </h3>
                    </div>
                    <button
                        onClick={() => navigate('/live')}
                        className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors"
                    >
                        <span className="text-[9px] font-black uppercase tracking-widest">Live Stream</span>
                        <Play size={12} fill="currentColor" />
                    </button>
                </div>

                <div className="space-y-4">
                    {activeWatchlist.length === 0 ? (
                        <div className="py-16 text-center">
                            <div className="text-[11px] font-black uppercase tracking-[0.3em] text-zinc-600">
                                {activeTab === 'voice' ? 'No voice interventions yet' : 'No high-risk accounts detected'}
                            </div>
                        </div>
                    ) : (
                        activeWatchlist.slice(0, 4).map((c, i) => (
                            <div
                                key={c.customer_id}
                                onClick={() => navigate(`/customer/${c.customer_id}`)}
                                className="group/item flex items-center justify-between p-6 bg-zinc-900/50 rounded-2xl border border-zinc-800/50 hover:bg-red-500/10 hover:border-red-500/30 transition-all cursor-pointer"
                            >
                                <div className="flex items-center gap-6">
                                    <div className="text-zinc-700 font-black italic group-hover/item:text-red-500 transition-colors">#{i + 1}</div>
                                    <div>
                                        <div className="text-[10px] font-black uppercase text-zinc-500 tracking-[.2em]">{c.customer_id}</div>
                                        <div className="text-base font-black text-white tracking-tight">{c.product_type}</div>
                                        {activeTab === 'voice' && (c as VoiceCustomer).intervention_method && (
                                            <div className="text-[9px] text-indigo-400 mt-1 uppercase tracking-wider">
                                                {(c as VoiceCustomer).intervention_method?.replace('_', ' ')}
                                            </div>
                                        )}
                                        {c.analysis && (
                                            <>
                                                <div className="flex flex-wrap gap-2 mt-2">
                                                    <span className="px-3 py-1 bg-zinc-800 border border-zinc-700 rounded-lg text-[9px] font-bold uppercase text-zinc-400">
                                                        {c.analysis.stress_type}
                                                    </span>
                                                    <span className={`px-3 py-1 rounded-lg text-[9px] font-bold uppercase ${
                                                        c.analysis.severity === 'high' || c.analysis.severity === 'very high' ? 'bg-red-500/20 text-red-400' : 
                                                        c.analysis.severity === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                                                        'bg-zinc-700 text-zinc-400'
                                                    }`}>
                                                        {c.analysis.severity}
                                                    </span>
                                                </div>
                                                {c.analysis.narrative && (
                                                    <div className="text-[9px] text-zinc-500 mt-2 italic line-clamp-1">
                                                        "{c.analysis.narrative}"
                                                    </div>
                                                )}
                                            </>
                                        )}
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
                        ))
                    )}
                </div>
            </div>

        </div>
    )
}
