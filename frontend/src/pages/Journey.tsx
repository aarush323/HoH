import { useEffect, useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { LineChart, Line, XAxis, YAxis, ReferenceLine, ResponsiveContainer, CartesianGrid, Tooltip } from 'recharts';

type CustomerInfo = {
    customer_id: string;
    product_type: string;
    age: number;
};

type WeekLog = {
    week: number;
    score: number;
    risk_level: string;
    top_factor: string;
    top_factor_direction: string;
    top_factor_value: number;
    signals: Record<string, number>;
};

type InterventionLog = {
    method: string;
    channel: string;
    message: string;
    voice_outcome?: string;
    offer_accepted?: boolean;
    hard_stop: boolean;
    hard_stop_reason?: string;
};

type LogEntry =
    | { type: 'week'; data: WeekLog }
    | { type: 'intervention'; data: InterventionLog; week: number }
    | { type: 'complete'; triggered: boolean }
    | { type: 'error'; message: string };

type ChartData = { week: number; score: number; risk_level: string };

export default function Journey() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [customer, setCustomer] = useState<CustomerInfo | null>(null);

    const [status, setStatus] = useState<'idle' | 'playing' | 'intervening' | 'complete'>('idle');
    const [chartData, setChartData] = useState<ChartData[]>([]);
    const [logEntries, setLogEntries] = useState<LogEntry[]>([]);

    const [currentWeek, setCurrentWeek] = useState(0);
    const [totalWeeks, setTotalWeeks] = useState(12);

    const [keyDriver, setKeyDriver] = useState<any>(null);
    const [signals, setSignals] = useState<any>({});

    const [interventionResult, setInterventionResult] = useState<InterventionLog | null>(null);
    const [completionResult, setCompletionResult] = useState<{ triggered: boolean } | null>(null);

    const eventSourceRef = useRef<EventSource | null>(null);
    const logsEndRef = useRef<HTMLDivElement>(null);
    const chartContainerRef = useRef<HTMLDivElement>(null);

    // Auto-scroll logs
    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logEntries]);

    // Load customer initial info
    useEffect(() => {
        if (!id) return;
        api.getCustomer(id)
            .then((res) => {
                setCustomer({
                    customer_id: id as string,
                    product_type: res.customer.product_type,
                    age: res.customer.age || 0,
                });
                setTotalWeeks(res.weekly_history.length || 12);
            })
            .catch((err) => {
                setLogEntries([{ type: 'error', message: 'Failed to load customer profile' }]);
            });

        return () => {
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
            }
        };
    }, [id]);

    const startReplay = () => {
        if (!id) return;

        // Reset state
        setStatus('playing');
        setChartData([]);
        setLogEntries([]);
        setCurrentWeek(0);
        setKeyDriver(null);
        setSignals({});
        setInterventionResult(null);
        setCompletionResult(null);

        if (eventSourceRef.current) {
            eventSourceRef.current.close();
        }

        const es = new EventSource(`/api/journey-stream/${id}`);

        es.onmessage = (e) => {
            const data = JSON.parse(e.data);
            if (data.type === 'ping') return;

            if (data.type === 'week') {
                const pd = data as WeekLog;
                setChartData((prev) => [...prev, { week: pd.week, score: pd.score, risk_level: pd.risk_level }]);
                setCurrentWeek(pd.week);
                setKeyDriver({
                    name: data.top_factor?.replace(/_/g, ' ') || 'None',
                    value: data.top_factor_value,
                    direction: data.top_factor_direction,
                    contrib: data.shap_factors[0]?.contribution || 0
                });
                setSignals(data.signals);
                setLogEntries((prev) => [...prev, { type: 'week', data: pd }]);

                if (data.threshold_crossed) {
                    chartContainerRef.current?.classList.add('animate-flash-red');
                    setTimeout(() => chartContainerRef.current?.classList.remove('animate-flash-red'), 1000);
                }
            }
            else if (data.type === 'intervention') {
                setStatus('intervening');
                const intv = data as InterventionLog & { week: number };
                setInterventionResult(intv);
                setLogEntries((prev) => [...prev, { type: 'intervention', data: intv, week: intv.week }]);
            }
            else if (data.type === 'complete') {
                setStatus('complete');
                setCompletionResult({ triggered: data.triggered });
                setLogEntries((prev) => [...prev, { type: 'complete', triggered: data.triggered }]);
                es.close();
            }
            else if (data.type === 'error') {
                setStatus('idle');
                setLogEntries((prev) => [...prev, { type: 'error', message: data.message }]);
                es.close();
            }
        };

        es.onerror = () => {
            setStatus('idle');
            setLogEntries((prev) => [...prev, { type: 'error', message: 'Stream disconnected' }]);
            es.close();
        };

        eventSourceRef.current = es;
    };

    const getRiskColor = (score: number) => {
        if (score >= 0.70) return '#ef4444';
        if (score >= 0.40) return '#eab308';
        return '#22c55e';
    };

    const getRiskClass = (level: string) => {
        if (level === 'High') return 'text-red-400';
        if (level === 'Medium') return 'text-yellow-400';
        return 'text-green-400';
    };

    const latestScore = chartData.length > 0 ? chartData[chartData.length - 1].score : 0;
    const latestColor = getRiskColor(latestScore);

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 flex flex-col font-sans">
            <style>{`
        @keyframes flash-red {
          0% { background-color: rgba(239, 68, 68, 0.2); }
          100% { background-color: transparent; }
        }
        .animate-flash-red {
          animation: flash-red 1s ease-out;
        }
      `}</style>

            {/* --- TOP BAR --- */}
            <div className="h-16 border-b border-zinc-800 flex items-center justify-between px-6 shrink-0 bg-[#0a0a0a] z-10 w-full sticky top-0">
                <div className="flex items-center gap-4">
                    <select
                        value={id}
                        onChange={(e) => navigate(`/journey/${e.target.value}`)}
                        disabled={status === 'playing' || status === 'intervening'}
                        className="bg-transparent border border-zinc-700 text-xl font-mono font-bold tracking-tight px-2 py-1 rounded text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-500 hover:bg-zinc-800 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed appearance-none"
                    >
                        <option value="C00011" className="bg-zinc-900 text-base">C00011</option>
                        <option value="C00078" className="bg-zinc-900 text-base">C00078</option>
                        <option value="C00002" className="bg-zinc-900 text-base">C00002</option>
                    </select>
                    {customer && (
                        <>
                            <span className="px-2 py-1 bg-zinc-800 text-xs font-bold rounded uppercase tracking-widest text-zinc-300">{customer.product_type}</span>
                            <span className="text-sm font-medium text-zinc-500">{customer.age} years old</span>
                        </>
                    )}
                </div>

                <div className="hidden md:flex flex-col items-center">
                    <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Progress</span>
                    <span className="font-mono text-sm font-bold">WEEK {currentWeek} / {totalWeeks}</span>
                </div>

                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${status === 'idle' ? 'bg-zinc-600' :
                            status === 'playing' ? 'bg-green-500 animate-pulse' :
                                status === 'intervening' ? 'bg-red-500 animate-pulse' :
                                    'bg-green-500'
                            }`} />
                        <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">{status}</span>
                    </div>
                    <button
                        disabled={status === 'playing' || status === 'intervening'}
                        onClick={startReplay}
                        className="bg-zinc-100 text-zinc-900 px-5 py-2 rounded-full text-xs font-bold uppercase tracking-widest hover:bg-white active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {status === 'complete' || (status === 'idle' && chartData.length > 0) ? (
                            <>↺ Replay</>
                        ) : (
                            <>▶ Play Journey</>
                        )}
                    </button>
                </div>
            </div>

            {/* --- MAIN SPLIT --- */}
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                {/* LEFT PANEL */}
                <div className="w-full lg:w-[60%] border-r border-zinc-800 flex flex-col p-8 overflow-y-auto" ref={chartContainerRef}>
                    <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-6">Risk Score Timeline</h2>

                    <div className="h-[320px] w-full mb-12">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                                <XAxis
                                    dataKey="week"
                                    stroke="#71717a"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    padding={{ left: 20, right: 20 }}
                                />
                                <YAxis
                                    domain={[0, 1]}
                                    ticks={[0, 0.2, 0.4, 0.6, 0.8, 1.0]}
                                    stroke="#71717a"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }}
                                    itemStyle={{ color: '#e4e4e7' }}
                                />
                                <ReferenceLine y={0.70} stroke="#ef4444" strokeDasharray="4 4" label={{ position: 'right', value: 'Intervention Threshold', fill: '#ef4444', fontSize: 10, fontWeight: 'bold' }} />

                                <Line
                                    type="monotone"
                                    dataKey="score"
                                    stroke={latestColor}
                                    strokeWidth={3}
                                    dot={{ r: 4, strokeWidth: 2 }}
                                    activeDot={{ r: 6 }}
                                    isAnimationActive={true}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-6">This Week's Key Driver</h3>
                        {keyDriver ? (
                            <div className="flex items-center justify-between mb-8">
                                <div>
                                    <div className="text-xl font-bold capitalize text-zinc-100">{keyDriver.name}</div>
                                    <div className="text-sm text-zinc-500 font-mono mt-1">Value: {keyDriver.value}</div>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest ${keyDriver.direction === 'increases_risk' || keyDriver.direction === '+' ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'
                                        }`}>
                                        {keyDriver.direction === 'increases_risk' || keyDriver.direction === '+' ? '↑ Increases Risk' : '↓ Decreases Risk'}
                                    </span>
                                    <span className="text-sm font-bold text-zinc-400">Contrib: +{keyDriver.contrib.toFixed(3)}</span>
                                </div>
                            </div>
                        ) : (
                            <div className="text-sm text-zinc-600 mb-8 italic">Awaiting data...</div>
                        )}

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {[
                                { label: 'Salary Delay', val: signals.salary_delay_days ?? '—', stress: (signals.salary_delay_days || 0) > 0 },
                                { label: 'Auto Debit Fails', val: signals.auto_debit_failures ?? '—', stress: (signals.auto_debit_failures || 0) > 0 },
                                { label: 'Avg Balance', val: signals.avg_daily_balance_inr ? `₹${signals.avg_daily_balance_inr}` : '—', stress: false },
                                { label: 'EMI Bounced', val: signals.emi_bounced_flag ? 'Yes' : (signals.emi_bounced_flag === 0 ? 'No' : '—'), stress: !!signals.emi_bounced_flag },
                            ].map((s, i) => (
                                <div key={i} className={`p-4 rounded-xl border ${s.stress ? 'bg-red-500/10 border-red-500/30' : 'bg-zinc-950 border-zinc-800'}`}>
                                    <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">{s.label}</div>
                                    <div className={`text-lg font-bold ${s.stress ? 'text-red-400' : 'text-zinc-300'}`}>{s.val}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* RIGHT PANEL */}
                <div className="w-full lg:w-[40%] bg-[#111] flex flex-col p-6 overflow-hidden">
                    <div className="flex justify-between items-end mb-4 shrink-0">
                        <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400">Live Processing Log</h2>
                        <span className="text-[10px] text-zinc-600 font-mono">{logEntries.length} events</span>
                    </div>

                    <div className="flex-1 overflow-y-auto font-mono text-sm space-y-2 pr-2" style={{ scrollbarWidth: 'thin', scrollbarColor: '#3f3f46 transparent' }}>
                        {logEntries.length === 0 && (
                            <div className="text-zinc-600 italic mt-4 text-xs">Press Play to replay this customer's journey</div>
                        )}
                        {logEntries.map((log, idx) => {
                            if (log.type === 'week') {
                                const icon = log.data.risk_level === 'High' ? '⚠' : log.data.risk_level === 'Medium' ? '⚡' : '✓';
                                const colorClass = getRiskClass(log.data.risk_level);
                                const formattedWeek = log.data.week.toString().padStart(2, '0');
                                const formattedScore = log.data.score.toFixed(2);
                                const factorStr = log.data.top_factor ? `${log.data.top_factor}=${log.data.top_factor_value}` : 'No signals';
                                return (
                                    <div key={idx} className={`${colorClass} opacity-90`}>
                                        W{formattedWeek} │ {formattedScore} │ {icon} │ {factorStr}
                                    </div>
                                );
                            }
                            if (log.type === 'intervention') {
                                return (
                                    <div key={idx} className="my-6 border border-red-500/50 bg-red-500/10 rounded p-4 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.1)]">
                                        <div className="font-bold mb-2">🚨 INTERVENTION TRIGGERED — WEEK {log.week}</div>
                                        <div className="h-px w-full bg-red-500/30 mb-2" />
                                        <div className="space-y-1">
                                            <div className="flex"><span className="w-24 text-red-500/80">Method:</span> <span className="capitalize">{log.data.method.replace(/_/g, ' ')}</span></div>
                                            <div className="flex"><span className="w-24 text-red-500/80">Channel:</span> <span className="capitalize">{log.data.channel?.replace(/_/g, ' ') || 'None'}</span></div>
                                            <div className="flex"><span className="w-24 text-red-500/80">Message:</span> <span className="line-clamp-2">"{log.data.message}"</span></div>
                                            <div className="flex"><span className="w-24 text-red-500/80">Outcome:</span> <span className="capitalize">{log.data.voice_outcome || 'N/A'}</span></div>
                                            {log.data.hard_stop && (
                                                <div className="flex"><span className="w-24 text-red-500/80">Hard Stop:</span> <span className="font-bold">{log.data.hard_stop_reason}</span></div>
                                            )}
                                        </div>
                                    </div>
                                );
                            }
                            if (log.type === 'complete') {
                                return (
                                    <div key={idx} className="text-green-400 mt-4 font-bold border-l-2 border-green-500 pl-3">
                                        ✓ Journey complete — {log.triggered ? 'Intervention executed' : 'no intervention needed'}
                                    </div>
                                );
                            }
                            if (log.type === 'error') {
                                return <div key={idx} className="text-red-500 mt-4 bg-red-950/50 p-2 rounded">❌ Error: {log.message}</div>;
                            }
                        })}
                        <div ref={logsEndRef} />
                    </div>
                </div>
            </div>

            {/* --- BOTTOM BAR --- */}
            <div
                className={`fixed bottom-0 left-0 w-full bg-zinc-900 border-t border-zinc-800 shadow-2xl transition-transform duration-500 z-50 ${status === 'complete' ? 'translate-y-0' : 'translate-y-full'}`}
            >
                <div className="h-20 max-w-screen-2xl mx-auto px-8 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        {completionResult?.triggered ? (
                            <span className="text-red-400 font-bold flex items-center gap-2">🚨 Intervention was triggered during the journey</span>
                        ) : (
                            <span className="text-green-400 font-bold flex items-center gap-2">✓ Customer completed {totalWeeks} weeks safely</span>
                        )}
                    </div>
                    <Link
                        to={`/customer/${id}`}
                        className="bg-[#004ac6] text-white px-6 py-2.5 rounded-full text-sm font-bold shadow-lg shadow-blue-500/20 transition-transform active:scale-95"
                    >
                        View Full Customer Profile →
                    </Link>
                </div>
            </div>
        </div>
    );
}
