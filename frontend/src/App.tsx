import { Routes, Route, useLocation } from 'react-router-dom'
import NavBar from './components/NavBar'
import Dashboard from './pages/Dashboard'
import IngestionStream from './pages/IngestionStream'
import PortfolioInsights from './pages/PortfolioInsights'
import ShockEvents from './pages/ShockEvents'
import Outreach from './pages/Outreach'
import Landing from './pages/Landing'
import Journey from './pages/Journey'
import CustomerDetailDashboard from './pages/CustomerDetailDashboard'
import ApprovalQueue from './pages/ApprovalQueue'
import BehaviouralFeatures from './pages/BehaviouralFeatures'
import { LiveFeedProvider } from './context/LiveFeedContext'

export default function App() {
  const location = useLocation()
  const isLanding = location.pathname === '/'

  return (
    <div className={`min-h-screen ${isLanding ? 'bg-white' : 'bg-[#f9f9f9]'}`}>
      {!isLanding && <NavBar />}
      <main className={isLanding ? '' : 'pt-24 pb-12 px-6 max-w-screen-2xl mx-auto'}>
        <LiveFeedProvider>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/live" element={<IngestionStream />} />
            <Route path="/customer/:customerId" element={<CustomerDetailDashboard />} />
            <Route path="/customer-detail/:customerId" element={<CustomerDetailDashboard />} />
            <Route path="/portfolio" element={<PortfolioInsights />} />
            <Route path="/shocks" element={<ShockEvents />} />
            <Route path="/outreach" element={<Outreach />} />
            <Route path="/approvals" element={<ApprovalQueue />} />
            <Route path="/journey/:id" element={<Journey />} />
            <Route path="/behaviour" element={<BehaviouralFeatures />} />
          </Routes>
        </LiveFeedProvider>
      </main>
    </div>
  )
}
