import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveFeed } from '../context/LiveFeedContext'
import { api } from '../api/client'
import {
    Zap,
    ShieldAlert,
    ChevronRight,
    ArrowRightCircle,
    Activity,
    User,
    Wifi,
    BarChart3
} from 'lucide-react'

export default function LiveFeed() {
    const { customers, connected } = useLiveFeed()
    const navigate = useNavigate()
    const [isSimulating, setIsSimulating] = useState(false)
    const [highRiskCount, setHighRiskCount] = useState(0)

    useEffect(() => {
        setHighRiskCount(customers.filter(c => c.risk_level === 'High').length)
    }, [customers.length, customers.map(c => c.risk_level).join(',')])

    const handleStartSimulation = async () => {
        setIsSimulating(true)
        try {
            await api.triggerProducer()
        } catch (err) {
            console.error('Failed to start stream:', err)
        }
        // Keep button disabled for 30 seconds to prevent duplicate clicks
        setTimeout(() => setIsSimulating(false), 30000)
    }

    return (
        <div className="animate-fade-in pb-32 max-w-[1240px] mx-auto px-6 font-sans text-zinc-900 selection:bg-indigo-50 selection:text-indigo-900 leading-tight">
            {/* Minimalist Hub Header (No Title, Only 3 Tiles) */}
            <div className="pt-16 mb-20 flex flex-col md:flex-row justify-between items-center gap-10">

                <div className="flex flex-wrap items-center gap-4">
                    {/* Tile 1: System Status */}
                    <div className="h-16 px-8 bg-zinc-50 rounded-2xl flex items-center gap-4 transition-all hover:bg-zinc-100/50 shadow-sm border border-zinc-100">
                        <div className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-red-500'}`} />
                        <div>
                            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">SYSTEM</div>
                            <div className="text-xs font-black text-zinc-900 uppercase tracking-widest">{connected ? 'ONLINE' : 'ERROR'}</div>
                        </div>
                    </div>

                    {/* Tile 2: Portfolio Analysis */}
                    <div className="h-16 px-8 bg-zinc-50 rounded-2xl flex items-center gap-4 transition-all hover:bg-zinc-100/50 shadow-sm border border-zinc-100">
                        <BarChart3 size={16} className="text-zinc-600" />
                        <div>
                            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">MONITORING</div>
                            <div className="text-xs font-black text-zinc-900 uppercase tracking-widest">321 ACCOUNTS</div>
                        </div>
                    </div>

                    {/* Tile 3: High-Risk Detection */}
                    <div className={`h-16 px-8 rounded-2xl flex items-center gap-4 transition-all border ${highRiskCount > 0 ? 'bg-red-50 text-red-700 border-red-100 shadow-xl shadow-red-500/10' : 'bg-zinc-50 border-zinc-100 shadow-sm'}`}>
                        <ShieldAlert size={16} className={highRiskCount > 0 ? 'text-red-500' : 'text-zinc-400'} />
                        <div>
                            <div className={`text-[10px] font-bold uppercase tracking-widest ${highRiskCount > 0 ? 'text-red-400' : 'text-zinc-400'}`}>ALERTS</div>
                            <div className={`text-xs font-black uppercase tracking-widest ${highRiskCount > 0 ? 'text-red-600' : 'text-zinc-900'}`}>{highRiskCount} DETECTIONS</div>
                        </div>
                    </div>
                </div>

                {/* Primary Action Button */}
                <button
                    onClick={handleStartSimulation}
                    disabled={isSimulating}
                    className={`flex items-center gap-3 px-10 h-14 rounded-2xl text-[11px] font-bold tracking-[0.25em] uppercase transition-all shadow-xl shadow-indigo-100/50 ${isSimulating
                        ? 'bg-zinc-100 text-zinc-400 cursor-not-allowed border-zinc-200 shadow-none'
                        : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95'
                        }`}
                >
                    <Zap fill="white" size={14} className={isSimulating ? 'animate-pulse' : ''} />
                    {isSimulating ? 'STREAMING...' : 'START STREAM'}
                </button>
            </div>

            {/* Premium Content Grid */}
            {customers.length === 0 ? (
                <div className="min-h-[40vh] bg-zinc-50/50 rounded-[3rem] border border-dashed border-zinc-200 flex flex-col items-center justify-center p-12 text-center group transition-colors hover:bg-white hover:border-zinc-300">
                    <Wifi size={40} className="mb-6 text-zinc-200 group-hover:text-indigo-400 transition-colors" />
                    <p className="text-[11px] font-black uppercase tracking-[.4em] text-zinc-400 leading-loose">Awaiting Signal Ingestion</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                    {customers.map((c) => {
                        const isHigh = c.risk_level === 'High';
                        const isLow = c.risk_level === 'Low';

                        return (
                            <div
                                key={c.customer_id}
                                className={`group relative bg-white rounded-[2.25rem] p-9 border transition-all duration-500 hover:-translate-y-1.5 shadow-sm hover:shadow-2xl hover:shadow-zinc-200/50 ${isHigh ? 'border-red-100 shadow-xl shadow-red-50/50' : 'border-zinc-100 shadow-indigo-100/10'}`}
                            >
                                {/* Card Header Cluster */}
                                <div className="flex justify-between items-center mb-10">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-zinc-50 flex items-center justify-center text-zinc-400 group-hover:bg-zinc-950 group-hover:text-white transition-all duration-300 shadow-sm">
                                            <User size={20} />
                                        </div>
                                        <div>
                                            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest leading-none mb-1.5">{c.product_type}</div>
                                            <div className="text-base font-black tracking-tight text-zinc-950 leading-none">ID: {c.customer_id}</div>
                                        </div>
                                    </div>
                                    <span className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest ${isHigh ? 'bg-red-500 text-white shadow-sm' : isLow ? 'bg-emerald-500 text-white shadow-sm' : 'bg-zinc-100 text-zinc-500 shadow-sm'}`}>
                                        {c.risk_level}
                                    </span>
                                </div>

                                {/* Headline Figure: Risk Percentage */}
                                <div className="mb-10">
                                    <div className="flex items-baseline gap-2">
                                        <div className={`text-6xl font-black tabular tracking-tighter ${isHigh ? 'text-red-500' : 'text-zinc-950'}`}>
                                            {Math.round(c.risk_score * 100)}<span className="text-2xl opacity-20 font-black italic">%</span>
                                        </div>
                                        <div className="text-[10px] font-black text-zinc-300 uppercase tracking-widest">Stress Score</div>
                                    </div>
                                </div>

                                {/* Readable Dual-Metric Grid */}
                                <div className="mb-10 grid grid-cols-2 gap-4">
                                    <div className="bg-zinc-50/50 rounded-2xl p-5 border border-transparent transition-all group-hover:bg-white group-hover:border-zinc-100">
                                        <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                            <Activity size={12} className="text-zinc-200" /> Salary Delay
                                        </div>
                                        <div className={`text-2xl font-black tabular ${isHigh ? 'text-red-500' : 'text-zinc-950'}`}>
                                            {c.signals.salary_delay}d
                                        </div>
                                    </div>
                                    <div className="bg-zinc-50/50 rounded-2xl p-5 border border-transparent transition-all group-hover:bg-white group-hover:border-zinc-100">
                                        <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                            <Activity size={12} className="text-zinc-200" /> Bounce Vol.
                                        </div>
                                        <div className={`text-2xl font-black tabular ${isHigh ? 'text-red-500' : 'text-zinc-950'}`}>
                                            {c.signals.auto_debit_failures}
                                        </div>
                                    </div>
                                </div>

                                {/* Integrated Reasoning Message */}
                                <div className={`mb-10 pl-6 border-l-3 transition-colors ${isHigh ? 'border-red-500' : isLow ? 'border-emerald-500' : 'border-zinc-100 group-hover:border-zinc-950'}`}>
                                    <p className={`text-[12px] font-bold leading-relaxed tracking-tight ${isHigh ? 'text-red-700/80' : isLow ? 'text-emerald-700' : 'text-zinc-500 group-hover:text-zinc-700'}`}>
                                        {isHigh
                                            ? "Early-vulnerability detected. Deploying autonomous debt-mitigation protocol."
                                            : "Behavioral signals stable. Continuous monitoring cycle active."}
                                    </p>
                                </div>

                                {/* Navigation Row */}
                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={() => navigate(`/journey/${c.customer_id}`)}
                                        className="flex-1 flex items-center justify-center gap-3 h-14 bg-zinc-950 text-white rounded-2xl text-[10px] font-bold tracking-[.15em] uppercase hover:bg-red-600 transition-all active:scale-95 shadow-xl shadow-zinc-100/50"
                                    >
                                        Watch Journey
                                        <ChevronRight size={14} strokeWidth={4} />
                                    </button>
                                    <button
                                        onClick={() => navigate(`/customer/${c.customer_id}`)}
                                        className="w-14 h-14 flex items-center justify-center bg-zinc-50 text-zinc-400 rounded-2xl hover:bg-zinc-950 hover:text-white transition-all shadow-sm active:scale-90 border border-zinc-50"
                                        title="View Profile"
                                    >
                                        <ArrowRightCircle size={22} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    )
}
