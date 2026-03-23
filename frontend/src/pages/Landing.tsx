import { Link } from 'react-router-dom'

export default function Landing() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[80vh] text-center animate-fade-in-up">
            {/* Hero */}
            <div className="mb-6">
                <span className="text-[10px] uppercase tracking-[0.25em] font-bold text-[#737686] mb-3 block">
                    Pre-Delinquency Intervention Engine
                </span>
                <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-zinc-900 leading-[0.95]">
                    Predict. Intervene.<br />
                    <span className="bg-gradient-to-r from-[#004ac6] to-[#2563eb] bg-clip-text text-transparent">
                        Prevent.
                    </span>
                </h1>
            </div>
            <p className="text-lg text-zinc-500 max-w-xl mb-10 font-medium leading-relaxed">
                Real-time risk scoring with explainable AI, multi-agent intervention pipelines,
                and proactive voice outreach — before the first missed payment.
            </p>

            {/* CTA */}
            <div className="flex gap-4">
                <Link
                    to="/dashboard"
                    className="bg-[#004ac6] text-white px-8 py-3 rounded-full text-sm font-semibold hover:shadow-lg hover:shadow-blue-500/20 transition-all active:scale-95"
                >
                    Enter Dashboard
                </Link>
                <Link
                    to="/live"
                    className="bg-zinc-100 text-zinc-800 px-8 py-3 rounded-full text-sm font-semibold hover:bg-zinc-200 transition-all active:scale-95 flex items-center gap-2"
                >
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Live Feed
                </Link>
            </div>

            {/* Feature grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-20 max-w-4xl w-full">
                {[
                    {
                        title: 'Ensemble ML Scoring',
                        desc: 'LightGBM + GRU neural network with SHAP explainability for every prediction.',
                        icon: '🧠',
                    },
                    {
                        title: 'Agentic Pipeline',
                        desc: 'Multi-agent LangGraph pipeline: stress analysis → compliance → intervention → outreach.',
                        icon: '🔗',
                    },
                    {
                        title: 'AI Voice Agent',
                        desc: 'Real-time multi-turn voice calls with intent tracking, sentiment analysis & guardrails.',
                        icon: '🎙️',
                    },
                ].map((f) => (
                    <div
                        key={f.title}
                        className="bg-white p-6 rounded-2xl ghost-border shadow-sm hover:shadow-md transition-all text-left"
                    >
                        <span className="text-2xl mb-3 block">{f.icon}</span>
                        <h3 className="text-sm font-bold text-zinc-900 mb-1">{f.title}</h3>
                        <p className="text-xs text-zinc-500 leading-relaxed">{f.desc}</p>
                    </div>
                ))}
            </div>

            {/* Tech stack */}
            <div className="mt-16 flex items-center gap-6 text-[10px] uppercase tracking-widest font-bold text-zinc-400">
                <span>Kafka</span>
                <span className="w-1 h-1 rounded-full bg-zinc-300" />
                <span>PostgreSQL</span>
                <span className="w-1 h-1 rounded-full bg-zinc-300" />
                <span>Cassandra</span>
                <span className="w-1 h-1 rounded-full bg-zinc-300" />
                <span>Redis</span>
                <span className="w-1 h-1 rounded-full bg-zinc-300" />
                <span>LangGraph</span>
                <span className="w-1 h-1 rounded-full bg-zinc-300" />
                <span>Groq</span>
            </div>
        </div>
    )
}
