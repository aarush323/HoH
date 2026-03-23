import { useNavigate } from 'react-router-dom'
import { useLiveFeed } from '../context/LiveFeedContext'

export default function LiveFeed() {
    const { customers, eventCount, lastUpdate, connected } = useLiveFeed()
    const navigate = useNavigate()

    const counts = { High: 0, Medium: 0, Low: 0 }
    customers.forEach((c) => {
        if (c.risk_level in counts) counts[c.risk_level as keyof typeof counts]++
    })

    return (
        <div className="animate-fade-in-up">
            {/* Header */}
            <div className="mb-8 flex flex-col md:flex-row justify-between md:items-end gap-4">
                <div>
                    <span className="text-[10px] uppercase tracking-widest font-bold text-[#737686] mb-1 block">
                        Real-Time Monitoring
                    </span>
                    <h1 className="text-[1.75rem] font-bold tracking-tight text-zinc-900 leading-none">Live Feed</h1>
                </div>
                <div className="flex items-center gap-6">
                    {/* Status */}
                    <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500 animate-pulse-dot' : 'bg-red-500'}`} />
                        <span className="text-xs font-semibold text-zinc-600">{connected ? 'Connected' : 'Disconnected'}</span>
                    </div>
                    <div className="text-xs text-zinc-400 tabular">
                        Events: <span className="font-bold text-zinc-700">{eventCount}</span>
                    </div>
                    <div className="text-xs text-zinc-400">
                        Last: <span className="font-medium text-zinc-600">{lastUpdate ? lastUpdate.toLocaleTimeString() : '—'}</span>
                    </div>
                    {/* Risk pills */}
                    <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700">{counts.High} High</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700">{counts.Medium} Med</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">{counts.Low} Low</span>
                    </div>
                </div>
            </div>

            {/* Cards grid */}
            {customers.length === 0 ? (
                <div className="flex flex-col items-center justify-center min-h-[50vh] text-zinc-400">
                    <div className="w-12 h-12 border-4 border-zinc-200 border-t-[#004ac6] rounded-full animate-spin mb-4" />
                    <p className="text-sm font-medium">Waiting for SSE stream on /api/stream...</p>
                    <p className="text-xs mt-1">Make sure the backend is running on port 8000</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {customers.map((c, i) => (
                        <div
                            key={c.customer_id}
                            onClick={() => navigate(`/customer/${c.customer_id}`)}
                            className="bg-white rounded-2xl ghost-border shadow-sm p-5 cursor-pointer hover:shadow-md transition-all hover:-translate-y-0.5 animate-fade-in-up"
                            style={{ animationDelay: `${i * 30}ms` }}
                        >
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <div className="text-sm font-bold text-zinc-900">{c.customer_id}</div>
                                    <div className="text-xs text-zinc-400">{c.name}</div>
                                </div>
                                <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase ${c.risk_level === 'High' ? 'bg-red-50 text-red-700' :
                                    c.risk_level === 'Medium' ? 'bg-amber-50 text-amber-700' :
                                        'bg-emerald-50 text-emerald-700'
                                    }`}>{c.risk_level}</span>
                            </div>
                            <div className={`text-2xl font-black tabular tracking-tighter ${c.risk_level === 'High' ? 'text-red-500' :
                                c.risk_level === 'Medium' ? 'text-amber-500' :
                                    'text-emerald-500'
                                }`}>
                                {c.risk_score?.toFixed(4)}
                            </div>
                            <div className="mt-3 flex items-center gap-3 text-[10px] text-zinc-400 font-medium">
                                <span>{c.product_type}</span>
                                <span className="w-1 h-1 rounded-full bg-zinc-300" />
                                <span>{c.customer_segment}</span>
                                <span className="w-1 h-1 rounded-full bg-zinc-300" />
                                <span>{c.observation_week}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
