import { motion } from 'framer-motion'
import { useState, useCallback } from 'react'
import { TokenCard } from '../components/TokenCard'
import { TOKENS } from '../config/tokens'
import type { TokenInfo } from '../hooks/useTokenInfo'

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
}

const cardVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] } },
}

type SortField = 'date' | 'mintsLeft'
type SortDir   = 'asc' | 'desc'

interface SortBtnProps {
  label: string
  field: SortField
  active: SortField
  dir: SortDir
  onClick: (f: SortField) => void
}

function SortBtn({ label, field, active, dir, onClick }: SortBtnProps) {
  const isActive = active === field
  const arrow = dir === 'asc' ? '↑' : '↓'
  return (
    <button
      onClick={() => onClick(field)}
      className={[
        'flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
        isActive
          ? 'bg-[#f7931a]/20 border border-[#f7931a]/40 text-[#f7931a]'
          : 'bg-white/5 border border-white/10 text-gray-400 hover:text-gray-200 hover:bg-white/10',
      ].join(' ')}
    >
      {label}
      <span className={isActive ? 'opacity-100' : 'opacity-30'}>{arrow}</span>
    </button>
  )
}

export default function OpMinter() {
  const [sortField, setSortField] = useState<SortField>('date')
  const [sortDir, setSortDir]     = useState<SortDir>('asc')
  const [liveInfo, setLiveInfo]   = useState<Record<string, TokenInfo>>({})

  const handleInfoLoaded = useCallback((tokenId: string, info: TokenInfo) => {
    setLiveInfo(prev => ({ ...prev, [tokenId]: info }))
  }, [])

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const getMintsLeft = (tokenId: string): bigint | null => {
    const token = TOKENS.find(t => t.id === tokenId)
    const info  = liveInfo[tokenId]
    if (!token || !info || token.mintPerCall === 0n) return null
    const remaining = info.maxSupply > info.totalSupply ? info.maxSupply - info.totalSupply : 0n
    return remaining / token.mintPerCall
  }

  const sortedTokens = [...TOKENS].sort((a, b) => {
    let cmp = 0
    if (sortField === 'date') {
      cmp = a.deployedAt - b.deployedAt
    } else {
      const la = getMintsLeft(a.id)
      const lb = getMintsLeft(b.id)
      // Tokens with no live data go to end
      if (la === null && lb === null) cmp = 0
      else if (la === null) cmp = 1
      else if (lb === null) cmp = -1
      else cmp = la < lb ? -1 : la > lb ? 1 : 0
    }
    return sortDir === 'asc' ? cmp : -cmp
  })

  return (
    <div className="relative min-h-[calc(100vh-4rem)] bg-grid pb-16 overflow-hidden">
      {/* Background glows */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[700px] h-[400px] rounded-full bg-[#f7931a]/4 blur-[140px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[300px] rounded-full bg-[#b75be3]/4 blur-[120px] pointer-events-none" />

      <div className="max-w-5xl mx-auto px-4 pt-12">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="text-center mb-8 space-y-4"
        >
          <h1 className="text-4xl md:text-5xl font-extrabold text-white">
            Mint on{' '}
            <span className="text-gradient">Bitcoin</span>
          </h1>
          <p className="text-gray-400 max-w-md mx-auto text-sm">
            Connect your OP_WALLET and mint OP-20 tokens directly on Bitcoin's L1
            smart contract platform.
          </p>
        </motion.div>

        {/* Sort controls */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="flex flex-wrap items-center gap-3 mb-8"
        >
          <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">Sort by</span>

          <SortBtn
            label="Deploy Date"
            field="date"
            active={sortField}
            dir={sortDir}
            onClick={handleSort}
          />

          <SortBtn
            label="Mints Left"
            field="mintsLeft"
            active={sortField}
            dir={sortDir}
            onClick={handleSort}
          />

          {/* Legend */}
          <span className="ml-auto text-xs text-gray-600">
            {sortDir === 'asc' ? '↑ ascending' : '↓ descending'}
            {sortField === 'date' && ' · oldest first'}
            {sortField === 'mintsLeft' && ' · fewest mints left first'}
            {sortDir === 'desc' && sortField === 'date' && ' · newest first'}
            {sortDir === 'desc' && sortField === 'mintsLeft' && ' · most mints left first'}
          </span>
        </motion.div>

        {/* Token Grid */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          key={`${sortField}-${sortDir}`}
        >
          {sortedTokens.map((token) => (
            <motion.div key={token.id} variants={cardVariants}>
              <TokenCard
                token={token}
                onInfoLoaded={handleInfoLoaded}
              />
            </motion.div>
          ))}
        </motion.div>

        {/* Footer links */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-10 flex flex-wrap justify-center gap-6 text-xs text-gray-600"
        >
          <a
            href="https://opnet.org"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-gray-400 transition-colors"
          >
            opnet.org ↗
          </a>
          <a
            href="https://mainnet.opnet.org"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-gray-400 transition-colors"
          >
            Explorer ↗
          </a>
        </motion.div>
      </div>
    </div>
  )
}
