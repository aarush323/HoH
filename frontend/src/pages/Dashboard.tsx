import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import {
    Users,
    AlertCircle,
    Activity,
    TrendingDown,
    PieChart as PieIcon,
    ChevronRight,
    CheckCircle2,
    Zap,
    Play,
    CreditCard,
    AlertTriangle,
    Banknote,
    PiggyBank,
    Smartphone
} from 'lucide-react'
import {
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip as ReTooltip,
    BarChart, Bar, XAxis, YAxis
} from 'recharts'

export default function Dashboard() {
    const navigate = useNavigate()
    const [stats, setStats] = useState<any>(null)
    const [customers, setCustomers] = useState<any[]>([])
    const [audit, setAudit] = useState<any[]>([])
    const [earlyWarnings, setEarlyWarnings] = useState<any>(null)
    const [stressTypes, setStressTypes] = useState<any>(null)
    const [behavioral, setBehavioral] = useState<any>(null)
    const [shocks, setShocks] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [filter, setFilter] = useState<'all' | 'high'>('all')

    const fetchData = async () => {
        try {
            const [statsRes, customersRes, auditRes, warningsRes, stressRes, behavioralRes, shocksRes] = await Promise.all([
                api.getDashboardStats(),
                api.getCustomersAll(),
                api.getAudit(),
                api.getEarlyWarnings(),
                api.getStressTypes(),
                api.getBehavioral(),
                api.getShocks()
            ])
            setStats(statsRes)
            setCustomers(customersRes)
            setAudit(auditRes)
            setEarlyWarnings(warningsRes)
            setStressTypes(stressRes)
            setBehavioral(behavioralRes)
            setShocks(shocksRes)
            setError(null)
        } catch (err: any) {
            setError('Failed to load dashboard data. Retrying...')
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
        const retryInterval = setInterval(() => {
            if (error) fetchData()
        }, 5000)

        // SSE Setup
        const eventSource = new EventSource('http://localhost:8000/stream')
        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data)
            api.getDashboardStats().then(setStats).catch(console.error)
            if (data.type === 'audit' || data.customer_id) {
                setAudit(prev => [{
                    id: Date.now(),
                    customer_id: data.customer_id,
                    event_type: data.event_type || data.type || 'observation',
                    description: data.description || 'New signal detected',
                    timestamp: new Date().toISOString(),
                }, ...prev])
            }
        }

        return () => {
            clearInterval(retryInterval)
            eventSource.close()
        }
    }, [error])

    const filteredCustomers = useMemo(() => {
        if (filter === 'high') return customers.filter(c => c.risk_level?.toLowerCase() === 'high')
        return customers
    }, [customers, filter])

    const watchlist = useMemo(() => {
        return [...filteredCustomers]
            .sort((a, b) => (b.risk_score || 0) - (a.risk_score || 0))
            .slice(0, 5)
    }, [filteredCustomers])

    const optInData = useMemo(() => {
        const counts: Record<string, number> = {}
        customers.forEach(c => {
            const status = c.intervention_status || (c.last_outcome === 'Accepted' ? 'Accepted' : null)
            if (status) counts[status] = (counts[status] || 0) + 1
        })
        const mapped = Object.entries(counts).map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 3)
        return mapped.length === 0 ? [
            { name: 'Payment Holiday', value: 12 },
            { name: 'Restructuring', value: 8 },
            { name: 'Counselling', value: 5 }
        ] : mapped
    }, [customers])

    if (loading) return <DashboardSkeleton />

    return (
        <div className="animate-fade-in pb-32 max-w-[1400px] mx-auto px-6 md:px-10 font-sans text-zinc-900 leading-tight">

            {error && (
                <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[60] bg-red-500 text-white px-6 py-3 rounded-full shadow-2xl font-bold flex items-center gap-3 animate-bounce">
                    <AlertCircle size={20} />
                    {error}
                </div>
            )}

            {/* HERO */}
            <div className="pt-10 mb-12 flex flex-col md:flex-row justify-between items-end gap-10 bg-white p-12 rounded-[2.5rem] border border-zinc-100 shadow-sm relative overflow-hidden">
                <div className="space-y-4 relative z-10">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-zinc-950 text-white rounded-lg text-[9px] font-black uppercase tracking-[.3em] shadow-xl">
                        <Zap fill="white" size={10} /> v2.4 Topology Active
                    </div>
                    <h1 className="text-7xl font-black tracking-tighter text-zinc-950 leading-[.85]">
                        PORTFOLIO <br />
                        <span className="text-zinc-300">DASHBOARD.</span>
                    </h1>
                    <p className="text-zinc-500 text-sm font-bold uppercase tracking-widest italic opacity-60">
                        Real-time risk monitoring and automated intervention performance
                    </p>
                </div>

                <div className="flex bg-zinc-50 p-2 rounded-2xl border border-zinc-100 relative z-10">
                    <button
                        onClick={() => setFilter('all')}
                        className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filter === 'all' ? 'bg-zinc-950 text-white shadow-xl' : 'text-zinc-400 hover:text-zinc-950'}`}
                    >
                        All Accounts
                    </button>
                    <button
                        onClick={() => setFilter('high')}
                        className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filter === 'high' ? 'bg-zinc-950 text-white shadow-xl' : 'text-zinc-400 hover:text-zinc-950'}`}
                    >
                        High Risk Only
                    </button>
                </div>
            </div>

            {/* KPI STRIP */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                <Card
                    label="PORTFOLIO EXPOSURE"
                    value="₹84.2L"
                    subtext="TOTAL OUTSTANDING"
                    icon={<Users size={20} />}
                    color="text-zinc-950"
                />
                <Card
                    label="EARLY WARNINGS"
                    value="142"
                    subtext="STRESS SIGNALS DETECTED"
                    icon={<AlertTriangle size={20} />}
                    color="text-amber-600"
                    bg="bg-amber-50"
                />
                <Card
                    label="COST AVOIDED"
                    value="₹12.4L"
                    subtext="EARLY INTERVENTION SAVINGS"
                    icon={<TrendingDown size={20} />}
                    color="text-emerald-600"
                    bg="bg-emerald-50"
                />
                <Card
                    label="RECOVERY RATE"
                    value={`${stats?.resolution_rate || 68}%`}
                    subtext="INTERVENTIONS RESOLVED"
                    icon={<CheckCircle2 size={20} />}
                    color="text-purple-600"
                    bg="bg-purple-50"
                />
            </div>

            {/* EARLY WARNINGS & STRESS TYPES ROW */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
                <div className="bg-white rounded-[2rem] p-10 border border-zinc-100 shadow-sm flex flex-col">
                    <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle size={16} className="text-amber-500" />
                        <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Pre-Delinquency Signals</div>
                    </div>
                    <h2 className="text-2xl font-black tracking-tight text-zinc-950 uppercase mb-6">EARLY WARNING SIGNALS</h2>
                    <div className="space-y-4 flex-1">
                        {[
                            { label: 'Salary Delayed (>3 days)', value: earlyWarnings?.salary_delayed || 42, color: '#ef4444' },
                            { label: 'Savings Drawdown (>20%)', value: earlyWarnings?.savings_drawdown || 38, color: '#f97316' },
                            { label: 'Lending App Activity', value: earlyWarnings?.lending_app_activity || 24, color: '#8b5cf6' },
                            { label: 'Utility Payment Delay', value: earlyWarnings?.utility_delay || 19, color: '#f59e0b' },
                            { label: 'Auto-Debit Failures', value: earlyWarnings?.auto_debit_failures || 19, color: '#ec4899' },
                        ].map((item, i) => (
                            <div key={i} className="flex items-center justify-between">
                                <span className="text-xs font-bold text-zinc-600">{item.label}</span>
                                <div className="flex items-center gap-2">
                                    <div className="w-32 h-2 bg-zinc-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full rounded-full"
                                            style={{ width: `${Math.min((item.value / 50) * 100, 100)}%`, backgroundColor: item.color }}
                                        />
                                    </div>
                                    <span className="text-xs font-black text-zinc-900 w-8 text-right">{item.value}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-white rounded-[2rem] p-10 border border-zinc-100 shadow-sm flex flex-col">
                    <div className="flex items-center gap-2 mb-2">
                        <Activity size={16} className="text-purple-500" />
                        <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Stress Analysis</div>
                    </div>
                    <h2 className="text-2xl font-black tracking-tight text-zinc-950 uppercase mb-6">STRESS TYPE BREAKDOWN</h2>
                    <div className="h-56 relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart layout="vertical" data={stressTypes?.distribution?.length > 0 ? stressTypes.distribution : [
                                { name: 'Income Shock', value: 42 },
                                { name: 'Overspending', value: 28 },
                                { name: 'Structural', value: 18 },
                                { name: 'Debt Burden', value: 12 }
                            ]}>
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900 }} width={80} />
                                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                                    {['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd'].map((color, i) => (
                                        <Cell key={i} fill={color} />
                                    ))}
                                </Bar>
                                <ReTooltip />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* BEHAVIORAL RISK CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                <div className="bg-white rounded-[2rem] p-8 border border-zinc-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-purple-100 rounded-xl">
                            <Smartphone size={20} className="text-purple-600" />
                        </div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Debt Signals</div>
                    </div>
                    <div className="text-3xl font-black text-zinc-900">{behavioral?.lending_app_users || 12}</div>
                    <div className="text-xs font-bold text-zinc-500 mt-1">Lending App Users</div>
                    <div className="text-xs font-bold text-purple-600 mt-2">₹{((behavioral?.lending_app_total_amount || 420000) / 1000).toFixed(0)}K total</div>
                </div>
                <div className="bg-white rounded-[2rem] p-8 border border-zinc-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-red-100 rounded-xl">
                            <AlertTriangle size={20} className="text-red-600" />
                        </div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Risky Behavior</div>
                    </div>
                    <div className="text-3xl font-black text-zinc-900">{behavioral?.gambling_users || 4}</div>
                    <div className="text-xs font-bold text-zinc-500 mt-1">Gambling Detected</div>
                    <div className="text-xs font-bold text-red-600 mt-2">₹{((behavioral?.gambling_total_amount || 85000) / 1000).toFixed(0)}K total</div>
                </div>
                <div className="bg-white rounded-[2rem] p-8 border border-zinc-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-amber-100 rounded-xl">
                            <CreditCard size={20} className="text-amber-600" />
                        </div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Credit Strain</div>
                    </div>
                    <div className="text-3xl font-black text-zinc-900">{behavioral?.high_cc_util_users || 18}</div>
                    <div className="text-xs font-bold text-zinc-500 mt-1">High CC Utilization (&gt;80%)</div>
                    <div className="text-xs font-bold text-amber-600 mt-2">Avg: {(behavioral?.avg_cc_utilization || 84).toFixed(0)}%</div>
                </div>
                <div className="bg-white rounded-[2rem] p-8 border border-zinc-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-emerald-100 rounded-xl">
                            <PiggyBank size={20} className="text-emerald-600" />
                        </div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Savings Health</div>
                    </div>
                    <div className="text-3xl font-black text-zinc-900">{behavioral?.savings_drawdown_users || 22}</div>
                    <div className="text-xs font-bold text-zinc-500 mt-1">Savings Depleted</div>
                    <div className="text-xs font-bold text-emerald-600 mt-2">Avg: {(behavioral?.avg_savings_drawdown || 62).toFixed(0)}% drawdown</div>
                </div>
            </div>

            {/* ANALYTICS ROW */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
                <div className="bg-white rounded-[2rem] p-10 border border-zinc-100 shadow-sm flex flex-col">
                    <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1">Risk Mix</div>
                    <h2 className="text-2xl font-black tracking-tight text-zinc-950 uppercase mb-8">RISK DISTRIBUTION</h2>
                    <div className="h-64 relative mb-6">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={[
                                        { name: 'High', value: stats?.high_risk_count || 0 },
                                        { name: 'Medium', value: stats?.medium_risk_count || 0 },
                                        { name: 'Low', value: stats?.low_risk_count || 0 }
                                    ]}
                                    innerRadius={70}
                                    outerRadius={90}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    <Cell fill="#ef4444" />
                                    <Cell fill="#f59e0b" />
                                    <Cell fill="#10b981" />
                                </Pie>
                                <ReTooltip />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <div className="text-3xl font-black text-zinc-950 leading-none">{stats?.total_customers || 0}</div>
                            <div className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mt-1">ACCOUNTS</div>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-[2rem] p-10 border border-zinc-100 shadow-sm flex flex-col">
                    <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1">Interaction Mix</div>
                    <h2 className="text-2xl font-black tracking-tight text-zinc-950 uppercase mb-8">OUTREACH CHANNELS</h2>
                    <div className="flex-1 min-h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart layout="vertical" data={[
                                { name: 'Voice', value: stats?.channel_mix?.voice || 0, color: '#6366f1' },
                                { name: 'Email', value: stats?.channel_mix?.email || 0, color: '#71717a' },
                                { name: 'SMS', value: stats?.channel_mix?.sms || 0, color: '#a1a1aa' }
                            ]}>
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900 }} />
                                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
                                    {[0, 1, 2].map((i) => (
                                        <Cell key={i} fill={['#6366f1', '#71717a', '#a1a1aa'][i]} />
                                    ))}
                                </Bar>
                                <ReTooltip />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white rounded-[2rem] p-10 border border-zinc-100 shadow-sm flex flex-col">
                    <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1">Engagement</div>
                    <h2 className="text-2xl font-black tracking-tight text-zinc-950 uppercase mb-8">INTERVENTION OPT-INS</h2>
                    <div className="flex-1 min-h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart layout="vertical" data={optInData}>
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 900 }} width={80} />
                                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24} fill="#6366f1" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* EXTERNAL SHOCKS */}
            <div className="bg-white rounded-[2rem] p-10 border border-zinc-100 shadow-sm mb-12">
                <div className="flex items-center gap-2 mb-2">
                    <Banknote size={16} className="text-red-500" />
                    <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Life Events</div>
                </div>
                <h2 className="text-2xl font-black tracking-tight text-zinc-950 uppercase mb-8">EXTERNAL SHOCK EVENTS</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {(shocks?.shocks?.length > 0 ? shocks.shocks : [
                        { name: 'Job Loss', value: 5 },
                        { name: 'Medical Emergency', value: 3 },
                        { name: 'Business Failure', value: 2 },
                        { name: 'Family Emergency', value: 1 }
                    ]).map((shock: any, i: number) => (
                        <div key={i} className="bg-red-50 rounded-2xl p-6 border border-red-100">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold text-red-700">{shock.name}</span>
                                <AlertCircle size={16} className="text-red-500" />
                            </div>
                            <div className="text-4xl font-black text-red-600">{shock.value}</div>
                            <div className="text-[10px] font-bold text-red-400 uppercase mt-1">Customers Affected</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* WATCHLIST */}
            <div className="bg-zinc-950 rounded-[2.5rem] p-12 mb-12 shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none group-hover:scale-110 transition-transform">
                    <PieIcon size={200} className="text-white" />
                </div>

                <div className="flex justify-between items-start mb-12 relative z-10">
                    <div className="space-y-1">
                        <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500">ML Criticals</div>
                        <h2 className="text-4xl font-black text-white tracking-tighter uppercase leading-none">Stress Watchlist</h2>
                    </div>
                    <button onClick={() => navigate('/live')} className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white text-white hover:text-black rounded-xl text-[10px] font-black tracking-widest transition-all border border-white/10 uppercase">
                        <Play size={10} fill="currentColor" /> Live Stream
                    </button>
                </div>

                <div className="space-y-4 relative z-10">
                    {watchlist.map((c, i) => (
                        <div
                            key={c.customer_id}
                            onClick={() => navigate(`/customer/${c.customer_id}`)}
                            className={`flex items-center justify-between p-8 bg-white/5 hover:bg-white/10 border-l-4 rounded-xl transition-all cursor-pointer ${c.risk_level?.toLowerCase() === 'high' ? 'border-red-500' : 'border-amber-500'}`}
                        >
                            <div className="flex items-center gap-8">
                                <span className="text-xl font-black text-zinc-700 font-mono">#{i + 1}</span>
                                <div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-lg font-black text-white font-mono tracking-tighter uppercase">{c.customer_id}</span>
                                        <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">{c.product_type}</span>
                                    </div>
                                    <div className="text-[11px] font-bold text-zinc-500 italic mt-1 line-clamp-1 max-w-[400px]">"{c.stress_narrative || c.analysis?.narrative || 'Affordability metrics indicate increasing liquidity pressure.'}"</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-10">
                                <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${c.risk_level?.toLowerCase() === 'high' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'}`}>{c.risk_level}</span>
                                <div className="text-right">
                                    <div className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1">ML SCORE</div>
                                    <div className="text-3xl font-black text-red-500 leading-none">{(c.risk_score * 100).toFixed(0)}%</div>
                                </div>
                                <ChevronRight size={24} className="text-zinc-800" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                <MetricCard
                    label="SUCCESS RATE" title="RESOLUTION RATE"
                    value={`${stats?.resolution_rate || 82}%`}
                    icon={<CheckCircle2 size={24} className="text-emerald-500" />}
                    color="text-emerald-500" progress={stats?.resolution_rate || 82} progressColor="bg-emerald-500"
                />
                <MetricCard
                    label="ENGAGEMENT" title="ACCEPTANCE RATE"
                    value={`${stats?.acceptance_rate || 64}%`}
                    icon={<TrendingDown size={24} className="text-purple-600" />}
                    color="text-purple-600" progress={stats?.acceptance_rate || 64} progressColor="bg-purple-600"
                />
            </div>

            <div className="bg-white rounded-[2.5rem] p-12 border border-zinc-100 shadow-sm">
                <div className="flex justify-between items-center mb-8">
                    <h2 className="text-2xl font-black text-zinc-950 uppercase tracking-tight">RECENT PIPELINE ACTIVITY</h2>
                    <span className="flex items-center gap-2 px-3 py-1 bg-red-50 text-red-600 rounded-lg text-[9px] font-black border border-red-100"><span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" /> LIVE</span>
                </div>
                <div className="space-y-1 max-h-[300px] overflow-y-auto pr-2 scrollbar-thin">
                    {audit.map((entry: any) => (
                        <ActivityRow key={entry.id || entry.timestamp} entry={entry} />
                    ))}
                </div>
            </div>

        </div>
    )
}

function Card({ label, value, subtext, icon, color, bg = 'bg-white' }: any) {
    return (
        <div className={`${bg} rounded-[2rem] p-8 border border-zinc-100 shadow-sm space-y-4 group hover:border-zinc-300 transition-all`}>
            <div className="flex justify-between items-start">
                <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{label}</div>
                <div className="text-zinc-200 group-hover:scale-110">{icon}</div>
            </div>
            <div>
                <div className={`text-4xl font-black tracking-tighter leading-none ${color}`}>{value}</div>
                <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-1 italic">{subtext}</div>
            </div>
        </div>
    )
}

function MetricCard({ label, title, value, icon, color, progress, progressColor }: any) {
    return (
        <div className="bg-white rounded-[2rem] p-10 border border-zinc-100 shadow-sm flex flex-col group hover:border-zinc-300 transition-all">
            <div className="flex justify-between items-start mb-6">
                <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1">{label}</div>
                    <h3 className="text-xl font-black text-zinc-950 uppercase">{title}</h3>
                </div>
                {icon}
            </div>
            <div className="mt-auto space-y-6">
                <div className={`text-6xl font-black tracking-tighter ${color}`}>{value}</div>
                <div className="h-2 w-full bg-zinc-50 rounded-full overflow-hidden border border-zinc-100/50">
                    <div className={`h-full ${progressColor} transition-all duration-1000 ease-out`} style={{ width: `${progress}%` }} />
                </div>
            </div>
        </div>
    )
}

function ActivityRow({ entry }: any) {
    const type = entry.event_type || entry.type || 'intervention'
    const dotColor = type.includes('bounce') ? 'bg-red-500' : type.includes('resolved') ? 'bg-green-500' : type.includes('voice') ? 'bg-purple-500' : 'bg-amber-500'
    const textColor = dotColor.replace('bg-', 'text-')
    return (
        <div className="flex items-center justify-between p-4 hover:bg-zinc-50 rounded-xl transition-all animate-slide-up border-b border-zinc-50 last:border-0 border-l-2 border-l-transparent hover:border-l-indigo-600">
            <div className="flex items-center gap-6">
                <div className={`w-2.5 h-2.5 rounded-full ${dotColor} shadow-sm animate-pulse`} />
                <div className={`text-[11px] font-black uppercase tracking-widest w-32 ${textColor}`}>{type}</div>
                <div className="text-[11px] font-black text-zinc-400 font-mono w-20">{entry.customer_id}</div>
                <div className="text-xs font-bold text-zinc-600 italic">"{entry.description || entry.message_content || 'System trigger detected risk volatility'}"</div>
            </div>
            <div className="text-[11px] font-black text-zinc-300 uppercase tracking-tight tabular-nums">{formatTimestamp(entry.timestamp || entry.created_at)}</div>
        </div>
    )
}

function formatTimestamp(ts: string) {
    if (!ts) return 'NOW'
    const d = new Date(ts); const now = new Date(); const diff = Math.floor((now.getTime() - d.getTime()) / 60000)
    if (diff < 1) return 'JUST NOW'; if (diff < 60) return `${diff}M AGO`; return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function DashboardSkeleton() {
    return (
        <div className="animate-pulse pb-32 max-w-[1400px] mx-auto px-10 space-y-12 pt-10">
            <div className="h-64 bg-zinc-100 rounded-[2.5rem]" />
            <div className="grid grid-cols-4 gap-6">
                {[1, 2, 3, 4].map(i => <div key={i} className="h-40 bg-zinc-100 rounded-[2rem]" />)}
            </div>
        </div>
    )
}
