import { Link } from 'react-router-dom'
import {
    Radio,
    Brain,
    PhoneCall,
    Mic2,
    Cpu,
    BarChart2,
    ShieldCheck,
    Eye,
    Users,
    MessageSquare,
    Zap,
    TrendingUp,
    Building2,
    ChevronRight,
    Menu,
    X
} from 'lucide-react'
import { useState } from 'react'

const BarclaysEagle = ({ className }: { className?: string }) => (
    <svg
        viewBox="0 0 100 80"
        className={className}
        fill="currentColor"
    >
        {/* Simplified Barclays-style eagle silhouette */}
        <path d="M50 15 L65 5 L60 25 L85 15 L75 35 L95 30 L80 50 L90 70 L70 60 L60 75 L50 45 L40 75 L30 60 L10 70 L20 50 L5 30 L25 35 L15 15 L40 25 L35 5 Z" />
    </svg>
)

export default function Landing() {
    const [isMenuOpen, setIsMenuOpen] = useState(false)

    // Smooth scroll function
    const scrollTo = (id: string) => {
        setIsMenuOpen(false)
        const element = document.getElementById(id)
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' })
        }
    }

    return (
        <div className="min-h-screen bg-white font-sans text-[#0F172A] selection:bg-blue-100 selection:text-blue-900 overflow-x-hidden">

            {/* SECTION 1 — NAVBAR */}
            <nav className="sticky top-0 z-50 h-16 bg-[#0A1628] border-b border-white/10 backdrop-blur-md px-6">
                <div className="max-w-7xl mx-auto h-full flex items-center justify-between">

                    {/* Left: Logo + Title */}
                    <div className="flex items-center gap-3">
                        <BarclaysEagle className="w-8 h-8 text-[#00AEEF]" />
                        <span className="font-black text-white tracking-widest text-sm">BARCLAYS</span>
                        <div className="h-5 w-px bg-slate-600 mx-1" />
                        <span className="text-slate-400 text-sm font-normal hidden sm:inline">Pre-Delinquency Engine</span>
                    </div>

                    {/* Center: Desktop Nav */}
                    <div className="hidden lg:flex items-center gap-8">
                        <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="text-slate-300 text-sm font-medium hover:text-white hover:border-b-2 hover:border-[#00AEEF] transition-all pb-1">Home</button>
                        <button onClick={() => scrollTo('features')} className="text-slate-300 text-sm font-medium hover:text-white hover:border-b-2 hover:border-[#00AEEF] transition-all pb-1">Engine Features</button>
                        <button onClick={() => scrollTo('stats')} className="text-slate-300 text-sm font-medium hover:text-white hover:border-b-2 hover:border-[#00AEEF] transition-all pb-1">Case Studies</button>
                        <button onClick={() => scrollTo('how-it-works')} className="text-slate-300 text-sm font-medium hover:text-white hover:border-b-2 hover:border-[#00AEEF] transition-all pb-1">About Barclays Risk</button>
                    </div>

                    {/* Right: CTA + Mobile Menu Button */}
                    <div className="flex items-center gap-4">
                        <Link
                            to="/dashboard"
                            className="bg-[#00AEEF] hover:bg-blue-400 text-white font-semibold px-5 py-2 rounded-lg text-sm transition-all shadow-lg shadow-blue-900/30 whitespace-nowrap"
                        >
                            Launch Engine
                        </Link>
                        <button
                            className="lg:hidden text-white p-1"
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                        >
                            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
                        </button>
                    </div>
                </div>

                {/* Mobile Dropdown */}
                {isMenuOpen && (
                    <div className="lg:hidden absolute top-16 left-0 w-full bg-[#0A1628] border-b border-white/10 py-6 px-10 flex flex-col gap-6 shadow-2xl animate-fade-in">
                        <button onClick={() => scrollTo('features')} className="text-slate-300 font-medium text-left">Engine Features</button>
                        <button onClick={() => scrollTo('stats')} className="text-slate-300 font-medium text-left">Case Studies</button>
                        <button onClick={() => scrollTo('how-it-works')} className="text-slate-300 font-medium text-left">About Barclays Risk</button>
                    </div>
                )}
            </nav>

            {/* SECTION 2 — HERO */}
            <section className="relative px-6 py-20 lg:py-32 overflow-hidden bg-white">
                <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

                    {/* Left Column — Text */}
                    <div className="space-y-6">
                        <div className="inline-flex items-center">
                            <span className="text-slate-500 text-base font-normal">Proactive Delinquency Prevention with the</span>
                        </div>
                        <h1 className="text-6xl md:text-7xl font-black text-[#0F172A] leading-[1.05] tracking-tight">
                            Barclays Sentinel <br />
                            <span className="text-[#00AEEF]">Engine.</span>
                        </h1>
                        <p className="max-w-md text-lg md:text-xl text-slate-500 font-medium leading-relaxed tracking-tight">
                            Leverage advanced analytics and machine learning to identify
                            at-risk customers early, and automate personalized intervention
                            strategies for better financial outcomes.
                        </p>

                        <div className="flex flex-wrap gap-4 pt-4">
                            <Link
                                to="/dashboard"
                                className="bg-[#00AEEF] hover:bg-blue-500 text-white font-bold px-8 py-4 rounded-xl text-sm shadow-xl shadow-blue-200 transition-all hover:-translate-y-0.5"
                            >
                                Launch Dashboard
                            </Link>
                            <button
                                onClick={() => scrollTo('features')}
                                className="border-2 border-slate-800 text-slate-800 hover:bg-slate-900 hover:text-white px-8 py-4 rounded-xl text-sm font-bold transition-all"
                            >
                                Features Overview
                            </button>
                        </div>

                        {/* Trusted By Strip */}
                        <div className="pt-12">
                            <p className="text-slate-400 text-sm font-bold uppercase tracking-widest mb-6">Trusted By Institutions:</p>
                            <div className="flex flex-wrap gap-x-8 gap-y-4 items-center">
                                {['Santander', 'Schroders', 'NatWest', 'Lloyds', 'HSBC'].map(bank => (
                                    <span key={bank} className="flex items-center gap-2 text-slate-500 text-sm font-black italic tracking-tight">
                                        <Building2 size={14} className="text-slate-400" />
                                        {bank}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right Column — Layered Card Stack */}
                    <div className="relative h-[500px] flex items-center justify-center lg:justify-end pr-8">

                        {/* Dot Grid Background */}
                        <div
                            className="absolute right-0 top-1/2 -translate-y-1/2 w-[500px] h-[500px] -z-10"
                            style={{
                                backgroundImage: "radial-gradient(circle, #CBD5E1 1.5px, transparent 1.5px)",
                                backgroundSize: "32px 32px",
                                opacity: 0.3
                            }}
                        />

                        {/* CARD LAYER 1 — Main Monitor */}
                        <div className="relative z-20 w-80 bg-white rounded-3xl shadow-[0_50px_100px_-20px_rgba(15,23,42,0.15)] border border-slate-100 p-6 animate-fade-in-up">
                            <div className="flex justify-between items-center mb-6">
                                <span className="text-slate-800 text-xs font-black uppercase tracking-widest leading-none">Sentinel Monitor</span>
                                <BarclaysEagle className="w-5 h-5 text-[#00AEEF]" />
                            </div>

                            {/* SVG Line Chart */}
                            <div className="h-40 w-full bg-slate-50/50 rounded-2xl p-2 border border-slate-50 relative">
                                <svg viewBox="0 0 280 120" className="w-full h-full overflow-visible">
                                    <defs>
                                        <linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#00AEEF" stopOpacity="0.4" />
                                            <stop offset="100%" stopColor="#00AEEF" stopOpacity="0" />
                                        </linearGradient>
                                    </defs>
                                    {/* Grids */}
                                    <line x1="0" y1="100" x2="280" y2="100" stroke="#E2E8F0" strokeWidth="1" />
                                    <line x1="0" y1="50" x2="280" y2="50" stroke="#E2E8F0" strokeWidth="1" strokeDasharray="4 4" />

                                    {/* Path */}
                                    <path
                                        d="M0 90 Q40 85, 80 88 T160 70 T240 60 T280 20"
                                        fill="none"
                                        stroke="#00AEEF"
                                        strokeWidth="3"
                                        strokeLinecap="round"
                                    />
                                    <path
                                        d="M0 90 Q40 85, 80 88 T160 70 T240 60 T280 20 L280 110 L0 110 Z"
                                        fill="url(#blueGrad)"
                                    />

                                    {/* Spike Marker */}
                                    <circle cx="280" cy="20" r="5" fill="#EF4444" className="animate-pulse" />

                                    {/* Annotation Tooltip */}
                                    <g transform="translate(180, 5)">
                                        <rect width="90" height="34" rx="8" fill="#1E293B" />
                                        <text x="10" y="16" fill="white" fontSize="9" fontWeight="900" className="uppercase tracking-tighter">Income Spike</text>
                                        <text x="10" y="27" fill="#93C5FD" fontSize="9" fontWeight="700">DETECTED</text>
                                    </g>
                                </svg>
                            </div>

                            <div className="mt-6 flex justify-between items-end">
                                <div>
                                    <div className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mb-1">Risk score:</div>
                                    <div className="text-4xl font-black text-[#0F172A] tracking-tighter leading-none">8.5/10</div>
                                </div>
                                <div className="flex gap-2">
                                    <span className="px-3 py-1 bg-red-50 text-red-600 text-[10px] font-black uppercase tracking-widest rounded-full leading-none">● High Risk</span>
                                </div>
                            </div>
                        </div>

                        {/* CARD LAYER 2 — Profile (Top-Right) */}
                        <div className="absolute top-0 -right-6 z-30 w-72 bg-[#1E293B] rounded-2xl shadow-2xl p-5 border border-slate-700 animate-slide-in-right hidden md:block" style={{ animationDelay: '200ms' }}>
                            <div className="flex items-center gap-4 mb-6 pt-1">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#00AEEF] to-blue-600 flex items-center justify-center text-white font-black text-sm">
                                    JD
                                </div>
                                <div>
                                    <div className="text-white text-[11px] font-black tracking-tight leading-none mb-1 uppercase">Jane D.</div>
                                    <div className="text-red-400 text-[9px] font-bold uppercase tracking-widest leading-none">High Risk Alert</div>
                                </div>
                            </div>
                            <div className="space-y-3">
                                <div className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mb-2">Internal Flags:</div>
                                <div className="flex items-center gap-2 text-slate-300 text-[10px] font-bold italic leading-none">
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                                    Income Volatility
                                </div>
                                <div className="flex items-center gap-2 text-slate-300 text-[10px] font-bold italic leading-none">
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                                    Spend spike (luxury)
                                </div>
                            </div>
                        </div>

                        {/* CARD LAYER 3 — Performance (Bottom-Right) */}
                        <div className="absolute -bottom-8 -right-2 z-10 w-80 bg-[#0F172A] rounded-2xl shadow-xl p-6 border border-slate-800 animate-slide-in-up hidden md:block" style={{ animationDelay: '400ms' }}>
                            <div className="text-white text-xs font-black uppercase tracking-widest border-b border-white/5 pb-4 mb-4">Intervention performance</div>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-6">
                                <div>
                                    <div className="text-slate-500 text-[9px] font-black uppercase tracking-widest leading-none mb-2">Default Drop:</div>
                                    <div className="text-2xl font-black text-white leading-none">16%</div>
                                </div>
                                <div>
                                    <div className="text-slate-500 text-[9px] font-black uppercase tracking-widest leading-none mb-2">Saved Value:</div>
                                    <div className="text-2xl font-black text-[#00AEEF] leading-none italic">£4.2M</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* SECTION 3 — STATS STRIP */}
            <section id="stats" className="bg-[#0A1628] py-16 scroll-mt-16">
                <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-12 px-10">
                    {[
                        { val: '1M+', label: 'Accounts Monitored Daily' },
                        { val: '10+', label: 'Years Modeling Excellence' },
                        { val: '5B+', label: 'Data Points Analyzed Daily' },
                        { val: '15%+', label: 'Reduction in Credit Loss' },
                        { val: '20+', label: 'Integrated Bank Systems' }
                    ].map((s, i) => (
                        <div key={i} className="text-center group flex flex-col items-center">
                            <div className="text-4xl lg:text-5xl font-black text-white tracking-widest mb-4 group-hover:scale-110 transition-transform">{s.val}</div>
                            <div className="text-slate-400 text-[11px] font-black uppercase tracking-widest leading-relaxed max-w-[120px]">{s.label}</div>
                        </div>
                    ))}
                </div>
                <div className="max-w-7xl mx-auto px-10 pt-16 mt-16 border-t border-white/5">
                    <p className="text-slate-600 text-[10px] font-bold text-center uppercase tracking-widest italic opacity-50">© Barclays Bank corporanization, LLC. All rights reserved.</p>
                </div>
            </section>

            {/* SECTION 4 — HOW IT WORKS */}
            <section id="how-it-works" className="py-24 bg-slate-50 px-6 scroll-mt-16">
                <div className="max-w-7xl mx-auto">
                    <div className="mb-20 space-y-4">
                        <span className="text-xs font-black uppercase tracking-[0.4em] text-[#00AEEF]">The Engine</span>
                        <h2 className="text-4xl md:text-5xl font-black text-[#0F172A] tracking-tighter leading-tight max-w-2xl">
                            From Signal to <br /> <span className="text-slate-300 italic">Intervention in Seconds</span>
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 relative items-start">
                        {/* Step 1 */}
                        <div className="bg-white rounded-[2.5rem] p-10 shadow-sm border-t-4 border-t-[#00AEEF] relative group hover:shadow-2xl transition-all duration-500">
                            <div className="absolute -top-4 -left-4 w-10 h-10 bg-white border border-slate-100 rounded-xl flex items-center justify-center text-[10px] font-black text-slate-400 font-mono shadow-sm">01</div>
                            <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-[#00AEEF] mb-8 group-hover:rotate-12 transition-transform">
                                <Radio size={28} />
                            </div>
                            <h3 className="text-2xl font-black tracking-tight text-[#0F172A] mb-4 uppercase">Detect Signals</h3>
                            <p className="text-slate-500 text-sm font-bold leading-relaxed italic">
                                Real-time Kafka streams analyze 40+ behavioral signals —
                                salary delays, EMI bounces, savings drawdown.
                            </p>
                        </div>

                        <div className="hidden lg:flex items-center justify-center pt-24 text-slate-200"><ChevronRight size={32} /></div>

                        {/* Step 2 */}
                        <div className="bg-white rounded-[2.5rem] p-10 shadow-sm border-t-4 border-t-purple-500 relative group hover:shadow-2xl transition-all duration-500">
                            <div className="absolute -top-4 -left-4 w-10 h-10 bg-white border border-slate-100 rounded-xl flex items-center justify-center text-[10px] font-black text-slate-400 font-mono shadow-sm">02</div>
                            <div className="w-14 h-14 bg-purple-50 rounded-2xl flex items-center justify-center text-purple-600 mb-8 group-hover:rotate-12 transition-transform">
                                <Brain size={28} />
                            </div>
                            <h3 className="text-2xl font-black tracking-tight text-[#0F172A] mb-4 uppercase">Score with ML</h3>
                            <p className="text-slate-500 text-sm font-bold leading-relaxed italic">
                                LightGBM + GRU ensemble scores default probability
                                2–4 weeks ahead with SHAP-explainable predictions.
                            </p>
                        </div>

                        <div className="hidden lg:flex items-center justify-center pt-24 text-slate-200"><ChevronRight size={32} /></div>

                        {/* Step 3 */}
                        <div className="bg-white rounded-[2.5rem] p-10 shadow-sm border-t-4 border-t-emerald-500 relative group hover:shadow-2xl transition-all duration-500">
                            <div className="absolute -top-4 -left-4 w-10 h-10 bg-white border border-slate-100 rounded-xl flex items-center justify-center text-[10px] font-black text-slate-400 font-mono shadow-sm">03</div>
                            <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 mb-8 group-hover:rotate-12 transition-transform">
                                <PhoneCall size={28} />
                            </div>
                            <h3 className="text-2xl font-black tracking-tight text-[#0F172A] mb-4 uppercase">Intervene</h3>
                            <p className="text-slate-500 text-sm font-bold leading-relaxed italic">
                                LangGraph agents dispatch voice calls, SMS, and restructuring
                                offers before a single payment is ever missed.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* SECTION 5 — FEATURES */}
            <section id="features" className="py-24 bg-white px-6 scroll-mt-16">
                <div className="max-w-7xl mx-auto">
                    <div className="mb-20 space-y-4 text-center">
                        <span className="text-xs font-black uppercase tracking-[0.4em] text-[#00AEEF]">Capabilities</span>
                        <h2 className="text-4xl md:text-5xl font-black text-[#0F172A] tracking-tighter leading-tight">Everything a Risk Manager Needs</h2>
                        <p className="text-slate-500 text-lg font-bold italic opacity-60">One engine. Full coverage. Zero blind spots.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
                        {[
                            { icon: <Mic2 size={24} />, title: 'Voice AI Agent', color: 'bg-blue-50', text: 'text-[#00AEEF]', body: 'Outbound calls with real-time STT + TTS. The agent negotiates, offers restructuring, and logs outcomes.' },
                            { icon: <Cpu size={24} />, title: 'Explainable ML', color: 'bg-purple-50', text: 'text-purple-600', body: 'SHAP values from LightGBM + GRU make every risk score transparent, auditable, and regulator-ready.' },
                            { icon: <BarChart2 size={24} />, title: 'Live Risk Dashboard', color: 'bg-emerald-50', text: 'text-emerald-600', body: 'Server-Sent Events push real-time updates to SENTINEL — always current, never stale.' },
                            { icon: <ShieldCheck size={24} />, title: 'Compliance Guard', color: 'bg-red-50', text: 'text-red-500', body: '4-point hard-stop checks for Fraud, NPA, and KYC. All high-risk automated actions are pre-blocked.' },
                        ].map((f, i) => (
                            <div key={i} className="bg-white rounded-[2rem] p-10 border border-slate-100 flex gap-8 items-start hover:border-[#00AEEF] hover:shadow-xl transition-all group">
                                <div className={`w-14 h-14 rounded-2xl ${f.color} ${f.text} flex items-center justify-center shrink-0`}>
                                    {f.icon}
                                </div>
                                <div>
                                    <h3 className="text-xl font-black tracking-tight text-[#0F172A] uppercase mb-2">{f.title}</h3>
                                    <p className="text-sm font-bold text-slate-500 italic leading-relaxed">{f.body}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* SECTION 6 — NAVIGATION HUB */}
            <section className="py-24 bg-slate-50 px-6 border-y border-slate-200">
                <div className="max-w-7xl mx-auto">
                    <div className="mb-20 space-y-4">
                        <span className="text-xs font-black uppercase tracking-[0.4em] text-[#00AEEF]">Platform</span>
                        <h2 className="text-4xl font-black text-[#0F172A] tracking-tighter">Navigate the Engine</h2>
                        <p className="text-slate-500 text-lg font-bold italic opacity-60">Jump directly into the control modules</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
                        {[
                            { to: '/dashboard', icon: <Eye />, color: 'text-[#00AEEF]', bg: 'bg-blue-50', title: 'SENTINEL Overview', desc: "Bird's eye portfolio intelligence" },
                            { to: '/live', icon: <Radio className="animate-pulse" />, color: 'text-red-500', bg: 'bg-red-50', title: 'Live Monitor', desc: 'Real-time stream of behavioral signals' },
                            { to: '/portfolio', icon: <Users />, color: 'text-purple-600', bg: 'bg-purple-50', title: 'Client Profiles', desc: 'Individual risk journeys and 12-week history' },
                            { to: '/outreach', icon: <MessageSquare />, color: 'text-emerald-600', bg: 'bg-emerald-50', title: 'Outreach Center', desc: 'Intervention logs and channel dispatch' },
                            { to: '/shocks', icon: <Zap />, color: 'text-amber-500', bg: 'bg-amber-50', title: 'Shock Impact', desc: 'Macro event detection and assessment' },
                            { to: '/journey/C00011', icon: <TrendingUp />, color: 'text-blue-700', bg: 'bg-blue-100', title: 'Risk Playback', desc: 'Week-by-week score deterioration replay' },
                        ].map((m, i) => (
                            <Link
                                key={i}
                                to={m.to}
                                className="bg-white rounded-[2rem] p-8 border border-slate-200 flex flex-col group transition-all hover:border-[#00AEEF] hover:shadow-2xl hover:-translate-y-2"
                            >
                                <div className={`w-12 h-12 rounded-xl ${m.bg} ${m.color} flex items-center justify-center transition-transform group-hover:scale-110`}>
                                    {m.icon}
                                </div>
                                <div className="mt-8">
                                    <h3 className="text-sm font-black text-[#0F172A] uppercase tracking-widest mb-1">{m.title}</h3>
                                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-tight italic">{m.desc}</p>
                                </div>
                                <div className="mt-8 text-[#00AEEF] text-xs font-black uppercase tracking-widest flex items-center gap-2">
                                    Open Engine <ArrowRight size={14} className="group-hover:translate-x-4 transition-transform" />
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            </section>

            {/* SECTION 7 — FOOTER */}
            <footer className="bg-[#0A1628] py-24 px-10">
                <div className="max-w-7xl mx-auto flex flex-col lg:flex-row justify-between items-start gap-16">
                    <div className="space-y-6">
                        <div className="flex items-center gap-3">
                            <BarclaysEagle className="w-10 h-10 text-[#00AEEF]" />
                            <span className="font-black text-white tracking-[.4em] text-xl">BARCLAYS</span>
                        </div>
                        <p className="text-slate-400 text-sm font-medium">Pre-Delinquency Intervention Engine <br /><span className="text-slate-600 text-xs font-bold italic">NamitaEngine · Powered by HoH Architecture</span></p>
                    </div>

                    <div className="space-y-4">
                        <p className="text-slate-400 text-sm font-black uppercase tracking-widest">Built exclusively for</p>
                        <div className="text-[#00AEEF] font-black text-3xl tracking-tighter italic">Barclays Bank.</div>
                        <div className="h-0.5 w-32 bg-[#00AEEF]" />
                    </div>
                </div>

                <div className="max-w-7xl mx-auto flex justify-center gap-8 lg:gap-16 mt-20 text-slate-500 text-xs font-black uppercase tracking-widest">
                    <button onClick={() => scrollTo('features')} className="hover:text-white transition-colors">Stack</button>
                    <button onClick={() => scrollTo('how-it-works')} className="hover:text-white transition-colors">Governance</button>
                    <button onClick={() => scrollTo('stats')} className="hover:text-white transition-colors">API</button>
                    <button className="hover:text-white transition-colors">Legal</button>
                </div>

                <div className="max-w-7xl mx-auto pt-10 mt-10 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
                    <p className="text-slate-600 text-[10px] font-bold uppercase tracking-widest text-center">
                        © 2025 Barclays Bank. NamitaEngine Pre-Delinquency Platform. All rights reserved.
                    </p>
                </div>
            </footer>

            <style>{`
                @keyframes fade-in {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes fade-in-up {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes slide-in-right {
                    from { opacity: 0; transform: translateX(40px); }
                    to { opacity: 1; transform: translateX(0); }
                }
                @keyframes slide-in-up {
                    from { opacity: 0; transform: translateY(40px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in { animation: fade-in 600ms ease-out forwards; }
                .animate-fade-in-up { animation: fade-in-up 800ms ease-out forwards; }
                .animate-slide-in-right { animation: slide-in-right 1000ms ease-out forwards; }
                .animate-slide-in-up { animation: slide-in-up 1000ms ease-out forwards; }
            `}</style>
        </div>
    )
}

function ArrowRight({ size, className }: { size?: number, className?: string }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
        </svg>
    )
}
