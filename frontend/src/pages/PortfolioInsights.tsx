import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { CustomerSummary } from '../types'
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'

const RISK_COLORS = { High: '#ef4444', Medium: '#f59e0b', Low: '#10b981' }

const PRODUCTS = ['Home Loan', 'Personal Loan', 'Credit Card', 'Auto Loan']

export default function PortfolioInsights() {
    const [customers, setCustomers] = useState<CustomerSummary[]>([])
    const [loading, setLoading] = useState(true)

    const [prodFilter, setProdFilter] = useState<string>('All')

    useEffect(() => {
        api.getCustomers()
            .then(setCustomers)
            .catch(console.error)
            .finally(() => setLoading(false))
    }, [])

    if (loading) return <div className="flex items-center justify-center min-h-[60vh] text-zinc-400 text-sm">Loading portfolio...</div>

    // Apply filters (geography is in full profile, not summary — we'll filter by product_type and segment)
    const filtered = customers.filter((c) => {
        if (prodFilter !== 'All' && c.product_type !== prodFilter) return false
        return true
    })

    // Risk by product
    const riskByProduct = PRODUCTS.map((p) => {
        const group = filtered.filter((c) => c.product_type === p)
        const avg = group.length ? group.reduce((s, c) => s + c.risk_score, 0) / group.length : 0
        return { product: p, avgRisk: Number(avg.toFixed(4)), count: group.length }
    })

    // Risk by segment
    const segments = ['Premium', 'Regular']
    const riskBySegment = segments.map((seg) => {
        const group = filtered.filter((c) => c.customer_segment === seg)
        const avg = group.length ? group.reduce((s, c) => s + c.risk_score, 0) / group.length : 0
        return { segment: seg, avgRisk: Number(avg.toFixed(4)), count: group.length }
    })

    // Risk distribution histogram
    const bins = Array.from({ length: 10 }, (_, i) => {
        const lo = i * 0.1
        const hi = lo + 0.1
        const count = filtered.filter((c) => c.risk_score >= lo && c.risk_score < hi).length
        return { range: `${lo.toFixed(1)}–${hi.toFixed(1)}`, count }
    })



    return (
        <div className="animate-fade-in-up">
            <div className="mb-8">
                <span className="text-[10px] uppercase tracking-widest font-bold text-[#737686] mb-1 block">Analytical Deep Dive</span>
                <h1 className="text-[1.75rem] font-bold tracking-tight text-zinc-900 leading-none">Portfolio Insights</h1>
            </div>

            {/* Filter bar */}
            <div className="bg-white rounded-2xl ghost-border shadow-sm p-4 mb-6 flex flex-wrap gap-4 items-center">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-400">Product:</span>
                    {['All', ...PRODUCTS].map((p) => (
                        <button
                            key={p}
                            onClick={() => setProdFilter(p)}
                            className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${prodFilter === p ? 'bg-[#004ac6] text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                                }`}
                        >{p}</button>
                    ))}
                </div>
                <div className="text-xs text-zinc-400 ml-auto tabular">{filtered.length} customers</div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Histogram */}
                <div className="bg-white rounded-2xl ghost-border shadow-sm p-6">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-[#737686] mb-4">Risk Score Distribution</h3>
                    <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={bins}>
                            <XAxis dataKey="range" tick={{ fontSize: 9 }} />
                            <YAxis tick={{ fontSize: 10 }} />
                            <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                                {bins.map((_b, i) => {
                                    const mid = i * 0.1 + 0.05
                                    const color = mid >= 0.7 ? '#ef4444' : mid >= 0.4 ? '#f59e0b' : '#10b981'
                                    return <Cell key={i} fill={color} />
                                })}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Risk by Product */}
                <div className="bg-white rounded-2xl ghost-border shadow-sm p-6">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-[#737686] mb-4">Avg Risk by Product Type</h3>
                    <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={riskByProduct} layout="vertical" margin={{ left: 80 }}>
                            <XAxis type="number" domain={[0, 1]} tick={{ fontSize: 10 }} />
                            <YAxis type="category" dataKey="product" tick={{ fontSize: 11, fontWeight: 500 }} width={80} />
                            <Tooltip formatter={(v) => Number(v).toFixed(4)} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                            <Bar dataKey="avgRisk" radius={[0, 4, 4, 0]}>
                                {riskByProduct.map((d, i) => {
                                    const color = d.avgRisk >= 0.7 ? '#ef4444' : d.avgRisk >= 0.4 ? '#f59e0b' : '#10b981'
                                    return <Cell key={i} fill={color} />
                                })}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Risk by Segment */}
                <div className="bg-white rounded-2xl ghost-border shadow-sm p-6">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-[#737686] mb-4">Risk by Customer Segment</h3>
                    <div className="flex items-end gap-8 justify-center h-[200px]">
                        {riskBySegment.map((s) => (
                            <div key={s.segment} className="flex flex-col items-center gap-2">
                                <div className="text-lg font-black tabular">{s.avgRisk.toFixed(4)}</div>
                                <div
                                    className="w-20 rounded-t-lg"
                                    style={{
                                        height: `${Math.max(20, s.avgRisk * 180)}px`,
                                        backgroundColor: s.avgRisk >= 0.7 ? '#ef4444' : s.avgRisk >= 0.4 ? '#f59e0b' : '#10b981',
                                    }}
                                />
                                <div className="text-xs font-semibold text-zinc-600">{s.segment}</div>
                                <div className="text-[10px] text-zinc-400">{s.count} customers</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Customer count by risk */}
                <div className="bg-white rounded-2xl ghost-border shadow-sm p-6">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-[#737686] mb-4">Risk Level Breakdown</h3>
                    <div className="space-y-4">
                        {(['High', 'Medium', 'Low'] as const).map((rl) => {
                            const count = filtered.filter((c) => c.risk_level === rl).length
                            const pct = filtered.length ? (count / filtered.length) * 100 : 0
                            return (
                                <div key={rl}>
                                    <div className="flex justify-between mb-1">
                                        <div className="flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: RISK_COLORS[rl] }} />
                                            <span className="text-sm font-semibold">{rl}</span>
                                        </div>
                                        <span className="text-sm font-bold tabular">{count} ({pct.toFixed(1)}%)</span>
                                    </div>
                                    <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: RISK_COLORS[rl] }} />
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>
        </div>
    )
}
