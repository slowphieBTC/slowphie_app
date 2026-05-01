import { motion } from 'framer-motion'
import { useState, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { TokenCard } from '../components/TokenCard'
import { TokenRow } from '../components/TokenRow'
import { TOKENS } from '../config/tokens'
import type { TokenInfo } from '../hooks/useTokenInfo'

const containerVariants = { hidden: {}, visible: { transition: { staggerChildren: 0.07 } } }
const cardVariants = { hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] } } }

type SortField = 'date' | 'mintsLeft'
type SortDir   = 'asc' | 'desc'
type Layout    = 'grid' | 'row'

interface SortBtnProps { label: string; field: SortField; active: SortField; dir: SortDir; onClick: (f: SortField) => void }

function SortBtn({ label, field, active, dir, onClick }: SortBtnProps) {
  const isActive = active === field
  const arrow = dir === 'asc' ? '↑' : '↓'
  return (
    <button onClick={() => onClick(field)} className={[
      'flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
      isActive ? 'bg-[#f7931a]/20 border border-[#f7931a]/40 text-[#f7931a]' : 'bg-white/5 border border-white/10 text-gray-400 hover:text-gray-200 hover:bg-white/10',
    ].join(' ')}>
      {label}<span className={isActive ? 'opacity-100' : 'opacity-30'}>{arrow}</span>
    </button>
  )
}

export default function OpMinter() {
  const { t } = useTranslation()
  const [sortField, setSortField] = useState<SortField>('date')
  const [sortDir, setSortDir]     = useState<SortDir>('asc')
  const [layout, setLayout]       = useState<Layout>(() => window.matchMedia('(max-width: 768px)').matches ? 'grid' : 'row')
  const [liveInfo, setLiveInfo]   = useState<Record<string, TokenInfo>>({})

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    const handler = (e: MediaQueryListEvent) => setLayout(e.matches ? 'grid' : 'row')
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const handleInfoLoaded = useCallback((tokenId: string, info: TokenInfo) => {
    setLiveInfo(prev => ({ ...prev, [tokenId]: info }))
  }, [])

  const handleSort = (field: SortField) => {
    if (field === sortField) { setSortDir(d => d === 'asc' ? 'desc' : 'asc') }
    else { setSortField(field); setSortDir('asc') }
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
    if (sortField === 'date') { cmp = a.deployedAt - b.deployedAt }
    else {
      const la = getMintsLeft(a.id); const lb = getMintsLeft(b.id)
      if (la === null && lb === null) cmp = 0
      else if (la === null) cmp = 1
      else if (lb === null) cmp = -1
      else cmp = la < lb ? -1 : la > lb ? 1 : 0
    }
    return sortDir === 'asc' ? cmp : -cmp
  })

  const legendText = (() => {
    if (sortDir === 'asc' && sortField === 'date') return `${t('minter.ascending')} ${t('minter.oldestFirst')}`
    if (sortDir === 'desc' && sortField === 'date') return `${t('minter.descending')} ${t('minter.newestFirst')}`
    if (sortDir === 'asc' && sortField === 'mintsLeft') return `${t('minter.ascending')} ${t('minter.fewestMintsFirst')}`
    return `${t('minter.descending')} ${t('minter.mostMintsFirst')}`
  })()

  return (
    <div className="relative min-h-[calc(100vh-4rem)] bg-grid pb-16 overflow-hidden">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[700px] h-[400px] rounded-full bg-[#f7931a]/4 blur-[140px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[300px] rounded-full bg-[#b75be3]/4 blur-[120px] pointer-events-none" />
      <div className="max-w-5xl mx-auto px-4 pt-12">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: 'easeOut' }} className="text-center mb-8 space-y-4">
          <h1 className="text-4xl md:text-5xl font-extrabold text-white">
            {t('minter.heroTitle')}{' '}<span className="text-gradient">{t('minter.heroGradient')}</span>
          </h1>
          <p className="text-gray-400 max-w-md mx-auto text-sm">{t('minter.heroSubtitle')}</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }} className="flex flex-wrap items-center gap-3 mb-8">
          <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">{t('minter.sortBy')}</span>
          <SortBtn label={t('minter.deployDate')} field="date" active={sortField} dir={sortDir} onClick={handleSort} />
          <SortBtn label={t('minter.mintsLeft')} field="mintsLeft" active={sortField} dir={sortDir} onClick={handleSort} />
          <span className="ml-auto text-xs text-gray-600">{legendText}</span>
          <button
            onClick={() => setLayout(l => l === 'grid' ? 'row' : 'grid')}
            className="ml-2 p-1.5 rounded-lg border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-all"
            title={layout === 'grid' ? t('minter.layoutRow') : t('minter.layoutGrid')}
          >
            {layout === 'grid' ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zM2 10a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 10zm0 5.25a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M4.5 2A2.5 2.5 0 002 4.5v2a2.5 2.5 0 005 0v-2A2.5 2.5 0 004.5 2zM15.5 2A2.5 2.5 0 0013 4.5v2a2.5 2.5 0 005 0v-2A2.5 2.5 0 0015.5 2zM4.5 13A2.5 2.5 0 002 15.5v2a2.5 2.5 0 005 0v-2A2.5 2.5 0 004.5 13zM15.5 13a2.5 2.5 0 00-2.5 2.5v2a2.5 2.5 0 005 0v-2a2.5 2.5 0 00-2.5-2.5z" />
              </svg>
            )}
          </button>
        </motion.div>

        {layout === 'grid' ? (
          <motion.div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" variants={containerVariants} initial="hidden" animate="visible" key={`${sortField}-${sortDir}`}>
            {sortedTokens.map((token) => (
              <motion.div key={token.id} variants={cardVariants}>
                <TokenCard token={token} sortField={sortField} mintsLeft={getMintsLeft(token.id)} onInfoLoaded={handleInfoLoaded} />
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
            <div className="glass rounded-2xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10 text-xs text-gray-500 uppercase tracking-wider">
                    <th className="py-3 px-4 text-left">{t('minter.token')}</th>
                    {sortField === 'date' && <th className="py-3 px-4 text-left">{t('minter.deployDate')}</th>}
                    {sortField === 'mintsLeft' && <th className="py-3 px-4 text-left">{t('minter.mintsLeft')}</th>}
                    <th className="py-3 px-4 text-left">{t('minter.progress')}</th>
                    <th className="py-3 px-4 text-left hidden md:table-cell">{t('minter.perMint')}</th>
                    <th className="py-3 px-4 text-left hidden lg:table-cell">{t('minter.yourBalance')}</th>
                    <th className="py-3 px-4 text-right">{t('minter.action')}</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTokens.map((token) => (
                    <TokenRow key={token.id} token={token} sortField={sortField} mintsLeft={getMintsLeft(token.id)} onInfoLoaded={handleInfoLoaded} />
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="mt-10 flex flex-wrap justify-center gap-6 text-xs text-gray-600">
          <a href="https://opnet.org" target="_blank" rel="noopener noreferrer" className="hover:text-gray-400 transition-colors">opnet.org ↗</a>
          <a href="https://opscan.org/tokens?network=mainnet" target="_blank" rel="noopener noreferrer" className="hover:text-gray-400 transition-colors">Explorer ↗</a>
        </motion.div>
      </div>
    </div>
  )
}
