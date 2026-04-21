import { Routes, Route } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'
import AppBar from './components/AppBar'
import { StatsBar } from './components/StatsBar'
import { SettingsModal } from './components/SettingsModal'
import Home from './pages/Home'
import OpStrat from './pages/OpStrat'
import OpMinter from './pages/OpMinter'
import { SchoolHome } from './pages/school/SchoolHome'
import { SchoolModule } from './pages/school/SchoolModule'
import { SchoolGlossary } from './pages/school/SchoolGlossary'
import { About } from './pages/About'
import { useBtcPrice } from './hooks/useBtcPrice'
import { useBackgroundSnapshot } from './hooks/useBackgroundSnapshot'
import { usePositions } from './hooks/usePositions'
import { useAppStore } from './store'

function AppInner() {
  // Live BTC price & block polling via Slowphie Server
  useBtcPrice()
  // Position fetching runs app-wide — fires on every new block regardless of route
  const addresses = useAppStore(s => s.addresses)
  usePositions(addresses.map(a => a.address))
  // Snapshot runs app-wide — independent of active route
  useBackgroundSnapshot()

  return (
    <div className="min-h-screen flex flex-col bg-[#060a14]">
      <AppBar />
      <StatsBar />
      <SettingsModal />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/tracks" element={<OpStrat />} />
          <Route path="/minter" element={<OpMinter />} />
          <Route path="/school" element={<SchoolHome />} />
          <Route path="/school/module/:slug" element={<SchoolModule />} />
          <Route path="/school/glossary" element={<SchoolGlossary />} />
          <Route path="/about" element={<About />} />
        </Routes>
      </main>
      <Analytics />
    </div>
  )
}

export default function App() {
  return <AppInner />
}
