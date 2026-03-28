import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import type { PendingIntervention, PendingSummary } from '../types'
import {
    Phone,
    Mail,
    MessageSquare,
    CheckCircle2,
    XCircle,
    Clock,
    Eye,
    AlertTriangle,
    ShieldCheck,
    RefreshCw,
    AlertCircle,
} from 'lucide-react'

export default function ApprovalQueue() {
    const [pending, setPending] = useState<PendingIntervention[]>([])
    const [summary, setSummary] = useState<PendingSummary | null>(null)
    const navigate = useNavigate()
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [filter, setFilter] = useState<string>('PENDING')
    const [selectedItem, setSelectedItem] = useState<PendingIntervention | null>(null)
    const [showRejectModal, setShowRejectModal] = useState<number | null>(null)
    const [rejectReason, setRejectReason] = useState('')
    const [actionLoading, setActionLoading] = useState<number | null>(null)

    const fetchPending = async () => {
        try {
            setLoading(true)
            setError(null)
            const response = await api.getPendingApprovals()
            setPending(response.pending)
            setSummary(response.summary)
        } catch (err) {
            console.error('Failed to fetch pending approvals:', err)
            setError('Failed to load pending approvals')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchPending()
    }, [])

    const handleApprove = async (id: number) => {
        try {
            setActionLoading(id)
            const result = await api.approvePending(id)
            console.log('Approved:', result)
            
            // Check if should stream (voice channel returns should_stream: true)
            if ((result as { should_stream?: boolean }).should_stream) {
                navigate(`/voice-call/${id}`)
            } else {
                await fetchPending()
            }
        } catch (err) {
            console.error('Failed to approve:', err)
            alert('Failed to approve intervention')
        } finally {
            setActionLoading(null)
        }
    }

    const handleReject = async (id: number) => {
        if (!rejectReason.trim()) {
            alert('Please provide a reason for rejection')
            return
        }
        try {
            setActionLoading(id)
            const result = await api.rejectPending(id, rejectReason)
            console.log('Rejected:', result)
            setShowRejectModal(null)
            setRejectReason('')
            await fetchPending()
        } catch (err) {
            console.error('Failed to reject:', err)
            alert('Failed to reject intervention')
        } finally {
            setActionLoading(null)
        }
    }

    const filtered = filter === 'all' 
        ? pending 
        : pending.filter(p => p.status === filter || p.risk_level.toLowerCase() === filter.toLowerCase())

    const getRiskColor = (level: string) => {
        switch (level.toUpperCase()) {
            case 'HIGH': return 'bg-red-100 text-red-700 border-red-200'
            case 'MED': return 'bg-amber-100 text-amber-700 border-amber-200'
            case 'LOW': return 'bg-emerald-100 text-emerald-700 border-emerald-200'
            default: return 'bg-zinc-100 text-zinc-700 border-zinc-200'
        }
    }

    const getChannelIcon = (channel: string) => {
        switch (channel) {
            case 'voice': return <Phone size={16} />
            case 'email': return <Mail size={16} />
            case 'whatsapp': return <MessageSquare size={16} />
            default: return <Clock size={16} />
        }
    }

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'PENDING': return <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">PENDING</span>
            case 'APPROVED': return <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold">APPROVED</span>
            case 'EXECUTED': return <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">EXECUTED</span>
            case 'REJECTED': return <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold">REJECTED</span>
            default: return <span className="px-3 py-1 bg-zinc-100 text-zinc-700 rounded-full text-xs font-bold">{status}</span>
        }
    }

    const getInterventionBadge = (method: string) => {
        const colors: Record<string, string> = {
            'payment_holiday': 'bg-purple-100 text-purple-700',
            'restructuring': 'bg-indigo-100 text-indigo-700',
            'financial_counseling': 'bg-teal-100 text-teal-700',
            'rm_call': 'bg-orange-100 text-orange-700',
            'monitor_only': 'bg-zinc-100 text-zinc-600',
        }
        return (
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${colors[method] || 'bg-zinc-100 text-zinc-700'}`}>
                {method.replace(/_/g, ' ').toUpperCase()}
            </span>
        )
    }

    if (loading) return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="w-12 h-12 border-4 border-zinc-100 border-t-indigo-600 rounded-full animate-spin" />
        </div>
    )

    return (
        <div className="animate-fade-in pb-32 max-w-[1240px] mx-auto px-6 font-sans text-zinc-900 selection:bg-indigo-50 leading-tight">
            {/* Header */}
            <div className="pt-20 mb-16 flex flex-col md:flex-row justify-between items-end gap-10">
                <div className="space-y-4">
                    <div className="text-[10px] font-black uppercase tracking-[.4em] text-zinc-400">Manager Review</div>
                    <h1 className="text-5xl font-black tracking-tighter text-zinc-950 leading-none">Approval Queue</h1>
                </div>

                <button 
                    onClick={fetchPending}
                    className="flex items-center gap-2 px-4 py-2 bg-zinc-100 hover:bg-zinc-200 rounded-xl text-sm font-bold text-zinc-600 transition-all"
                >
                    <RefreshCw size={16} />
                    Refresh
                </button>
            </div>

            {/* Error State */}
            {error && (
                <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center gap-3">
                    <AlertCircle size={20} />
                    {error}
                </div>
            )}

            {/* Summary Cards */}
            {summary && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
                    <div className="bg-white p-6 rounded-2xl border border-zinc-100 shadow-sm">
                        <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">Pending</div>
                        <div className="text-4xl font-black text-blue-600">{summary.pending}</div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl border border-zinc-100 shadow-sm">
                        <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">High Risk</div>
                        <div className="text-4xl font-black text-red-600">{summary.by_risk_level.high}</div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl border border-zinc-100 shadow-sm">
                        <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">Voice Calls</div>
                        <div className="text-4xl font-black text-indigo-600">{summary.by_channel.voice}</div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl border border-zinc-100 shadow-sm">
                        <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">Executed</div>
                        <div className="text-4xl font-black text-emerald-600">{summary.executed}</div>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="flex flex-wrap gap-4 mb-12">
                {['PENDING', 'all', 'HIGH', 'MED', 'LOW', 'EXECUTED', 'REJECTED'].map((f) => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filter === f 
                            ? 'bg-zinc-950 text-white shadow-xl' 
                            : 'bg-zinc-50 text-zinc-400 hover:bg-zinc-100'}`}
                    >
                        {f}
                    </button>
                ))}
            </div>

            {/* Pending List */}
            <div className="space-y-4">
                {filtered.length === 0 ? (
                    <div className="py-20 text-center text-[11px] font-black uppercase tracking-widest text-zinc-300 italic">
                        No pending approvals
                    </div>
                ) : (
                    filtered.map((item) => (
                        <div
                            key={item.id}
                            className="bg-white p-8 rounded-2xl border border-zinc-100 shadow-sm hover:shadow-lg hover:border-zinc-200 transition-all"
                        >
                            <div className="flex items-start justify-between gap-8">
                                {/* Left: Customer Info */}
                                <div className="flex-1">
                                    <div className="flex items-center gap-4 mb-4">
                                        <div className="text-lg font-black text-zinc-900">{item.customer_id}</div>
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getRiskColor(item.risk_level)}`}>
                                            {item.risk_level} ({item.risk_score.toFixed(2)})
                                        </span>
                                        {getInterventionBadge(item.intervention_method)}
                                        <div className="flex items-center gap-1.5 text-zinc-400">
                                            {getChannelIcon(item.channel)}
                                            <span className="text-xs font-bold">{item.channel.toUpperCase()}</span>
                                        </div>
                                        {getStatusBadge(item.status)}
                                    </div>
                                    
                                    <p className="text-sm text-zinc-600 italic line-clamp-2 mb-4">
                                        "{item.message_preview}"
                                    </p>

                                    {item.compliance_status === 'HARDSTOP' && (
                                        <div className="flex items-center gap-2 text-red-600 text-xs font-bold mb-4">
                                            <AlertTriangle size={14} />
                                            Hard Stop: {item.hard_stop_reason}
                                        </div>
                                    )}
                                </div>

                                {/* Right: Actions */}
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => setSelectedItem(item)}
                                        className="flex items-center gap-2 px-4 py-2 bg-zinc-100 hover:bg-zinc-200 rounded-xl text-sm font-bold text-zinc-600 transition-all"
                                    >
                                        <Eye size={16} />
                                        Preview
                                    </button>

                                    {item.status === 'PENDING' && (
                                        <>
                                            <button
                                                onClick={() => handleApprove(item.id)}
                                                disabled={actionLoading === item.id}
                                                className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 rounded-xl text-sm font-bold text-white transition-all"
                                            >
                                                <CheckCircle2 size={16} />
                                                {actionLoading === item.id ? 'Approving...' : 'Approve'}
                                            </button>
                                            <button
                                                onClick={() => setShowRejectModal(item.id)}
                                                className="flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 rounded-xl text-sm font-bold text-red-600 transition-all"
                                            >
                                                <XCircle size={16} />
                                                Reject
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Preview Modal */}
            {selectedItem && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[80vh] overflow-y-auto shadow-2xl">
                        <div className="p-8 border-b border-zinc-100">
                            <div className="flex items-center justify-between">
                                <h2 className="text-2xl font-black text-zinc-900">Intervention Preview</h2>
                                <button
                                    onClick={() => setSelectedItem(null)}
                                    className="p-2 hover:bg-zinc-100 rounded-xl transition-all"
                                >
                                    <XCircle size={24} className="text-zinc-400" />
                                </button>
                            </div>
                        </div>

                        <div className="p-8 space-y-6">
                            {/* Customer Info */}
                            <div className="flex items-center gap-4">
                                <div className="text-xl font-black text-zinc-900">{selectedItem.customer_id}</div>
                                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getRiskColor(selectedItem.risk_level)}`}>
                                    {selectedItem.risk_level} ({selectedItem.risk_score.toFixed(2)})
                                </span>
                                {getInterventionBadge(selectedItem.intervention_method)}
                            </div>

                            {/* Channel & Status */}
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2 text-zinc-600">
                                    {getChannelIcon(selectedItem.channel)}
                                    <span className="font-bold">{selectedItem.channel.toUpperCase()}</span>
                                </div>
                                {getStatusBadge(selectedItem.status)}
                            </div>

                            {/* Justification */}
                            <div>
                                <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">Justification</div>
                                <p className="text-sm text-zinc-600">{selectedItem.intervention_justification}</p>
                            </div>

                            {/* Message Preview */}
                            <div>
                                <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">Message Preview</div>
                                <div className="p-4 bg-zinc-50 rounded-xl text-sm text-zinc-700 italic">
                                    "{selectedItem.message_preview}"
                                </div>
                            </div>

                            {/* Voice Script Preview */}
                            {selectedItem.voice_script_preview && (
                                <div>
                                    <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">Voice Script Preview</div>
                                    <div className="p-4 bg-indigo-50 rounded-xl text-sm text-indigo-700 whitespace-pre-line">
                                        {selectedItem.voice_script_preview}
                                    </div>
                                </div>
                            )}

                            {/* Compliance */}
                            {selectedItem.compliance_status === 'CLEAR' ? (
                                <div className="flex items-center gap-2 text-emerald-600 text-sm font-bold">
                                    <ShieldCheck size={18} />
                                    Compliance: CLEAR
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 text-red-600 text-sm font-bold">
                                    <AlertTriangle size={18} />
                                    {selectedItem.hard_stop_reason}
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        {selectedItem.status === 'PENDING' && (
                            <div className="p-8 border-t border-zinc-100 flex justify-end gap-4">
                                <button
                                    onClick={() => {
                                        setShowRejectModal(selectedItem.id)
                                        setSelectedItem(null)
                                    }}
                                    className="px-6 py-3 bg-red-50 hover:bg-red-100 rounded-xl text-sm font-bold text-red-600 transition-all"
                                >
                                    Reject
                                </button>
                                <button
                                    onClick={() => handleApprove(selectedItem.id)}
                                    className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 rounded-xl text-sm font-bold text-white transition-all"
                                >
                                    Approve & Execute
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Reject Modal */}
            {showRejectModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl">
                        <div className="p-8 border-b border-zinc-100">
                            <h2 className="text-xl font-black text-zinc-900">Reject Intervention</h2>
                            <p className="text-sm text-zinc-500 mt-1">Please provide a reason for rejection</p>
                        </div>

                        <div className="p-8">
                            <textarea
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                placeholder="Enter rejection reason..."
                                className="w-full h-32 p-4 bg-zinc-50 border border-zinc-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-500"
                            />
                        </div>

                        <div className="p-8 border-t border-zinc-100 flex justify-end gap-4">
                            <button
                                onClick={() => {
                                    setShowRejectModal(null)
                                    setRejectReason('')
                                }}
                                className="px-6 py-3 bg-zinc-100 hover:bg-zinc-200 rounded-xl text-sm font-bold text-zinc-600 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleReject(showRejectModal)}
                                disabled={actionLoading === showRejectModal}
                                className="px-6 py-3 bg-red-500 hover:bg-red-600 disabled:bg-red-300 rounded-xl text-sm font-bold text-white transition-all"
                            >
                                {actionLoading === showRejectModal ? 'Rejecting...' : 'Confirm Rejection'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
