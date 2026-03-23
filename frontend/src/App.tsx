import { Routes, Route } from 'react-router-dom'
import NavBar from './components/NavBar'
import Dashboard from './pages/Dashboard'
import LiveFeed from './pages/LiveFeed'
import CustomerJourney from './pages/CustomerJourney'
import PortfolioInsights from './pages/PortfolioInsights'
import ShockEvents from './pages/ShockEvents'
import Outreach from './pages/Outreach'
import Landing from './pages/Landing'
import { LiveFeedProvider } from './context/LiveFeedContext'

export default function App() {
  return (
    <div className="min-h-screen bg-[#f9f9f9]">
      <NavBar />
      <main className="pt-24 pb-12 px-6 max-w-screen-2xl mx-auto">
        <LiveFeedProvider>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/live" element={<LiveFeed />} />
            <Route path="/customer/:id" element={<CustomerJourney />} />
            <Route path="/portfolio" element={<PortfolioInsights />} />
            <Route path="/shocks" element={<ShockEvents />} />
            <Route path="/outreach" element={<Outreach />} />
          </Routes>
        </LiveFeedProvider>
      </main>
    </div>
  )
}
