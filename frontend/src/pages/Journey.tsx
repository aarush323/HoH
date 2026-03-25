import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ChevronLeft,
    ShieldAlert,
    BrainCircuit,
    Cpu,
    Microscope,
    UserCheck,
    MessageSquare
} from 'lucide-react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';

export default function Journey() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [week, setWeek] = useState(1);
    const [isPlaying, setIsPlaying] = useState(false);
    const [showAgents, setShowAgents] = useState(false);

    // Simulated scoring battle (LGB, GRU, Ensemble)
    const data = [
        { week: 1, lgb: 0.12, gru: 0.15, ensemble: 0.13 },
        { week: 2, lgb: 0.14, gru: 0.18, ensemble: 0.16 },
        { week: 3, lgb: 0.22, gru: 0.25, ensemble: 0.23 },
        { week: 4, lgb: 0.25, gru: 0.35, ensemble: 0.30 },
        { week: 5, lgb: 0.35, gru: 0.32, ensemble: 0.34 },
        { week: 6, lgb: 0.45, gru: 0.55, ensemble: 0.50 },
        { week: 7, lgb: 0.55, gru: 0.65, ensemble: 0.60 },
        { week: 8, lgb: 0.62, gru: 0.58, ensemble: 0.60 },
        { week: 9, lgb: 0.70, gru: 0.85, ensemble: 0.78 },
        { week: 10, lgb: 0.82, gru: 0.88, ensemble: 0.85 },
        { week: 11, lgb: 0.92, gru: 0.95, ensemble: 0.94 },
        { week: 12, lgb: 0.98, gru: 0.99, ensemble: 0.99 }
    ];

    useEffect(() => {
        let timer: any;
        if (isPlaying && week < 12) {
            timer = setTimeout(() => setWeek(w => w + 1), 800);
        } else if (week === 12) {
            setIsPlaying(false);
            setTimeout(() => setShowAgents(true), 1000);
        }
        return () => clearTimeout(timer);
    }, [isPlaying, week]);

    const currentData = data.slice(0, week);

    return (
        <div className="min-h-screen bg-zinc-950 text-white p-12 animate-fade-in-up font-sans selection:bg-indigo-500/30">
            {/* Cinematic Header */}
            <div className="flex items-center gap-10 mb-20 max-w-7xl mx-auto">
                <button
                    onClick={() => navigate('/live')}
                    className="w-14 h-14 rounded-2xl bg-zinc-900 flex items-center justify-center hover:bg-zinc-800 transition-all border border-zinc-800 active:scale-90"
                >
                    <ChevronLeft size={24} />
                </button>
                <div className="space-y-1">
                    <h1 className="text-4xl font-black tracking-tighter uppercase whitespace-nowrap leading-none">Cinema Replay</h1>
                    <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-[.25em]">Customer ID: {id}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 max-w-7xl mx-auto items-start">

                {/* Stage 1: The Model Battle Theater */}
                <div className="lg:col-span-8 space-y-10">
                    <div className="bg-zinc-900/50 rounded-[2.5rem] border border-zinc-800/50 p-12 relative overflow-hidden group shadow-2xl">
                        <div className="flex justify-between items-center mb-12">
                            <div className="flex items-center gap-4">
                                <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 italic">Ensemble Live Battle Inference</span>
                            </div>
                            <button
                                onClick={() => { setWeek(1); setIsPlaying(true); setShowAgents(false); }}
                                className="px-6 py-2 bg-white text-zinc-950 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-500 hover:text-white transition-all active:scale-95"
                            >
                                Replay History
                            </button>
                        </div>

                        <div className="h-[400px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={currentData}>
                                    <defs>
                                        <linearGradient id="colorEnsemble" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1} />
                                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <XAxis dataKey="week" hide />
                                    <YAxis domain={[0, 1]} hide />
                                    <Tooltip
                                        content={({ active, payload }) => {
                                            if (active && payload && payload.length) {
                                                return (
                                                    <div className="bg-zinc-950 text-white p-4 rounded-xl text-[10px] font-bold uppercase tracking-widest border border-zinc-800 shadow-2xl">
                                                        Risk: {(Number(payload[0].value) * 100).toFixed(1)}%
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
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
                        </div>
                    </div>
                </div>

                {/* Stage 2: The Agent Chain Reaction */}
                <div className="lg:col-span-4 space-y-8">
                    <div className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-600 mb-4">Autonomous Chain Response</div>

                    <div className="space-y-6">
                        {[
                            { id: 1, name: "Data Analyst", icon: <Microscope size={18} />, color: "text-amber-500", desc: "Detected structural salary misalignment vs history." },
                            { id: 2, name: "Compliance Bot", icon: <BrainCircuit size={18} />, color: "text-indigo-500", desc: "Verified legal moratorium eligibility for zone A." },
                            { id: 3, name: "Voice Strategist", icon: <MessageSquare size={18} />, color: "text-emerald-500", desc: "Selected empathic channel via ResonareAI API." }
                        ].map((agent, i) => (
                            <div
                                key={agent.id}
                                className={`p-8 bg-zinc-900 rounded-[2rem] border border-zinc-800 transition-all duration-700 delay-[${i * 300}ms] ${showAgents ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-12'}`}
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
