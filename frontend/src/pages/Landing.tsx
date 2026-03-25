import { useNavigate } from 'react-router-dom';
import {
    ArrowRight,
    ShieldCheck,
    Zap,
    PieChart,
    Layers,
    Fingerprint,
    TrendingDown
} from 'lucide-react';

export default function Landing() {
    const navigate = useNavigate();

    return (
        <div className="animate-fade-in-up pb-32">
            {/* Hero Section */}
            <section className="pt-24 pb-20 text-center relative overflow-hidden">
                {/* Modern Aura Glow */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-indigo-50/50 blur-[120px] rounded-full -z-10" />

                <div className="max-w-[1240px] mx-auto px-6">
                    <div className="inline-flex items-center gap-2 px-6 py-2 bg-zinc-900 text-white rounded-full text-[10px] font-black uppercase tracking-[.3em] mb-12 shadow-xl shadow-indigo-100/50">
                        <Zap fill="white" size={12} /> Live In Production v2.4
                    </div>

                    <h1 className="text-7xl md:text-8xl font-black tracking-tighter text-zinc-950 mb-10 leading-[.9]">
                        ANTICIPATE <br />
                        <span className="text-zinc-400">NOT REACT.</span>
                    </h1>

                    <p className="max-w-2xl mx-auto text-lg text-zinc-500 font-medium leading-relaxed mb-16 tracking-tight">
                        The world's first <span className="text-zinc-950 font-black">Autonomous Debt-Mitigation Engine</span> powered by
                        Ensemble GRU-Tree intelligence. Stop delinquency before the first missed payment.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-8">
                        <button
                            onClick={() => navigate('/live')}
                            className="flex items-center gap-4 px-12 h-16 bg-zinc-950 text-white rounded-2xl text-xs font-black tracking-widest uppercase hover:bg-emerald-600 transition-all active:scale-95 shadow-2xl shadow-zinc-200"
                        >
                            Enter Live Feed <ArrowRight size={16} strokeWidth={3} />
                        </button>
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="flex items-center gap-4 px-12 h-16 bg-white text-zinc-950 border border-zinc-200 rounded-2xl text-xs font-black tracking-widest uppercase hover:bg-zinc-50 transition-all active:scale-95 shadow-sm"
                        >
                            Executive Summary
                        </button>
                    </div>
                </div>
            </section>

            {/* ROI Pulse Ticker (Hype Section) */}
            <section className="py-24 bg-white overflow-hidden border-y border-zinc-100 shadow-sm relative z-20">
                <div className="flex whitespace-nowrap animate-ticker group">
                    {[...Array(20)].map((_, i) => (
                        <div key={i} className="flex items-center gap-12 px-12 group-hover:pause-animation">
                            <div className="flex items-center gap-4">
                                <ShieldCheck size={20} className="text-emerald-500" />
                                <span className="text-[14px] font-black tracking-tighter text-zinc-950 uppercase">72% REDUCTION IN NPA</span>
                            </div>
                            <div className="flex items-center gap-4">
                                <Layers size={20} className="text-indigo-500" />
                                <span className="text-[14px] font-black tracking-tighter text-zinc-950 uppercase">12ms LATENCY</span>
                            </div>
                            <div className="flex items-center gap-4">
                                <Fingerprint size={20} className="text-zinc-400" />
                                <span className="text-[14px] font-black tracking-tighter text-zinc-950 uppercase">PRE-DELINQUENT BEHAVIORAL MAPPING</span>
                            </div>
                            <div className="flex items-center gap-4">
                                <TrendingDown size={20} className="text-red-500" />
                                <span className="text-[14px] font-black tracking-tighter text-zinc-950 uppercase">STRESS ANALYTICS</span>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* High-Fidelity Architecture Flow */}
            <section className="py-32 max-w-[1240px] mx-auto px-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-32 items-center">
                    <div className="space-y-12">
                        <h2 className="text-5xl font-black tracking-tighter leading-tight">
                            A Living <br />
                            <span className="text-indigo-600 italic font-black">Agentic Topology.</span>
                        </h2>

                        <div className="space-y-6">
                            {[
                                { title: "Kafka Ingestion", desc: "Real-time ledger and behavioral signal streaming.", icon: <Zap size={20} className="text-amber-500" /> },
                                { title: "Ensemble Scoring", desc: "Concurrent GRU and LightGBM model battlefield.", icon: <ShieldCheck size={20} className="text-indigo-500" /> },
                                { title: "Autonomous Outreach", desc: "Voice and SMS interventions via LangGraph.", icon: <PieChart size={20} className="text-emerald-500" /> }
                            ].map((item, idx) => (
                                <div key={idx} className="flex items-start gap-8 p-10 bg-zinc-50/50 rounded-[2.5rem] border border-transparent hover:bg-white hover:border-zinc-100 transition-all group">
                                    <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                                        {item.icon}
                                    </div>
                                    <div>
                                        <h3 className="text-xs font-black tracking-widest uppercase text-zinc-950 mb-3">{item.title}</h3>
                                        <p className="text-sm font-medium text-zinc-500 leading-relaxed tracking-tight">{item.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Visual Architecture Schematic  */}
                    <div className="relative aspect-square bg-[#0a0a0a] rounded-[4rem] p-16 shadow-[0_40px_100px_rgba(0,0,0,0.1)] group">
                        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white/5 to-transparent rounded-t-[4rem]" />

                        {/* Abstract Topo-Nodes */}
                        <div className="relative h-full flex flex-col justify-between items-center text-white/50 text-[10px] font-black uppercase tracking-[.3em]">
                            <div className="relative w-24 h-24 bg-zinc-900 border border-white/10 rounded-3xl flex items-center justify-center animate-node-pulse duration-[4s]">KAFKA</div>

                            <div className="h-20 w-px bg-gradient-to-b from-white/20 to-transparent" />

                            <div className="flex gap-16">
                                <div className="relative w-24 h-24 bg-indigo-600/20 border border-indigo-500/20 rounded-3xl flex items-center justify-center group-hover:bg-indigo-600 transition-all group-hover:text-white">GRU</div>
                                <div className="relative w-24 h-24 bg-emerald-600/20 border border-emerald-500/20 rounded-3xl flex items-center justify-center group-hover:bg-emerald-600 transition-all group-hover:text-white">LGBM</div>
                            </div>

                            <div className="h-20 w-px bg-gradient-to-b from-transparent to-white/20" />

                            <div className="relative w-24 h-24 bg-zinc-900 border border-white/10 rounded-3xl flex items-center justify-center animate-node-pulse duration-[3s]">AGENT</div>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
