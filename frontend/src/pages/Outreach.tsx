import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import type { AuditRecord } from '../types'

export default function Outreach() {
    const [audit, setAudit] = useState<AuditRecord[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState<string>('all')
    const navigate = useNavigate()

    useEffect(() => {
        api.getAudit()
            .then(setAudit)
            .catch(console.error)
            .finally(() => setLoading(false))
    }, [])

    if (loading) return <div className="flex items-center justify-center min-h-[60vh] text-zinc-400 text-sm">Loading outreach queue...</div>

    const filtered = filter === 'all'
        ? audit
        : filter === 'pending'
            ? audit.filter((a) => !a.outcome && !a.voice_outcome && !a.hard_stop)
            : filter === 'accepted'
                ? audit.filter((a) => a.voice_outcome === 'accepted' || a.outcome === 'accepted')
                : filter === 'declined'
                    ? audit.filter((a) => a.voice_outcome === 'declined' || a.outcome === 'declined')
                    : filter === 'hard_stop'
                        ? audit.filter((a) => a.hard_stop)
                        : audit

    const StatusBadge = ({ record }: { record: AuditRecord }) => {
        if (record.hard_stop) return <span className="px-2 py-1 rounded-md text-[10px] font-bold uppercase bg-red-50 text-red-700">Hard Stop</span>
        if (record.voice_outcome === 'accepted' || record.outcome === 'accepted')
            return <span className="px-2 py-1 rounded-md text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700">Accepted</span>
        if (record.voice_outcome === 'declined' || record.outcome === 'declined')
            return <span className="px-2 py-1 rounded-md text-[10px] font-bold uppercase bg-red-50 text-red-700">Declined</span>
        if (record.voice_outcome === 'escalated')
            return <span className="px-2 py-1 rounded-md text-[10px] font-bold uppercase bg-amber-50 text-amber-700">Escalated</span>
        if (record.status === 'dispatched')
            return <span className="px-2 py-1 rounded-md text-[10px] font-bold uppercase bg-blue-50 text-blue-700">Dispatched</span>
        return <span className="px-2 py-1 rounded-md text-[10px] font-bold uppercase bg-zinc-100 text-zinc-600">Pending</span>
    }

    return (
        <div className="animate-fade-in-up">
            <div className="mb-8 flex justify-between items-end">
                <div>
                    <span className="text-[10px] uppercase tracking-widest font-bold text-[#737686] mb-1 block">Approval Workflow</span>
                    <h1 className="text-[1.75rem] font-bold tracking-tight text-zinc-900 leading-none">Outreach Queue</h1>
                </div>
                <div className="text-xs text-zinc-400 tabular">{filtered.length} records</div>
            </div>

            {/* Filter tabs */}
            <div className="flex gap-2 mb-6">
                {[
                    { key: 'all', label: 'All' },
                    { key: 'pending', label: 'Pending' },
                    { key: 'accepted', label: 'Accepted' },
                    { key: 'declined', label: 'Declined' },
                    { key: 'hard_stop', label: 'Hard Stop' },
                ].map((t) => (
                    <button
                        key={t.key}
                        onClick={() => setFilter(t.key)}
                        className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${filter === t.key ? 'bg-[#004ac6] text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                            }`}
                    >{t.label}</button>
                ))}
            </div>

            {/* Records */}
            {filtered.length === 0 ? (
                <div className="text-center py-20 text-zinc-400 text-sm">No outreach records found. Run the pipeline to generate interventions.</div>
            ) : (
                <div className="space-y-3">
                    {filtered.map((a) => (
                        <div
                            key={a.id}
                            onClick={() => navigate(`/customer/${a.customer_id}`)}
                            className="bg-white rounded-2xl ghost-border shadow-sm p-5 hover:shadow-md transition-all cursor-pointer"
                        >
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                                        {a.customer_id.slice(-2)}
                                    </div>
                                    <div>
                                        <div className="text-sm font-bold">{a.customer_id}</div>
                                        <div className="text-xs text-zinc-400 flex items-center gap-2 mt-0.5">
                                            <span className="capitalize">{a.intervention_method?.replace(/_/g, ' ') || '—'}</span>
                                            <span className="w-1 h-1 rounded-full bg-zinc-300" />
                                            <span className="capitalize">{a.selected_channel?.replace(/_/g, ' ') || '—'}</span>
                                            {a.voice_turns && (
                                                <>
                                                    <span className="w-1 h-1 rounded-full bg-zinc-300" />
                                                    <span>{a.voice_turns} turns</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    {a.message_tone && (
                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-50 text-zinc-500">{a.message_tone}</span>
                                    )}
                                    <StatusBadge record={a} />
                                    <span className="text-[10px] text-zinc-400 tabular min-w-[80px] text-right">
                                        {a.created_at ? new Date(a.created_at).toLocaleDateString() : '—'}
                                    </span>
                                </div>
                            </div>
                            {a.message_content && (
                                <p className="mt-3 text-xs text-zinc-500 leading-relaxed line-clamp-2">"{a.message_content}"</p>
                            )}
                            {a.hard_stop_reason && (
                                <p className="mt-2 text-xs text-red-600 font-medium">⚠ {a.hard_stop_reason}</p>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
