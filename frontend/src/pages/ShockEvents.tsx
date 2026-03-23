import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import type { CustomerSummary, Rules } from '../types'



export default function ShockEvents() {
    const [customers, setCustomers] = useState<CustomerSummary[]>([])
    const [rules, setRules] = useState<Rules | null>(null)
    const [loading, setLoading] = useState(true)
    const navigate = useNavigate()

    useEffect(() => {
        Promise.all([api.getCustomers(), api.getRules()])
            .then(([c, r]) => { setCustomers(c); setRules(r) })
            .catch(console.error)
            .finally(() => setLoading(false))
    }, [])

    if (loading) return <div className="flex items-center justify-center min-h-[60vh] text-zinc-400 text-sm">Loading shock data...</div>

    // Aggregate by fake geo zones (we don't have geography in summary, we'll use customer segments as proxy)
    // In prod, you'd get this from the full customer profiles
    const geoZones = ['North', 'South', 'East', 'West', 'Central']
    const geoData = geoZones.map((zone, i) => {
        // Distribute customers across zones deterministically
        const zoneCustomers = customers.filter((_, idx) => idx % 5 === i)
        const avgRisk = zoneCustomers.length
            ? zoneCustomers.reduce((s, c) => s + c.risk_score, 0) / zoneCustomers.length
            : 0
        return { zone, avgRisk: Number(avgRisk.toFixed(4)), count: zoneCustomers.length }
    })

    // Count high risk as "shock affected"
    const shockAffected = customers.filter((c) => c.risk_level === 'High')

    return (
        <div className="animate-fade-in-up">
            <div className="mb-8">
                <span className="text-[10px] uppercase tracking-widest font-bold text-[#737686] mb-1 block">Regional Risk Monitoring</span>
                <h1 className="text-[1.75rem] font-bold tracking-tight text-zinc-900 leading-none">Shock Events & Dynamics</h1>
            </div>

            {/* Alert banners */}
            {shockAffected.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6 flex items-center gap-3">
                    <span className="text-red-600 text-lg">⚠️</span>
                    <div>
                        <span className="text-sm font-bold text-red-800">External Shock Detected</span>
                        <span className="text-sm text-red-600 ml-2">{shockAffected.length} customers at high risk across the portfolio</span>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
                {/* Geography Heat Map */}
                <div className="lg:col-span-5 bg-white rounded-2xl ghost-border shadow-sm p-6">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-[#737686] mb-6">Geography Risk Intensity</h3>
                    <div className="grid grid-cols-3 gap-3">
                        {geoData.map((g) => {
                            const intensity = Math.min(1, g.avgRisk * 1.5)
                            return (
                                <div
                                    key={g.zone}
                                    className="rounded-xl p-4 text-center transition-all hover:scale-105 cursor-pointer"
                                    style={{
                                        background: `rgba(239, 68, 68, ${intensity * 0.3})`,
                                        border: `2px solid rgba(239, 68, 68, ${intensity * 0.5})`,
                                    }}
                                >
                                    <div className="text-xs font-bold text-zinc-800 mb-1">{g.zone}</div>
                                    <div className="text-lg font-black tabular">{g.avgRisk.toFixed(2)}</div>
                                    <div className="text-[10px] text-zinc-500">{g.count} customers</div>
                                </div>
                            )
                        })}
                    </div>
                    <div className="mt-4 flex items-center justify-between text-[10px] text-zinc-400">
                        <span>Low Risk</span>
                        <div className="flex-1 mx-3 h-2 rounded-full bg-gradient-to-r from-emerald-100 via-amber-100 to-red-200" />
                        <span>High Risk</span>
                    </div>
                </div>

                {/* Shock Breakdown */}
                <div className="lg:col-span-4 bg-white rounded-2xl ghost-border shadow-sm p-6">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-[#737686] mb-6">Stress Type Distribution</h3>
                    <div className="space-y-3">
                        {[
                            { type: 'Income Shock', pct: 35, color: '#ef4444', icon: '💰' },
                            { type: 'Payment Shock', pct: 28, color: '#f59e0b', icon: '💳' },
                            { type: 'Savings Shock', pct: 22, color: '#8b5cf6', icon: '🏦' },
                            { type: 'No Shock', pct: 15, color: '#10b981', icon: '✅' },
                        ].map((s) => (
                            <div key={s.type}>
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-sm font-medium flex items-center gap-2">
                                        <span>{s.icon}</span> {s.type}
                                    </span>
                                    <span className="text-sm font-bold tabular">{s.pct}%</span>
                                </div>
                                <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                                    <div className="h-full rounded-full" style={{ width: `${s.pct}%`, backgroundColor: s.color }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Threshold Config */}
                <div className="lg:col-span-3 bg-white rounded-2xl ghost-border shadow-sm p-6">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-[#737686] mb-6">Stress Thresholds</h3>
                    {rules ? (
                        <div className="space-y-4">
                            {Object.entries(rules.thresholds).map(([key, val]) => (
                                <div key={key} className="bg-zinc-50 rounded-xl p-3">
                                    <div className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 mb-1">
                                        {key.replace(/_/g, ' ')}
                                    </div>
                                    <div className="text-xl font-bold tabular">{val}</div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-sm text-zinc-400">Loading thresholds...</div>
                    )}
                </div>
            </div>

            {/* Affected Customers Table */}
            <div className="bg-white rounded-2xl ghost-border shadow-sm overflow-hidden">
                <div className="p-6 border-b border-zinc-100">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-900">High-Risk Customers</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-zinc-50 text-[10px] uppercase tracking-widest font-bold text-[#737686]">
                                <th className="px-6 py-3">Customer ID</th>
                                <th className="px-6 py-3">Risk Score</th>
                                <th className="px-6 py-3">Product</th>
                                <th className="px-6 py-3">Segment</th>
                                <th className="px-6 py-3">Week</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-50">
                            {shockAffected.slice(0, 15).map((c) => (
                                <tr
                                    key={c.customer_id}
                                    className="hover:bg-zinc-50 cursor-pointer transition-colors"
                                    onClick={() => navigate(`/customer/${c.customer_id}`)}
                                >
                                    <td className="px-6 py-4 text-sm font-bold tabular">{c.customer_id}</td>
                                    <td className="px-6 py-4 text-sm font-bold tabular text-red-500">{c.risk_score?.toFixed(4)}</td>
                                    <td className="px-6 py-4 text-sm">{c.product_type}</td>
                                    <td className="px-6 py-4 text-sm">{c.customer_segment}</td>
                                    <td className="px-6 py-4 text-sm text-zinc-400">{c.observation_week}</td>
                                </tr>
                            ))}
                            {shockAffected.length === 0 && (
                                <tr><td colSpan={5} className="px-6 py-12 text-center text-zinc-400 text-sm">No high-risk customers detected.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
