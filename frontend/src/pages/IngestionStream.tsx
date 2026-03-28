import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveFeed } from '../context/LiveFeedContext'
import { api } from '../api/client'
import type { PipelineDetails, ShapFactor } from '../types'
import {
    Database,
    Shield,
    Activity,
    Phone,
    Zap,
    CheckCircle2,
    ArrowUpRight,
    Cpu,
    ChevronDown,
    ChevronUp,
    AlertTriangle,
    TrendingUp,
    TrendingDown,
    Brain,
    MessageSquare,
    XCircle,
    Sparkles
} from 'lucide-react'

/* ─── Inline Sub-components ─── */

function RiskBadge({ level, score }: { level: string; score?: number }) {
    const cfg: Record<string, { bg: string; text: string; glow: string; ring: string }> = {
        HIGH: { bg: 'bg-red-500', text: 'text-white', glow: 'shadow-red-500/30', ring: 'ring-red-200' },
        MEDIUM: { bg: 'bg-amber-500', text: 'text-white', glow: 'shadow-amber-500/30', ring: 'ring-amber-200' },
        LOW: { bg: 'bg-emerald-500', text: 'text-white', glow: 'shadow-emerald-500/30', ring: 'ring-emerald-200' },
    }
    const c = cfg[level?.toUpperCase()] || cfg.LOW
    return (
        <div className={`animate-scale-pop px-5 py-2.5 rounded-2xl ${c.bg} ${c.text} shadow-xl ${c.glow} ring-2 ${c.ring} text-[11px] font-black uppercase tracking-widest flex items-center gap-2`}>
            <Shield size={14} strokeWidth={3} />
            {score != null ? `${(score * 100).toFixed(1)}%` : level}
        </div>
    )
}

function ActionBadge({ action }: { action?: string }) {
    if (!action) return null
    const iconMap: Record<string, string> = {
        'voice_outreach': '📞',
        'whatsapp_nudge': '💬',
        'email_alert': '📧',
        'restructure_offer': '🔄',
    }
    return (
        <div className="animate-scale-pop px-4 py-2 rounded-xl bg-[#004ac6]/10 text-[#004ac6] text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border border-[#004ac6]/20">
            <span>{iconMap[action] || '⚡'}</span>
            {action.replace(/_/g, ' ')}
        </div>
    )
}

function PipelineStep({ status, label, icon: Icon, isHardStop }: {
    status: 'done' | 'active' | 'pending' | 'failed'
    label: string
    icon: React.ComponentType<{ size?: number; strokeWidth?: number }>
    isHardStop?: boolean
}) {
    const styles = {
        done: 'border-emerald-500 text-emerald-500 shadow-xl shadow-emerald-500/10 scale-110',
        active: `border-[#004ac6] text-[#004ac6] scale-110 animate-glow-pulse`,
        pending: 'border-zinc-200 text-zinc-300',
        failed: 'border-red-600 text-red-600 shadow-xl shadow-red-500/20 animate-glow-pulse-red scale-110',
    }
    return (
        <div className="flex flex-col items-center gap-3 relative z-10">
            <div className={`w-14 h-14 rounded-2xl bg-white border-2 flex items-center justify-center transition-all duration-700 ${styles[status]}`}>
                {status === 'done' ? <CheckCircle2 size={22} strokeWidth={3} /> :
                    status === 'failed' ? <XCircle size={22} strokeWidth={3} /> :
                        <Icon size={22} strokeWidth={2.5} />}
            </div>
            <span className={`text-[10px] font-black uppercase tracking-[0.15em] transition-all ${status === 'pending' ? 'text-zinc-300' : 'text-zinc-800'}`}>
                {label}
            </span>
            {isHardStop && status === 'failed' && (
                <span className="text-[8px] font-black text-red-600 uppercase tracking-widest">BLOCKED</span>
            )}
        </div>
    )
}

function FactorChip({ factor }: { factor: ShapFactor }) {
    const isRisk = factor.direction === 'increases_risk'
    return (
        <div className={`animate-scale-pop flex items-center gap-3 px-5 py-3 rounded-2xl border transition-all ${isRisk
            ? 'bg-red-50/80 border-red-100 text-red-700'
            : 'bg-emerald-50/80 border-emerald-100 text-emerald-700'
            }`}>
            {isRisk
                ? <TrendingUp size={16} strokeWidth={3} className="text-red-500" />
                : <TrendingDown size={16} strokeWidth={3} className="text-emerald-500" />
            }
            <span className="text-[11px] font-bold tracking-tight">{factor.feature.replace(/_/g, ' ')}</span>
            <span className={`text-[10px] font-black ml-auto ${isRisk ? 'text-red-500' : 'text-emerald-500'}`}>
                {isRisk ? '+' : '-'}{Math.abs(factor.contribution).toFixed(3)}
            </span>
        </div>
    )
}

function ModelBar({ label, value, color }: { label: string; value?: number; color: string }) {
    const pct = value != null ? value * 100 : 0
    return (
        <div className="flex-1">
            <div className="flex justify-between items-baseline mb-2">
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{label}</span>
                <span className="text-lg font-black text-zinc-950 tabular-nums">{pct.toFixed(1)}%</span>
            </div>
            <div className="h-3 bg-zinc-100 rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full animate-bar-fill ${color}`}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                />
            </div>
        </div>
    )
}

function SeverityDot({ level }: { level?: string }) {
    const colors: Record<string, string> = {
        high: 'bg-red-500',
        medium: 'bg-amber-500',
        low: 'bg-emerald-500',
        critical: 'bg-red-700',
    }
    const c = colors[level?.toLowerCase() || 'low'] || 'bg-zinc-300'
    return (
        <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${c}`} />
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{level || 'N/A'}</span>
        </div>
    )
}

function generateDecisionSummary(details: PipelineDetails): string {
    const topFactor = details.top_factors?.[0]
    const stressType = details.stress_context?.stress_type
    const method = details.intervention?.method

    const parts: string[] = []
    if (topFactor) {
        const dir = topFactor.direction === 'increases_risk' ? 'elevated' : 'reduced'
        parts.push(`${topFactor.feature.replace(/_/g, ' ')} ${dir}`)
    }
    if (stressType) parts.push(stressType.replace(/_/g, ' '))
    const cause = parts.length > 0 ? parts.join(' + ') : 'behavioral signals detected'
    const action = method ? method.replace(/_/g, ' ') : 'monitoring'

    return `Risk driven by ${cause} → ${action} triggered`
}

/* ─── Main Component ─── */

export default function IngestionStream() {
    const navigate = useNavigate()
    const { connected: contextConnected, pipelineDetails } = useLiveFeed()
    const [isSimulating, setIsSimulating] = useState(false)
    const [debugExpanded, setDebugExpanded] = useState(false)

    // SSE-driven live state
    const [activeCustomerId, setActiveCustomerId] = useState<string | null>(null)
    const [activeCustomerStages, setActiveCustomerStages] = useState<any[]>([])
    const [stats, setStats] = useState({ totalRecords: 0, detectedRisk: 0 })

    useEffect(() => {
        const es = new EventSource('/api/stream')

        es.onmessage = (e) => {
            try {
                const event = JSON.parse(e.data)

                if (event.customers) {
                    setStats({
                        totalRecords: event.total_events || 0,
                        detectedRisk: event.customers.filter((c: any) => c.risk_level === 'High').length,
                    })
                    return
                }

                if (event.stage === 'CUSTOMER_DONE') {
                    setActiveCustomerId(null)
                    setActiveCustomerStages([])
                    return
                }

                if (event.stage === 'SKIPPED') return

                setActiveCustomerId(prevId => {
                    if (event.customer_id !== prevId) {
                        setActiveCustomerStages([event])
                        return event.customer_id
                    } else {
                        setActiveCustomerStages(prev => [...prev, event])
                        return prevId
                    }
                })

                if (event.stage === 'OUTREACH' && event.global_risk === 'HIGH') {
                    setStats(prev => ({ ...prev, detectedRisk: prev.detectedRisk + 1 }))
                }
            } catch (err) {
                console.error('SSE Error:', err)
            }
        }

        return () => es.close()
    }, [])

    const stagesDef = [
        { name: 'INGEST', icon: Database },
        { name: 'SCORE', icon: Shield },
        { name: 'ANALYSE', icon: Activity },
        { name: 'OUTREACH', icon: Phone },
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

    const getProgress = (stages: any[]) => {
        if (stages.some(s => s.stage === 'OUTREACH')) return 4
        if (stages.some(s => s.stage === 'ANALYSE')) return 3
        if (stages.some(s => s.stage === 'SCORE')) return 2
        if (stages.some(s => s.stage === 'INGEST' || s.stage === 'INGEST_TRIGGERED')) return 1
        return 0
    }

    const latestEvent = activeCustomerStages[activeCustomerStages.length - 1]
    const riskLevel = latestEvent?.global_risk || 'LOW'
    const progress = getProgress(activeCustomerStages)
    const isHigh = riskLevel === 'HIGH'

    // Get pipeline details for active customer
    const details: PipelineDetails | null = activeCustomerId ? pipelineDetails[activeCustomerId] || null : null
    const hasHardStop = details?.compliance?.hard_stop === true

    return (
        <div className="animate-fade-in pb-32 max-w-[1400px] mx-auto px-6 font-sans text-zinc-900 leading-tight">

            {/* ══════════════════════════════════════════════════════════════
                SECTION 1: HEADER
            ══════════════════════════════════════════════════════════════ */}
            <div className="pt-16 mb-12 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2.5 ${contextConnected ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
                            <span className={`w-2.5 h-2.5 rounded-full ${contextConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                            {contextConnected ? 'Network Active' : 'Disconnected'}
                        </div>
                        <div className="px-4 py-1.5 rounded-full bg-zinc-900 text-zinc-400 border border-zinc-800 text-[10px] font-black uppercase tracking-widest">
                            {stats.totalRecords.toLocaleString()} Records
                        </div>
                        {stats.detectedRisk > 0 && (
                            <div className="px-4 py-1.5 rounded-full bg-red-500 text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-2 animate-scale-pop shadow-lg shadow-red-500/20">
                                <AlertTriangle size={12} strokeWidth={3} />
                                {stats.detectedRisk} High Risk
                            </div>
                        )}
                    </div>
                    <h1 className="text-6xl font-black tracking-tight text-zinc-950 leading-none">
                        Real-time <span className="text-[#004ac6]">Live Feed</span>
                    </h1>
                    <p className="text-sm text-zinc-400 font-medium">Barclays Pre-Delinquency Intelligence Pipeline</p>
                </div>

                <button
                    onClick={handleStartSimulation}
                    disabled={isSimulating}
                    className={`group flex items-center gap-4 h-16 px-12 rounded-2xl text-xs font-black tracking-[0.2em] uppercase transition-all overflow-hidden relative ${isSimulating
                        ? 'bg-zinc-100 text-zinc-400 cursor-not-allowed'
                        : 'bg-[#004ac6] text-white hover:bg-zinc-950 active:scale-95 shadow-2xl shadow-blue-600/30 hover:shadow-zinc-950/30'}`}
                >
                    <Zap fill={isSimulating ? 'none' : 'currentColor'} size={18} className={isSimulating ? 'animate-pulse' : 'group-hover:rotate-12 transition-all'} />
                    {isSimulating ? 'Processing...' : 'Stream Data'}
                </button>
            </div>

            {/* ══════════════════════════════════════════════════════════════
                EMPTY STATE
            ══════════════════════════════════════════════════════════════ */}
            {!activeCustomerId ? (
                <div className="py-48 bg-zinc-50/50 rounded-[4rem] border border-dashed border-zinc-200 flex flex-col items-center justify-center text-center">
                    <div className="w-24 h-24 bg-white rounded-[2.5rem] flex items-center justify-center mb-8 border border-zinc-100 shadow-xl shadow-zinc-200/50">
                        <Cpu size={40} className="text-zinc-200 animate-pulse" />
                    </div>
                    <h3 className="text-xl font-black text-zinc-300 uppercase tracking-[0.3em] mb-4">No Live Events Yet</h3>
                    <p className="text-zinc-400 font-medium max-w-sm px-10 leading-relaxed">
                        Start the stream to begin processing real-time customer behavioral signals.
                    </p>
                </div>
            ) : (
                <div className="space-y-8 animate-slide-in-card">

                    {/* ══════════════════════════════════════════════════════════════
                        SECTION 1.5: CUSTOMER IDENTITY + BADGES
                    ══════════════════════════════════════════════════════════════ */}
                    <div className="bg-white rounded-[2.5rem] p-8 border border-zinc-100 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-6">
                                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all shadow-sm ${isHigh ? 'bg-red-50 text-red-500' : 'bg-zinc-50 text-zinc-400'}`}>
                                    <Database size={24} />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black tracking-tight text-zinc-950">{activeCustomerId}</h2>
                                    <p className="text-sm text-zinc-400 font-medium mt-1">Week {latestEvent?.week || '—'} • {latestEvent?.archetype || 'Processing...'}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <RiskBadge level={riskLevel} score={latestEvent?.risk_score} />
                                {details && <ActionBadge action={details.intervention?.method} />}
                            </div>
                        </div>
                    </div>

                    {/* ══════════════════════════════════════════════════════════════
                        SECTION 2: PIPELINE TIMELINE
                    ══════════════════════════════════════════════════════════════ */}
                    <div className="bg-white rounded-[2.5rem] p-10 border border-zinc-100 shadow-sm">
                        <div className="flex items-center justify-between w-full max-w-3xl mx-auto relative px-4">
                            {/* Background track */}
                            <div className="absolute inset-x-8 top-7 h-1 bg-zinc-100 -z-0 rounded-full" />
                            {/* Progress fill */}
                            <div
                                className={`absolute left-8 top-7 h-1 transition-all duration-1000 ease-out rounded-full -z-0 ${hasHardStop ? 'bg-red-500/40' : isHigh ? 'bg-red-500/30' : 'bg-emerald-500/30'}`}
                                style={{ width: `${((Math.max(progress, 1) - 1) / (stagesDef.length - 1)) * 92}%` }}
                            />

                            {stagesDef.map((S, si) => {
                                const stepIdx = si + 1
                                const isDone = stepIdx < progress
                                const isCurrent = stepIdx === progress
                                const isPending = stepIdx > progress
                                const isFailed = S.name === 'OUTREACH' && hasHardStop && (isDone || isCurrent)

                                let status: 'done' | 'active' | 'pending' | 'failed' = 'pending'
                                if (isFailed) status = 'failed'
                                else if (isDone) status = 'done'
                                else if (isCurrent) status = 'active'

                                return (
                                    <PipelineStep
                                        key={si}
                                        status={status}
                                        label={S.name}
                                        icon={S.icon}
                                        isHardStop={hasHardStop}
                                    />
                                )
                            })}
                        </div>
                    </div>

                    {/* ══════════════════════════════════════════════════════════════
                        SECTION 3: DECISION SUMMARY LINE (wow factor)
                    ══════════════════════════════════════════════════════════════ */}
                    {details && (
                        <div className={`rounded-2xl px-8 py-5 flex items-center gap-4 animate-scale-pop ${isHigh
                            ? 'bg-red-50 border border-red-100 text-red-800'
                            : 'bg-[#004ac6]/5 border border-[#004ac6]/10 text-[#004ac6]'
                            }`}>
                            <Sparkles size={18} strokeWidth={2.5} className="shrink-0" />
                            <p className="text-sm font-bold tracking-tight leading-snug">
                                {generateDecisionSummary(details)}
                            </p>
                        </div>
                    )}

                    {/* ══════════════════════════════════════════════════════════════
                        SECTION 4+5: WHY THIS HAPPENED + MODEL INSIGHT (side-by-side)
                    ══════════════════════════════════════════════════════════════ */}
                    {details && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                            {/* WHY THIS HAPPENED */}
                            <div className="bg-white rounded-[2.5rem] p-8 border border-zinc-100 shadow-sm">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-10 h-10 rounded-xl bg-zinc-50 flex items-center justify-center">
                                        <Brain size={20} className="text-zinc-400" />
                                    </div>
                                    <h3 className="text-sm font-black text-zinc-900 uppercase tracking-widest">Why This Happened</h3>
                                </div>

                                {details.top_factors && details.top_factors.length > 0 ? (
                                    <div className="space-y-3">
                                        {details.top_factors.slice(0, 3).map((f, i) => (
                                            <FactorChip key={i} factor={f} />
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-zinc-400 italic">Awaiting SHAP analysis...</p>
                                )}
                            </div>

                            {/* MODEL INSIGHT */}
                            <div className="bg-white rounded-[2.5rem] p-8 border border-zinc-100 shadow-sm">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-10 h-10 rounded-xl bg-zinc-50 flex items-center justify-center">
                                        <Activity size={20} className="text-zinc-400" />
                                    </div>
                                    <h3 className="text-sm font-black text-zinc-900 uppercase tracking-widest">Model Insight</h3>
                                </div>

                                <div className="space-y-5">
                                    <ModelBar label="LightGBM" value={details.lgb_p} color="bg-[#004ac6]" />
                                    <ModelBar label="GRU Neural" value={details.gru_p} color="bg-purple-500" />
                                    <div className="pt-4 border-t border-zinc-100 flex justify-between items-baseline">
                                        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Ensemble Score</span>
                                        <span className={`text-3xl font-black tabular-nums ${(details.ensemble_score || 0) >= 0.5 ? 'text-red-500' : 'text-zinc-950'}`}>
                                            {details.ensemble_score != null ? `${(details.ensemble_score * 100).toFixed(1)}%` : '—'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ══════════════════════════════════════════════════════════════
                        SECTION 6: STRESS CONTEXT NARRATIVE + INTERVENTION (side-by-side)
                    ══════════════════════════════════════════════════════════════ */}
                    {details && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                            {/* STRESS CONTEXT */}
                            {details.stress_context && details.stress_context.narrative ? (
                                <div className="bg-white rounded-[2.5rem] p-8 border border-zinc-100 shadow-sm">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                                            <AlertTriangle size={20} className="text-amber-500" />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-black text-zinc-900 uppercase tracking-widest">Stress Context</h3>
                                            <SeverityDot level={details.stress_context.severity} />
                                        </div>
                                    </div>
                                    <p className="text-[13px] text-zinc-700 font-medium leading-relaxed mb-5">
                                        {details.stress_context.narrative}
                                    </p>
                                    <div className="flex items-center gap-2">
                                        {details.stress_context.stress_type && (
                                            <span className="px-3 py-1.5 rounded-xl bg-amber-50 text-amber-700 text-[10px] font-black uppercase tracking-widest border border-amber-100">
                                                {details.stress_context.stress_type.replace(/_/g, ' ')}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-white rounded-[2.5rem] p-8 border border-zinc-100 shadow-sm flex items-center justify-center">
                                    <p className="text-sm text-zinc-300 italic">Stress analysis pending...</p>
                                </div>
                            )}

                            {/* INTERVENTION DECISION */}
                            <div className={`rounded-[2.5rem] p-8 border shadow-sm ${hasHardStop
                                ? 'bg-red-50/50 border-red-200'
                                : 'bg-white border-zinc-100'
                                }`}>
                                <div className="flex items-center gap-3 mb-6">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${hasHardStop ? 'bg-red-100' : 'bg-[#004ac6]/10'}`}>
                                        <MessageSquare size={20} className={hasHardStop ? 'text-red-600' : 'text-[#004ac6]'} />
                                    </div>
                                    <h3 className="text-sm font-black text-zinc-900 uppercase tracking-widest">Intervention Decision</h3>
                                </div>

                                {/* Hard stop alert */}
                                {hasHardStop && (
                                    <div className="mb-5 px-5 py-4 rounded-2xl bg-red-600 text-white flex items-center gap-3 animate-scale-pop shadow-lg shadow-red-600/30">
                                        <XCircle size={18} strokeWidth={3} />
                                        <div>
                                            <div className="text-[10px] font-black uppercase tracking-widest opacity-70">Hard Stop</div>
                                            <div className="text-sm font-bold">{details?.compliance?.hard_stop_reason || 'Compliance block active'}</div>
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-4">
                                    <div>
                                        <div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1.5">Method</div>
                                        <div className="text-lg font-black text-zinc-950">
                                            {details?.intervention?.method?.replace(/_/g, ' ') || '—'}
                                        </div>
                                    </div>
                                    {details?.intervention?.justification && (
                                        <div>
                                            <div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1.5">Justification</div>
                                            <p className="text-[13px] text-zinc-600 font-medium leading-relaxed">
                                                {details.intervention.justification}
                                            </p>
                                        </div>
                                    )}
                                    {details?.intervention?.channel && (
                                        <div className="pt-3 border-t border-zinc-100">
                                            <span className="px-3 py-1.5 rounded-xl bg-zinc-100 text-zinc-600 text-[10px] font-black uppercase tracking-widest">
                                                Channel: {details.intervention.channel}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ══════════════════════════════════════════════════════════════
                        SECTION 7: EXPANDABLE DEBUG (full pipeline details)
                    ══════════════════════════════════════════════════════════════ */}
                    {details && (
                        <div className="bg-white rounded-[2.5rem] border border-zinc-100 shadow-sm overflow-hidden">
                            <button
                                onClick={() => setDebugExpanded(!debugExpanded)}
                                className="w-full flex items-center justify-between px-8 py-5 text-xs font-black uppercase tracking-widest text-zinc-400 hover:text-zinc-900 transition-colors hover:bg-zinc-50/50"
                            >
                                <span>Full Pipeline Details</span>
                                {debugExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                            {debugExpanded && (
                                <div className="px-8 pb-8 animate-fade-in">
                                    <pre className="bg-zinc-950 text-emerald-400 p-6 rounded-2xl text-xs font-mono overflow-auto max-h-[400px] leading-relaxed">
                                        {JSON.stringify(details, null, 2)}
                                    </pre>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Navigate button */}
                    <div className="flex items-center gap-4 justify-end">
                        <button
                            onClick={() => navigate(`/journey/${activeCustomerId}`)}
                            className="flex items-center gap-3 h-14 px-8 bg-zinc-950 text-white rounded-2xl text-[10px] font-bold tracking-[.15em] uppercase hover:bg-[#004ac6] transition-all active:scale-95 shadow-xl"
                        >
                            Watch Full Journey
                            <ArrowUpRight size={16} strokeWidth={3} />
                        </button>
                        <button
                            onClick={() => navigate(`/customer/${activeCustomerId}`)}
                            className="h-14 px-8 bg-zinc-50 text-zinc-500 rounded-2xl text-[10px] font-bold tracking-[.15em] uppercase hover:bg-zinc-950 hover:text-white transition-all border border-zinc-100"
                        >
                            View Profile
                        </button>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                FLOATING LEGEND
            ══════════════════════════════════════════════════════════════ */}
            <div className="fixed bottom-10 left-1/2 -translate-x-1/2 px-10 py-4 glass-card rounded-[2rem] flex items-center gap-8 z-50 animate-fade-in-up border border-white/40 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.1)]">
                <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/20" />
                    <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Complete</span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-[#004ac6] shadow-lg shadow-blue-500/20 animate-pulse" />
                    <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Processing</span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-red-500 shadow-lg shadow-red-500/20" />
                    <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Hard Stop</span>
                </div>
            </div>
        </div>
    )
}
