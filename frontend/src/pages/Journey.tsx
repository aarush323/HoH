import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ChevronLeft,
    BrainCircuit,
    Microscope,
    UserCheck,
    MessageSquare,
    Play,
} from 'lucide-react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer
} from 'recharts';
import type {
    JourneyEvent,
    JourneyCustomerEvent,
    JourneyWeekEvent,
    JourneyInterventionEvent,
    JourneyCompleteEvent,
    ShapFactor,
} from '../types';

interface ChartPoint {
    week: number;
    lgb: number;
    gru: number;
    ensemble: number;
    risk_level: string;
    threshold_crossed: boolean;
}

interface AgentCard {
    id: number;
    name: string;
    icon: React.ReactNode;
    color: string;
    desc: string;
}

export default function Journey() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [customerName, setCustomerName] = useState<string>('');
    const [chartData, setChartData] = useState<ChartPoint[]>([]);
    const [currentWeek, setCurrentWeek] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [hasStarted, setHasStarted] = useState(false);
    const [showAgents, setShowAgents] = useState(false);
    const [streaming, setStreaming] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [reconnecting, setReconnecting] = useState(false);
    const [interventionData, setInterventionData] = useState<JourneyInterventionEvent | null>(null);
    const [topFactor, setTopFactor] = useState<ShapFactor | null>(null);
    const [allFactors, setAllFactors] = useState<ShapFactor[]>([]);
    const [latestScores, setLatestScores] = useState<{ lgb: number, gru: number, ensemble: number } | null>(null);

    const esRef = useRef<EventSource | null>(null);
    const playTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const maxWeekRef = useRef(0);

    const connectSSE = () => {
        if (!id) return;

        if (esRef.current) {
            esRef.current.close();
        }
        if (playTimerRef.current) {
            clearTimeout(playTimerRef.current);
        }

        const es = new EventSource(`/api/journey-stream/${id}`);
        esRef.current = es;
        setStreaming(true);

        es.onmessage = (e) => {
            const raw = JSON.parse(e.data);
            const event: JourneyEvent = raw;

            if (event.type === 'ping') {
                return;
            }

            setReconnecting(false);
            setError(null);

            switch (event.type) {
                case 'customer': {
                    const ce = event as JourneyCustomerEvent;
                    const name = ce.data?.customer?.name;
                    if (name) setCustomerName(name);
                    break;
                }
                case 'week': {
                    const we = event as JourneyWeekEvent;
                    const point: ChartPoint = {
                        week: we.week_number,
                        lgb: we.lgb_p,
                        gru: we.gru_p,
                        ensemble: we.score,
                        risk_level: we.risk_level,
                        threshold_crossed: we.threshold_crossed,
                    };
                    setChartData(prev => {
                        const alreadyHave = prev.some(p => p.week === we.week_number);
                        if (alreadyHave) return prev;
                        return [...prev, point].sort((a, b) => a.week - b.week);
                    });
                    if (we.shap_factors && we.shap_factors.length > 0) {
                        setTopFactor(we.shap_factors[0]);
                        setAllFactors(we.shap_factors);
                    }
                    setLatestScores({ lgb: we.lgb_p, gru: we.gru_p, ensemble: we.score });
                    maxWeekRef.current = Math.max(maxWeekRef.current, we.week_number);
                    if (isPlaying) {
                        setCurrentWeek(prev => Math.max(prev, we.week_number));
                    }
                    break;
                }
                case 'intervention': {
                    const ie = event as JourneyInterventionEvent;
                    setInterventionData(ie);
                    setShowAgents(true);
                    break;
                }
                case 'complete': {
                    const ce = event as JourneyCompleteEvent;
                    setStreaming(false);
                    setIsPlaying(false);
                    if (!ce.triggered) {
                        setShowAgents(false);
                    }
                    break;
                }
                case 'error': {
                    setError(event.message);
                    setStreaming(false);
                    break;
                }
                default:
                    break;
            }
        };

        es.onerror = () => {
            console.error("SSE Connection loss. Attempting reconnection...");
            setReconnecting(true);
            es.close();
            // Optional: Add simple retry delay
            setTimeout(() => {
                if (streaming) connectSSE();
            }, 3000);
        };
    };

    useEffect(() => {
        if (!hasStarted) return;
        connectSSE();
        return () => {
            if (esRef.current) {
                esRef.current.close();
                esRef.current = null;
            }
            if (playTimerRef.current) {
                clearTimeout(playTimerRef.current);
            }
        };
    }, [id, hasStarted]);

    useEffect(() => {
        if (!isPlaying) return;

        if (currentWeek < maxWeekRef.current) {
            playTimerRef.current = setTimeout(() => {
                setCurrentWeek(prev => prev + 1);
            }, 800);
        } else {
            setIsPlaying(false);
            if (interventionData) {
                setTimeout(() => setShowAgents(true), 1000);
            }
        }
        return () => {
            if (playTimerRef.current) clearTimeout(playTimerRef.current);
        };
    }, [isPlaying, currentWeek, interventionData]);

    const handleStartJourney = () => {
        setHasStarted(true);
        setChartData([]);
        setCurrentWeek(0);
        setShowAgents(false);
        setInterventionData(null);
        maxWeekRef.current = 0;
        setError(null);
        setIsPlaying(true);
    };

    const currentData = chartData.filter(d => d.week <= currentWeek);
    const latestPoint = chartData[chartData.length - 1];
    const latestRisk = latestPoint ? (latestPoint.ensemble * 100).toFixed(1) : '--';
    const latestLevel = latestPoint?.risk_level || '--';

    const agentCards: AgentCard[] = [
        {
            id: 1,
            name: "Data Analyst",
            icon: <Microscope size={18} />,
            color: "text-amber-500",
            desc: topFactor
                ? `Detected ${topFactor.feature.replace(/_/g, ' ')} as primary risk driver.`
                : "Analysing structural risk patterns across weekly features.",
        },
        {
            id: 2,
            name: "Compliance Bot",
            icon: <BrainCircuit size={18} />,
            color: "text-indigo-500",
            desc: interventionData?.hard_stop
                ? `Hard stop triggered: ${interventionData.hard_stop_reason || 'Compliance boundary reached.'}`
                : "Verified eligible for proactive outreach. All compliance gates passed.",
        },
        {
            id: 3,
            name: "Voice Strategist",
            icon: <MessageSquare size={18} />,
            color: "text-emerald-500",
            desc: interventionData
                ? `${interventionData.channel === 'voice' ? 'Voice' : interventionData.channel} channel selected. Message: "${interventionData.message?.slice(0, 80)}..."`
                : "Evaluating optimal intervention channel based on risk profile.",
        },
    ];

    if (error) {
        return (
            <div className="min-h-screen bg-zinc-950 text-white p-12 flex flex-col items-center justify-center gap-8">
                <div className="text-red-400 text-2xl font-black uppercase tracking-widest">{error}</div>
                <button
                    onClick={() => navigate('/portfolio')}
                    className="px-8 py-4 bg-zinc-800 text-white rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-zinc-700 transition-all"
                >
                    Return to Customer Dashboard
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-950 text-white p-12 animate-fade-in-up font-sans selection:bg-indigo-500/30">

            {/* Cinematic Header */}
            <div className="flex items-center gap-10 mb-20 max-w-7xl mx-auto">
                <button
                    onClick={() => navigate('/portfolio')}
                    className="w-14 h-14 rounded-2xl bg-zinc-900 flex items-center justify-center hover:bg-zinc-800 transition-all border border-zinc-800 active:scale-90"
                >
                    <ChevronLeft size={24} />
                </button>
                <div className="space-y-1">
                    <h1 className="text-4xl font-black tracking-tighter uppercase whitespace-nowrap leading-none">
                        ML Journey
                    </h1>
                    <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-[.25em]">
                        {customerName ? `${customerName} — ` : ''}Customer ID: {id}
                    </p>
                </div>
                {hasStarted && (
                    <div className="ml-auto flex items-center gap-3">
                        {reconnecting ? (
                            <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/30 rounded-full text-[10px] font-black uppercase tracking-widest text-amber-400">
                                <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                                Reconnecting...
                            </div>
                        ) : streaming ? (
                            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-[10px] font-black uppercase tracking-widest text-emerald-400">
                                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                Running ML
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-full text-[10px] font-black uppercase tracking-widest text-zinc-400">
                                <div className="w-2 h-2 rounded-full bg-zinc-500" />
                                Complete
                            </div>
                        )}
                        <div className="text-[10px] font-black uppercase tracking-widest text-zinc-600">
                            Week {currentWeek}/{maxWeekRef.current || '?'}
                        </div>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 max-w-7xl mx-auto items-start">

                {/* Stage 1: The Model Battle Theater */}
                <div className="lg:col-span-8 space-y-10">
                    <div className="bg-zinc-900/50 rounded-[2.5rem] border border-zinc-800/50 p-12 relative overflow-hidden group shadow-2xl">

                        {!hasStarted ? (
                            <div className="flex flex-col items-center justify-center h-[500px] gap-8">
                                <div className="w-20 h-20 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700">
                                    <Play size={36} className="text-white ml-1" />
                                </div>
                                <div className="text-center space-y-3">
                                    <h2 className="text-2xl font-black uppercase tracking-widest">Ready to Replay</h2>
                                    <p className="text-zinc-500 text-sm font-medium max-w-md">
                                        Watch real ML inference run week-by-week on this customer&apos;s historical data.
                                        LightGBM, GRU, and Ensemble models will score each week.
                                    </p>
                                </div>
                                <button
                                    onClick={handleStartJourney}
                                    className="px-10 py-4 bg-white text-zinc-950 rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-indigo-500 hover:text-white transition-all active:scale-95 shadow-2xl"
                                >
                                    Start ML Journey
                                </button>
                            </div>
                        ) : (
                            <>
                                <div className="flex justify-between items-center mb-12">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-2.5 h-2.5 rounded-full ${streaming ? 'bg-red-500 animate-pulse' : 'bg-zinc-600'}`} />
                                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 italic">Ensemble Live Battle Inference</span>
                                    </div>
                                    {isPlaying && (
                                        <button
                                            onClick={() => setIsPlaying(false)}
                                            className="px-6 py-2 bg-zinc-800 text-zinc-300 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-700 transition-all"
                                        >
                                            Pause
                                        </button>
                                    )}
                                </div>

                                {/* Live Risk Score */}
                                <div className="mb-8 flex items-end gap-4">
                                    <span className={`text-7xl font-black tracking-tighter tabular-nums ${latestLevel === 'High' ? 'text-red-400' : latestLevel === 'Medium' ? 'text-amber-400' : 'text-emerald-400'}`}>
                                        {latestRisk}%
                                    </span>
                                    <span className="text-sm font-black uppercase tracking-widest text-zinc-500 pb-3">
                                        {latestLevel} Risk
                                    </span>
                                </div>

                                <div className="h-[400px] w-full">
                                    {currentData.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={currentData}>
                                                <defs>
                                                    <linearGradient id="colorEnsemble" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                                    </linearGradient>
                                                    <linearGradient id="colorThreshold" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="0%" stopColor="#ef4444" stopOpacity={0.1} />
                                                        <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <XAxis dataKey="week" hide />
                                                <YAxis domain={[0, 1]} hide />
                                                <Tooltip
                                                    content={({ active, payload }) => {
                                                        if (active && payload && payload.length) {
                                                            const d = payload[0].payload as ChartPoint;
                                                            return (
                                                                <div className="bg-zinc-950 text-white p-4 rounded-xl text-[10px] font-bold border border-zinc-800 shadow-2xl space-y-1">
                                                                    <div className="uppercase tracking-widest text-zinc-400 mb-2">Week {d.week}</div>
                                                                    <div className="flex justify-between gap-8"><span className="text-white">Ensemble</span><span>{(d.ensemble * 100).toFixed(1)}%</span></div>
                                                                    <div className="flex justify-between gap-8"><span className="text-blue-400">LGB</span><span>{(d.lgb * 100).toFixed(1)}%</span></div>
                                                                    <div className="flex justify-between gap-8"><span className="text-purple-400">GRU</span><span>{(d.gru * 100).toFixed(1)}%</span></div>
                                                                    <div className={`mt-2 pt-2 border-t border-zinc-800 uppercase tracking-widest ${d.risk_level === 'High' ? 'text-red-400' : d.risk_level === 'Medium' ? 'text-amber-400' : 'text-emerald-400'}`}>
                                                                        {d.risk_level} Risk
                                                                    </div>
                                                                </div>
                                                            );
                                                        }
                                                        return null;
                                                    }}
                                                />
                                                <Area
                                                    type="monotone"
                                                    dataKey={() => 0.70}
                                                    stroke="#ef4444"
                                                    strokeWidth={1}
                                                    strokeDasharray="4 4"
                                                    fill="url(#colorThreshold)"
                                                    dot={false}
                                                />
                                                <Area
                                                    type="monotone"
                                                    dataKey="ensemble"
                                                    stroke="#fff"
                                                    strokeWidth={4}
                                                    fillOpacity={1}
                                                    fill="url(#colorEnsemble)"
                                                />
                                                <Area type="monotone" dataKey="lgb" stroke="#3b82f6" strokeWidth={1} strokeDasharray="5 5" fill="transparent" />
                                                <Area type="monotone" dataKey="gru" stroke="#a855f7" strokeWidth={1} strokeDasharray="5 5" fill="transparent" />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-zinc-600 text-sm font-black uppercase tracking-widest">
                                            Running ML inference...
                                        </div>
                                    )}
                                </div>

                                {/* Chart Legend */}
                                <div className="mt-8 flex gap-10 border-t border-zinc-800/50 pt-8">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-1 bg-white rounded-full" />
                                        <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Ensemble Master</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-1 bg-blue-500 rounded-full opacity-50" />
                                        <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">LightGBM (Tree)</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-1 bg-purple-500 rounded-full opacity-50" />
                                        <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">GRU (Neural)</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-1 bg-red-500 rounded-full opacity-30" style={{ borderTop: '1px dashed #ef4444' }} />
                                        <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">0.70 Threshold</span>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Stage 1.5: Live Decomposition (SHAP & Model Scores) */}
                    {hasStarted && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-10">
                            {/* Model Scores */}
                            <div className="p-8 bg-zinc-900 rounded-[2.5rem] border border-zinc-800/50 space-y-8">
                                <div className="flex items-center justify-between">
                                    <div className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">Model Consortium Status</div>
                                    <BrainCircuit size={16} className="text-indigo-500" />
                                </div>
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-3">
                                        <div className="text-[9px] font-black uppercase text-zinc-600">LightGBM (Tree)</div>
                                        <div className="text-3xl font-black tracking-tighter text-blue-400 tabular-nums">
                                            {latestScores ? `${(latestScores.lgb * 100).toFixed(1)}%` : '--'}
                                        </div>
                                        <div className="h-1 w-full bg-zinc-800 rounded-full overflow-hidden">
                                            <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${(latestScores?.lgb || 0) * 100}%` }} />
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="text-[9px] font-black uppercase text-zinc-600">GRU (RNN)</div>
                                        <div className="text-3xl font-black tracking-tighter text-purple-400 tabular-nums">
                                            {latestScores ? `${(latestScores.gru * 100).toFixed(1)}%` : '--'}
                                        </div>
                                        <div className="h-1 w-full bg-zinc-800 rounded-full overflow-hidden">
                                            <div className="h-full bg-purple-500 transition-all duration-500" style={{ width: `${(latestScores?.gru || 0) * 100}%` }} />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Risk Drivers (SHAP) */}
                            <div className="p-8 bg-zinc-900 rounded-[2.5rem] border border-zinc-800/50 space-y-6">
                                <div className="flex items-center justify-between">
                                    <div className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">Primary Risk Drivers</div>
                                    <Microscope size={16} className="text-amber-500" />
                                </div>
                                <div className="space-y-4">
                                    {(allFactors.length > 0 ? allFactors.slice(0, 3) : Array(3).fill(null)).map((f, i) => (
                                        <div key={i} className="space-y-1.5">
                                            <div className="flex justify-between items-center text-[9px] font-black uppercase">
                                                <span className="text-zinc-500">{f ? f.feature.replace(/_/g, ' ') : 'Analyzing...'}</span>
                                                <span className={f ? (f.contribution > 0 ? 'text-red-400' : 'text-emerald-400') : 'text-zinc-700'}>
                                                    {f ? `${f.contribution > 0 ? '+' : ''}${(f.contribution * 100).toFixed(1)}%` : '--'}
                                                </span>
                                            </div>
                                            <div className="h-1 w-full bg-zinc-800 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full transition-all duration-500 ${f ? (f.contribution > 0 ? 'bg-red-500' : 'bg-emerald-500') : 'bg-zinc-700'}`}
                                                    style={{ width: f ? `${Math.min(100, Math.abs(f.contribution) * 200)}%` : '0%' }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Stage 2: The Agent Chain Reaction */}
                <div className="lg:col-span-4 space-y-8">
                    <div className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-600 mb-4">Autonomous Chain Response</div>

                    <div className="space-y-6">
                        {agentCards.map((agent, i) => (
                            <div
                                key={agent.id}
                                className={`p-8 bg-zinc-900 rounded-[2rem] border border-zinc-800 transition-all duration-700 ${showAgents ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-12'}`}
                                style={{ transitionDelay: showAgents ? `${i * 300}ms` : '0ms' }}
                            >
                                <div className="flex items-center gap-4 mb-4">
                                    <div className={`w-10 h-10 bg-zinc-950 rounded-xl flex items-center justify-center ${agent.color}`}>
                                        {agent.icon}
                                    </div>
                                    <div className="text-[10px] font-black uppercase tracking-[0.2em]">{agent.name}</div>
                                </div>
                                <p className="text-[11px] font-bold text-zinc-500 tracking-tight leading-relaxed">{agent.desc}</p>
                            </div>
                        ))}
                    </div>

                    {showAgents && (
                        <div className="pt-10 animate-fade-in">
                            <button
                                onClick={() => navigate(`/customer/${id}`)}
                                className="w-full h-16 bg-white text-zinc-950 rounded-2xl text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-4 hover:bg-emerald-500 hover:text-white transition-all shadow-2xl shadow-white/5"
                            >
                                <UserCheck size={18} /> View Intervention Audit
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
