import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { api } from '../api/client'

const links = [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/live', label: 'Live Stream' },
    { to: '/portfolio', label: 'Customer Dashboard' },
    { to: '/outreach', label: 'Outreach Dashboard' },
    { to: '/shocks', label: 'Shock Events' },
]

export default function NavBar() {
    const location = useLocation()
    const isLanding = location.pathname === '/'
    const [pendingCount, setPendingCount] = useState(0)

    useEffect(() => {
        const fetchPendingCount = async () => {
            try {
                const response = await api.getPendingApprovals()
                setPendingCount(response.summary.pending)
            } catch (err) {
                console.error('Failed to fetch pending count:', err)
            }
        }

        fetchPendingCount()
        const interval = setInterval(fetchPendingCount, 30000)
        return () => clearInterval(interval)
    }, [])

    return (
        <header className="fixed top-0 w-full z-50 border-b border-zinc-200/50 bg-white/80 backdrop-blur-xl shadow-sm h-16">
            <div className="flex items-center justify-between px-6 h-full max-w-screen-2xl mx-auto">
                <div className="flex items-center gap-8">
                    <NavLink to="/" className="text-xl font-bold tracking-tighter text-zinc-900">
                        HoH
                    </NavLink>
                    {!isLanding && (
                        <nav className="hidden md:flex items-center gap-6 text-sm font-medium tracking-tight">
                            {links.map((l) => (
                                <NavLink
                                    key={l.to}
                                    to={l.to}
                                    className={({ isActive }) =>
                                        `pb-4 -mb-[17px] transition-colors ${isActive
                                            ? 'text-zinc-900 border-b-2 border-blue-600'
                                            : 'text-zinc-500 hover:text-zinc-900'
                                        }`
                                    }
                                >
                                    {l.label}
                                </NavLink>
                            ))}
                            
                            {/* Approval Queue with Badge */}
                            <NavLink
                                to="/approvals"
                                className={({ isActive }) =>
                                    `pb-4 -mb-[17px] transition-colors flex items-center gap-2 ${isActive
                                        ? 'text-zinc-900 border-b-2 border-emerald-500'
                                        : 'text-zinc-500 hover:text-zinc-900'
                                    }`
                                }
                            >
                                Approval Queue
                                {pendingCount > 0 && (
                                    <span className="px-2 py-0.5 bg-emerald-500 text-white text-[10px] font-bold rounded-full min-w-[20px] text-center">
                                        {pendingCount > 99 ? '99+' : pendingCount}
                                    </span>
                                )}
                            </NavLink>
                        </nav>
                    )}
                </div>
                <div className="flex items-center gap-4">
                    {/* Mobile Approval Queue Badge */}
                    {!isLanding && pendingCount > 0 && (
                        <NavLink
                            to="/approvals"
                            className="md:hidden flex items-center gap-2 px-3 py-1.5 bg-emerald-500 text-white rounded-full text-xs font-bold"
                        >
                            <span>Approvals</span>
                            <span className="px-1.5 py-0.5 bg-white/20 rounded-full">
                                {pendingCount}
                            </span>
                        </NavLink>
                    )}
                    <NavLink
                        to="/live"
                        className="bg-[#004ac6] text-white px-4 py-1.5 rounded-full text-sm font-medium hover:shadow-md transition-all active:scale-95 flex items-center gap-2"
                    >
                        <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                        Live
                    </NavLink>
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                        RM
                    </div>
                </div>
            </div>
        </header>
    )
}
