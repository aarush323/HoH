import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import type { AuditRecord } from '../types'
import {
    MessageSquare,
    Phone,
    ChevronRight,
    CheckCircle2,
    XCircle,
    Activity
} from 'lucide-react'

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

    if (loading) return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="w-12 h-12 border-4 border-zinc-100 border-t-indigo-600 rounded-full animate-spin" />
        </div>
    )

    const filtered = filter === 'all' ? audit : audit.filter(a => a.status === filter || a.voice_outcome === filter)

    const stats = {
        total: audit.length,
        resolved: audit.filter(a => a.status === 'Resolved' || a.voice_outcome === 'accepted').length,
        escalated: audit.filter(a => a.voice_escalate).length
    }

    return (
        <div className="animate-fade-in pb-32 max-w-[1240px] mx-auto px-6 font-sans text-zinc-900 selection:bg-indigo-50 leading-tight">

            {/* Header with KPIs */}
            <div className="pt-20 mb-16 flex flex-col md:flex-row justify-between items-end gap-10">
                <div className="space-y-4">
                    <div className="text-[10px] font-black uppercase tracking-[.4em] text-zinc-400">Intervention Analysis</div>
                    <h1 className="text-5xl font-black tracking-tighter text-zinc-950 leading-none">Outreach Hub</h1>
                </div>

                <div className="flex gap-10">
                    <div className="text-right">
                        <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">Efficiency</div>
                        <div className="text-3xl font-black text-emerald-500 tabular">{Math.round((stats.resolved / stats.total) * 100 || 0)}%</div>
                    </div>
                    <div className="text-right border-l border-zinc-100 pl-10">
                        <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">Active Calls</div>
                        <div className="text-3xl font-black text-indigo-600 tabular">{stats.total}</div>
                    </div>
                </div>
            </div>

            {/* Sub-Nav Filters */}
            <div className="flex gap-4 mb-12">
                {['all', 'dispatched', 'accepted', 'declined', 'escalated'].map((f) => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filter === f ? 'bg-zinc-950 text-white shadow-xl' : 'bg-zinc-50 text-zinc-400 hover:bg-zinc-100'}`}
                    >
                        {f}
                    </button>
                ))}
            </div>

            {/* Interaction List */}
            <div className="grid grid-cols-1 gap-6">
                {filtered.length === 0 ? (
                    <div className="py-20 text-center text-[11px] font-black uppercase tracking-widest text-zinc-300 italic">No Active Interaction History</div>
                ) : (
                    filtered.map((a) => {
                        const isAccepted = a.voice_outcome === 'accepted' || a.outcome === 'accepted';
                        const isDeclined = a.voice_outcome === 'declined' || a.outcome === 'declined';
                        const isVoice = a.selected_channel === 'voice';

                        return (
                            <div
                                key={a.id}
                                onClick={() => navigate(`/customer/${a.customer_id}`)}
                                className="group bg-white p-8 rounded-[1.5rem] border border-zinc-100 shadow-sm transition-all hover:shadow-2xl hover:border-zinc-200 cursor-pointer flex items-center gap-12"
                            >
                                {/* Left Section: Identity */}
                                <div className="w-1/4 flex items-center gap-6 border-r border-zinc-50 mr-6">
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${isVoice ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                        {isVoice ? <Phone size={20} /> : <MessageSquare size={20} />}
                                    </div>
                                    <div>
                                        <div className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1.5">{a.customer_id}</div>
                                        <div className="text-sm font-black text-zinc-950">{a.selected_channel} Interaction</div>
                                    </div>
                                </div>

                                {/* Deep Context Strip */}
                                <div className="flex-1 flex flex-col gap-4">
                                    <div className="flex items-center gap-6">
                                        <div className="px-3 py-1 bg-zinc-50 rounded-lg text-[9px] font-black uppercase tracking-widest text-zinc-400"> Tone: {a.message_tone}</div>
                                        <div className="flex items-center gap-2 text-zinc-300 text-[10px] font-bold">
                                            <Activity size={10} /> Stress Analysis Confirmed
                                        </div>
                                    </div>
                                    <p className="text-[12px] font-bold text-zinc-500 leading-relaxed italic line-clamp-1">"{a.message_content}"</p>
                                </div>

                                {/* Outcome State */}
                                <div className="w-1/4 flex items-center justify-end gap-10 border-l border-zinc-50 ml-10">
                                    <div className="text-right">
                                        <div className="text-[9px] font-black uppercase text-zinc-400 tracking-widest mb-1.5">Outcome</div>
                                        <div className={`text-xs font-black uppercase tracking-widest flex items-center gap-2 justify-end ${isAccepted ? 'text-emerald-500' : isDeclined ? 'text-red-500' : 'text-zinc-400'}`}>
                                            {isAccepted ? <CheckCircle2 size={12} /> : isDeclined ? <XCircle size={12} /> : null}
                                            {a.voice_outcome || a.status}
                                        </div>
                                    </div>
                                    <div className="w-12 h-12 bg-zinc-50 rounded-xl flex items-center justify-center text-zinc-200 group-hover:bg-zinc-950 group-hover:text-white transition-all shadow-sm">
                                        <ChevronRight size={18} strokeWidth={3} />
                                    </div>
                                </div>
                            </div>
                        )
                    })
                )}
            </div>

        </div>
    )
}
