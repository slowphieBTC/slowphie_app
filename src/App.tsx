import { useCallback } from 'react'
import { Routes, Route } from 'react-router-dom'
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
import { useBlockFeedStream } from './hooks/useWebSocket'
import { useAppStore } from './store'
import type { StreamEvent } from './hooks/useWebSocket'

function AppInner() {
  const setLatestBlock = useAppStore((s) => s.setLatestBlock)
  const addBlockPoint  = useAppStore((s) => s.addBlockPoint)

  // Live BTC price polling
  useBtcPrice()

  // Live WebSocket stream
  useBlockFeedStream(useCallback((event: StreamEvent) => {
    if (event.type === 'block') {
      setLatestBlock({ height: event.height, timestamp: event.timestamp })
      addBlockPoint({ time: event.timestamp, height: event.height, txCount: event.transactions })
    }
  }, [setLatestBlock, addBlockPoint]))

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
    </div>
  )
}

export default function App() {
  return <AppInner />
}
