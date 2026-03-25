import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import type { CustomerSummary, Rules } from '../types'
import {
    ShieldAlert,
    ArrowUpRight,
    Search,
    ChevronRight,
    Activity,
    Globe,
    Zap,
    Lock
} from 'lucide-react'

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

    if (loading) return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="w-12 h-12 border-4 border-zinc-100 border-t-indigo-600 rounded-full animate-spin" />
        </div>
    )

    const geoZones = ['North', 'South', 'East', 'West', 'Central']
    const geoData = geoZones.map((zone, i) => {
        const zoneCustomers = customers.filter((_, idx) => idx % 5 === i)
        const avgRisk = zoneCustomers.reduce((s, c) => s + c.risk_score, 0) / (zoneCustomers.length || 1)
        return { zone, avgRisk, count: zoneCustomers.length }
    })

    const highRisk = customers.filter(c => c.risk_level === 'High')

    return (
        <div className="animate-fade-in pb-32 max-w-[1240px] mx-auto px-6 font-sans text-zinc-900 selection:bg-indigo-50 leading-tight">

            {/* Header */}
            <div className="pt-20 mb-16 flex flex-col md:flex-row justify-between items-end gap-10">
                <div className="space-y-4">
                    <div className="text-[10px] font-black uppercase tracking-[.4em] text-zinc-400">External Dynamics</div>
                    <h1 className="text-5xl font-black tracking-tighter text-zinc-950 leading-none">Shock Monitor</h1>
                </div>

                <div className="flex items-center gap-6">
                    <div className="px-5 py-2 bg-red-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 animate-pulse shadow-xl shadow-red-500/20">
                        <ShieldAlert size={14} /> Global Alert Active
                    </div>
                </div>
            </div>

            {/* Analysis Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 mb-20">

                {/* Geographic Risk Heatmap (Abstract) */}
                <div className="lg:col-span-8 bg-zinc-950 rounded-[3rem] p-12 shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-12 opacity-5">
                        <Globe size={300} strokeWidth={1} />
                    </div>

                    <div className="relative z-10 space-y-2 mb-16">
                        <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Spatial Topology</div>
                        <h3 className="text-3xl font-black text-white uppercase tracking-tight">Regional Risk Intensity</h3>
                    </div>

                    <div className="relative z-10 grid grid-cols-5 gap-6">
                        {geoData.map((g, i) => {
                            const intensity = Math.min(1, g.avgRisk * 1.5)
                            return (
                                <div key={i} className="flex flex-col gap-4 group/box">
                                    <div
                                        className="aspect-[3/4] rounded-2xl border transition-all duration-700 flex flex-col items-center justify-center gap-2 group-hover/box:scale-105"
                                        style={{
                                            background: `rgba(239, 68, 68, ${intensity * 0.4})`,
                                            borderColor: `rgba(239, 68, 68, ${intensity * 0.6})`
                                        }}
                                    >
                                        <div className="text-2xl font-black text-white tabular">{Math.round(g.avgRisk * 100)}%</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-[9px] font-black uppercase text-zinc-500 tracking-widest">{g.zone}</div>
                                        <div className="text-[10px] font-bold text-zinc-700">{g.count} Hubs</div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Threshold Logic Sidebar */}
                <div className="lg:col-span-4 bg-white rounded-[3rem] p-10 border border-zinc-100 shadow-sm space-y-12">
                    <div className="space-y-2 text-right">
                        <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Policy Engine</div>
                        <h3 className="text-2xl font-black text-zinc-950 uppercase tracking-tight">System Guardrails</h3>
                    </div>

                    {rules ? (
                        <div className="space-y-6">
                            {Object.entries(rules.thresholds).map(([key, val], i) => (
                                <div key={key} className="p-6 bg-zinc-50 rounded-2xl border border-transparent hover:border-zinc-100 transition-all group">
                                    <div className="flex justify-between items-center mb-1">
                                        <div className="text-[9px] font-black uppercase tracking-widest text-zinc-400">{key.replace('_', ' ')}</div>
                                        <div className="text-zinc-200 group-hover:text-indigo-600 transition-colors"><Zap size={10} fill="currentColor" /></div>
                                    </div>
                                    <div className="text-2xl font-black tabular tracking-tight">{val}</div>
                                </div>
                            ))}
                        </div>
                    ) : null}
                </div>

            </div>

            {/* High Impact Table Cleanup */}
            <div className="bg-white rounded-[3rem] border border-zinc-100 shadow-sm overflow-hidden group hover:shadow-2xl transition-all">
                <div className="p-12 border-b border-zinc-50 flex justify-between items-end">
                    <div className="space-y-2">
                        <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Critical Segments</div>
                        <h3 className="text-3xl font-black text-zinc-950 uppercase tracking-tight">Active Shock Response List</h3>
                    </div>
                    <div className="text-[11px] font-black uppercase tracking-widest text-zinc-300 italic">{highRisk.length} Records Detected</div>
                </div>
                <div className="p-6">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="text-[10px] font-black uppercase tracking-[.25em] text-zinc-300">
                                <th className="px-8 py-6">Identity Node</th>
                                <th className="px-8 py-6 text-center">Ensemble Score</th>
                                <th className="px-8 py-6 text-center">Product Vector</th>
                                <th className="px-8 py-6 text-right">Intervention Trace</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-50">
                            {highRisk.slice(0, 8).map((c, i) => (
                                <tr
                                    key={i}
                                    onClick={() => navigate(`/customer/${c.customer_id}`)}
                                    className="group/row hover:bg-zinc-50 cursor-pointer transition-colors"
                                >
                                    <td className="px-8 py-8">
                                        <div className="text-sm font-black text-zinc-950 italic">{c.customer_id}</div>
                                        <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{c.customer_segment}</div>
                                    </td>
                                    <td className="px-8 py-8 text-center text-xl font-black tabular text-red-500 group-hover/row:scale-110 transition-transform">
                                        {Math.round(c.risk_score * 100)}%
                                    </td>
                                    <td className="px-8 py-8 text-center text-[10px] font-black uppercase tracking-widest text-zinc-500 italic">
                                        {c.product_type}
                                    </td>
                                    <td className="px-8 py-8 text-right">
                                        <button className="h-10 w-10 bg-zinc-900 text-white rounded-xl flex items-center justify-center ml-auto group-hover/row:bg-red-500 transition-colors">
                                            <ChevronRight size={16} strokeWidth={4} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
    )
}
