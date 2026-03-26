import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveFeed } from '../context/LiveFeedContext'
import { api } from '../api/client'
import {
    Box,
    Shield,
    Activity,
    Phone,
    Database,
    Zap,
    CheckCircle2,
    ArrowUpRight,
    Cpu
} from 'lucide-react'

export default function IngestionStream() {
    const navigate = useNavigate()
    const { customers, connected, eventCount } = useLiveFeed()
    const [isSimulating, setIsSimulating] = useState(false)
    const [highRiskCount, setHighRiskCount] = useState(0)

    useEffect(() => {
        setHighRiskCount(customers.filter((c: any) => c.risk_level === 'High').length)
    }, [customers])

    const stages = [
        { name: 'INGEST', icon: Database, color: 'text-blue-500' },
        { name: 'SCORE', icon: Shield, color: 'text-indigo-500' },
        { name: 'ANALYSE', icon: Activity, color: 'text-purple-500' },
        { name: 'OUTREACH', icon: Phone, color: 'text-emerald-500' }
    ]

    const handleStartSimulation = async () => {
        setIsSimulating(true)
        try {
            await api.triggerProducer()
        } catch (err) {
            console.error('Failed to trigger stream:', err)
        } finally {
            setIsSimulating(false)
        }
    }

    return (
        <div className="animate-fade-in pb-32 max-w-[1400px] mx-auto px-6 font-sans text-zinc-900 leading-tight">

            {/* 1. Header Section */}
            <div className="pt-20 mb-12 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2.5 ${connected ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
                            <span className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                            {connected ? 'Network Active' : 'Disconnected'}
                        </div>
                        <div className="px-4 py-1.5 rounded-full bg-zinc-900 text-zinc-400 border border-zinc-800 text-[10px] font-black uppercase tracking-widest">
                            {eventCount.toLocaleString()} Total Records
                        </div>
                    </div>
                    <h1 className="text-7xl font-black tracking-tight text-zinc-950 leading-none">
                        Real-time <span className="text-[#004ac6]">Live Feed</span>
                    </h1>
                </div>

                <div className="flex flex-wrap items-center gap-5">
                    {/* Live Stats Pill */}
                    <div className="flex items-center gap-8 px-10 h-24 bg-white rounded-[2.5rem] border border-zinc-100 shadow-2xl shadow-zinc-200/50">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-1">Monitoring</span>
                            <span className="text-3xl font-black text-zinc-950 tabular-nums">{customers.length}</span>
                        </div>
                        <div className="w-px h-12 bg-zinc-100" />
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-1">Detected Risk</span>
                            <div className="flex items-center gap-3">
                                <span className={`text-3xl font-black tabular-nums ${highRiskCount > 0 ? 'text-red-500' : 'text-zinc-950'}`}>
                                    {highRiskCount}
                                </span>
                                {highRiskCount > 0 && <Activity className="text-red-500 animate-pulse" size={24} />}
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={handleStartSimulation}
                        disabled={isSimulating}
                        className={`group flex items-center gap-4 h-24 px-12 rounded-[2.5rem] text-xs font-black tracking-[0.2em] uppercase transition-all overflow-hidden relative ${isSimulating
                            ? 'bg-zinc-100 text-zinc-400 cursor-not-allowed'
                            : 'bg-[#004ac6] text-white hover:bg-zinc-950 active:scale-95 shadow-2xl shadow-blue-600/30 hover:shadow-zinc-950/30'}`}
                    >
                        <Zap fill={isSimulating ? 'none' : 'currentColor'} size={18} className={isSimulating ? 'animate-pulse' : 'group-hover:rotate-12 transition-all'} />
                        {isSimulating ? 'Processing...' : 'Stream Data'}
                    </button>
                </div>
            </div>

            {/* 2. Pipeline Stream Container */}
            <div className="relative space-y-6">
                {/* Visual Lineage Decoration */}
                <div className="absolute left-[3.25rem] top-0 bottom-0 w-px bg-gradient-to-b from-blue-500/20 via-zinc-100 to-transparent -z-10" />

                {customers.length === 0 ? (
                    <div className="py-48 bg-zinc-50/50 rounded-[4rem] border border-dashed border-zinc-200 flex flex-col items-center justify-center text-center">
                        <div className="w-24 h-24 bg-white rounded-[2.5rem] flex items-center justify-center mb-8 border border-zinc-100 shadow-xl shadow-zinc-200/50">
                            <Cpu size={40} className="text-zinc-200 animate-pulse" />
                        </div>
                        <h3 className="text-xl font-black text-zinc-300 uppercase tracking-[0.3em] mb-4">Signal Awaited</h3>
                        <p className="text-zinc-400 font-medium max-w-sm px-10 leading-relaxed capitalize">
                            Initiate session to begin processing real-time customer behavioral signals.
                        </p>
                    </div>
                ) : (
                    [...customers].reverse().map((c, i) => {
                        const isHigh = c.risk_level === 'High'
                        const isMedium = c.risk_level === 'Medium'

                        // Pipeline progress calculation
                        const status = c.pipeline_status || { ingested: true, scored: true, analysed: false, outreach: false };
                        const progress = status.outreach ? 4 : status.analysed ? 3 : status.scored ? 2 : 1;

                        return (
                            <div
                                key={`${c.customer_id}-${i}`}
                                className={`group relative bg-white h-[140px] flex items-center px-12 rounded-[3.5rem] border border-zinc-100 transition-all duration-700 hover:border-zinc-300 hover:shadow-[0_40px_80px_-20px_rgba(0,0,0,0.08)] hover:-translate-y-1.5 ${isHigh ? 'border-red-100 bg-red-50/5' : ''}`}
                            >
                                {/* Active Link Animated Node */}
                                <div className="absolute -left-3 top-1/2 -translate-y-1/2 hidden lg:flex">
                                    <div className={`w-7 h-7 rounded-full border-[6px] border-[#f9f9f9] shadow-xl ${isHigh ? 'bg-red-500' : 'bg-[#004ac6]'} animate-node-pulse`} />
                                </div>

                                {/* Identity Block */}
                                <div className="w-[18%] flex items-center gap-8 border-r border-zinc-50 pr-8 shrink-0">
                                    <div className={`w-16 h-16 rounded-3xl flex items-center justify-center transition-all duration-500 shadow-sm ${isHigh ? 'bg-red-50 text-red-500' : 'bg-zinc-50 text-zinc-400 group-hover:bg-[#004ac6] group-hover:text-white group-hover:scale-105'}`}>
                                        <Box size={24} />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-[10px] font-black text-zinc-300 uppercase tracking-[0.2em] mb-2">{c.observation_week}</div>
                                        <div className="text-xl font-black text-zinc-950 tracking-tighter truncate leading-none">
                                            {c.customer_id}
                                        </div>
                                        <div className="text-[9px] font-bold text-zinc-400 mt-2 uppercase tracking-[0.1em] px-2 py-0.5 bg-zinc-50 border border-zinc-100 rounded-md inline-block">{c.customer_segment}</div>
                                    </div>
                                </div>

                                {/* Continuous Pipeline Visualisation */}
                                <div className="flex-1 flex flex-col justify-center px-16 relative">
                                    <div className="flex items-center justify-between w-full max-w-3xl mx-auto relative px-4">

                                        {/* Dynamic Progress Line (The Continuous Strand) */}
                                        <div className="absolute inset-x-8 top-6 h-1 bg-zinc-50 -z-0 rounded-full" />
                                        <div
                                            className={`absolute left-8 top-6 h-1 transition-all duration-1000 ease-out rounded-full -z-0 ${isHigh ? 'bg-red-500/30' : 'bg-blue-500/20'}`}
                                            style={{ width: `${((progress - 1) / (stages.length - 1)) * 92}%` }}
                                        />

                                        {stages.map((S, si) => {
                                            const stepIdx = si + 1;
                                            const isDone = stepIdx <= progress;
                                            const isCurrent = stepIdx === progress;

                                            return (
                                                <div key={si} className={`flex flex-col items-center gap-4 relative z-10 group/stage`}>
                                                    <div className={`w-12 h-12 rounded-2xl bg-white border-2 flex items-center justify-center transition-all duration-700 ${isDone
                                                        ? isHigh && si >= 2 ? 'border-red-500 text-red-500 shadow-xl shadow-red-500/10 scale-110' : 'border-emerald-500 text-emerald-500 shadow-xl shadow-emerald-500/10 scale-110'
                                                        : isCurrent
                                                            ? 'border-[#004ac6] text-[#004ac6] animate-pulse scale-110 shadow-xl shadow-blue-500/10'
                                                            : 'border-zinc-100 text-zinc-100 grayscale opacity-40'
                                                        }`}>
                                                        {isDone ? <CheckCircle2 size={20} strokeWidth={3} /> : <S.icon size={20} strokeWidth={2.5} />}
                                                    </div>
                                                    <span className={`text-[10px] font-black uppercase tracking-[0.15em] transition-all duration-500 ${isDone ? 'text-zinc-900 opacity-100' : 'text-zinc-200 opacity-50'}`}>
                                                        {S.name}
                                                    </span>

                                                    {/* Intelligent Data Tooltip */}
                                                    <div className="absolute -top-14 left-1/2 -translate-x-1/2 bg-zinc-900 text-white px-4 py-2 rounded-xl text-[9px] font-black tracking-[0.1em] uppercase opacity-0 group-hover/stage:opacity-100 transition-all pointer-events-none whitespace-nowrap shadow-2xl scale-90 group-hover/stage:scale-100 translate-y-2 group-hover/stage:translate-y-0">
                                                        {isDone ? `${S.name} Complete` : isCurrent ? `Processing ${S.name}...` : `Queue for ${S.name}`}
                                                        <div className="absolute bottom-[-4px] left-1/2 -translate-x-1/2 w-2 h-2 bg-zinc-900 rotate-45" />
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>

                                {/* Risk & Insight Section */}
                                <div className="lg:w-[22%] flex items-center justify-end gap-10 border-l border-zinc-50 pl-10 shrink-0">
                                    <div className="flex flex-col items-end">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-[10px] font-black text-zinc-300 uppercase tracking-widest">Global Risk</span>
                                        </div>
                                        <div className={`px-5 py-2 rounded-2xl text-[11px] font-black uppercase tracking-widest text-white shadow-xl ${isHigh ? 'bg-red-500 shadow-red-500/20' : isMedium ? 'bg-amber-500 shadow-amber-500/20' : 'bg-emerald-500 shadow-emerald-500/20'
                                            }`}>
                                            {c.risk_level}
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => navigate(`/customer/${c.customer_id}`)}
                                        className="w-16 h-16 bg-zinc-50 rounded-[1.75rem] flex items-center justify-center text-zinc-400 hover:bg-[#004ac6] hover:text-white transition-all hover:scale-110 active:scale-95 border border-zinc-100 group/btn shadow-sm"
                                    >
                                        <ArrowUpRight size={26} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                                    </button>
                                </div>
                            </div>
                        )
                    })
                )}
            </div>

            {/* Glossy Visual Legend */}
            <div className="fixed bottom-12 left-1/2 -translate-x-1/2 px-12 py-5 glass-card rounded-[2.5rem] flex items-center gap-10 z-50 animate-fade-in-up border border-white/40 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.1)]">
                <div className="flex items-center gap-3.5">
                    <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/20" />
                    <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Stage Verified</span>
                </div>
                <div className="flex items-center gap-3.5">
                    <div className="w-3 h-3 rounded-full bg-[#004ac6] shadow-lg shadow-blue-500/20" />
                    <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Current Stream</span>
                </div>
                <div className="flex items-center gap-3.5">
                    <div className="w-3 h-3 rounded-full bg-red-500 shadow-lg shadow-red-500/20" />
                    <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Alert Status</span>
                </div>
            </div>
        </div>
    )
}
