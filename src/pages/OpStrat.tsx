import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, Wallet, Settings, TrendingUp, Droplets, Coins, Sparkles, Leaf, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store';
import { usePositions } from '../hooks/usePositions';
import { PositionCard } from '../components/PositionCard';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
import { TokenTotalsCard } from '../components/TokenTotalsCard';
import type { TotalsUnit } from '../components/TokenTotalsCard';
import { TokenEvolutionsCard } from '../components/TokenEvolutionsCard';
import { useTokenVisibility } from '../hooks/useTokenVisibility';
import { BTC_NATIVE } from '../lib/coreTokens';
import type { Position } from '../types';

type FilterType = 'stake' | 'harvest' | 'lp' | 'token' | 'custom';

const BADGE_CONFIG: Record<FilterType, { icon: React.ElementType; color: string; bg: string; activeBg: string }> = {
  stake:   { icon: TrendingUp, color: 'text-brand-400',  bg: 'bg-brand-500/10 border-brand-500/20',   activeBg: 'bg-brand-500/30 border-brand-400/60'   },
  harvest: { icon: Leaf,       color: 'text-green-400',  bg: 'bg-green-500/10 border-green-500/20',   activeBg: 'bg-green-500/30 border-green-400/60'   },
  lp:      { icon: Droplets,   color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/20',     activeBg: 'bg-blue-500/30 border-blue-400/60'     },
  token:   { icon: Coins,      color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20', activeBg: 'bg-yellow-500/30 border-yellow-400/60' },
  custom:  { icon: Sparkles,   color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20', activeBg: 'bg-purple-500/30 border-purple-400/60' },
};

function FilterBadge({ count, type, active, onClick }: { count: number; type: FilterType; active: boolean; onClick: () => void }) {
  const { t } = useTranslation();
  const { icon: Icon, color, bg, activeBg } = BADGE_CONFIG[type];
  const label = t(`tracks.badges.${type}`);
  return (
    <button onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all duration-150 ${active ? activeBg : bg} ${active ? 'ring-1 ring-offset-1 ring-offset-dark-900 ring-current opacity-100' : 'opacity-80 hover:opacity-100'} ${color}`}>
      <Icon className="w-3.5 h-3.5" />
      <span className="text-xs font-semibold">{count} {label}</span>
    </button>
  );
}

function matchesFilter(p: Position, type: FilterType): boolean {
  switch (type) {
    case 'stake': return p.type === 'stake' || (p.type === 'farm' && (p.farms?.some(f => f.staked > 0) ?? false));
    case 'lp': return p.type === 'lp';
    case 'harvest': return (
      (p.rewards > 0) ||
      (p.farms?.some(f => f.pending > 0) ?? false) ||
      (p.stakingRewards?.some(r => r.pending > 0) ?? false) ||
      ((p as any).mchadStaking?.positions?.some((pos: any) => parseFloat(pos.unclaimedRewardsFormatted) > 0) ?? false) ||
      (!!(p as any).mchadLpStaking && parseFloat((p as any).mchadLpStaking.unclaimedRewardsFormatted) > 0)
    );
    case 'token': return p.type === 'farm' && !(p.farms?.some(f => f.staked > 0 || f.pending > 0) ?? false);
    case 'custom': return !!(p as any).mchadStaking || !!(p as any).mchadLpStaking;
  }
}

export default function OpStrat() {
  const { t } = useTranslation();
  const addresses       = useAppStore((s) => s.addresses);
  const setSettingsOpen = useAppStore((s) => s.setSettingsOpen);
  const { positions, loading, refreshing, error, refresh } = usePositions(addresses.map(a => a.address));
  const [activeFilters, setActiveFilters] = useState<Set<FilterType>>(new Set());
  const [selectedToken, setSelectedToken] = useState<string | null>(null);
  const [chartOpen, setChartOpen] = useState(false);
  const [unit, setUnit] = useState<TotalsUnit>('amount');
  useEffect(() => {
    document.body.style.overflow = chartOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [chartOpen]);
  const visibility = useTokenVisibility();

  const toggleFilter = (type: FilterType) => {
    setActiveFilters(prev => { const next = new Set(prev); next.has(type) ? next.delete(type) : next.add(type); return next; });
  };
  const clearFilters = () => setActiveFilters(new Set());
  const hasFilter = activeFilters.size > 0;

  const stakeCount  = positions.filter((p: Position) => matchesFilter(p, 'stake')).length;
  const lpCount     = positions.filter((p: Position) => matchesFilter(p, 'lp')).length;
  const farmCount   = positions.filter((p: Position) => matchesFilter(p, 'harvest')).length;
  const tokenCount  = positions.filter((p: Position) => matchesFilter(p, 'token')).length;
  const customCount = positions.filter((p: Position) => matchesFilter(p, 'custom')).length;

  if (addresses.length === 0) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
        <div className="max-w-6xl w-full mx-auto">
          <EmptyState icon={Wallet} title={t('tracks.noAddressesTitle')} description={t('tracks.noAddressesDesc')}
            action={<button onClick={() => setSettingsOpen(true)} className="btn-primary flex items-center gap-2"><Settings className="w-4 h-4" />{t('tracks.openSettings')}</button>} />
        </div>
      </div>
    );
  }

  const positionsByAddress = addresses.map((addr) => {
    const addrPositions = positions.filter((p: Position) => p.address === addr.address);
    const filtered = hasFilter ? addrPositions.filter(p => Array.from(activeFilters).some(f => matchesFilter(p, f))) : addrPositions;
    return { addr, positions: addrPositions, filtered };
  });

  return (
    <div className="min-h-[calc(100vh-4rem)] pb-16 px-4 pt-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: 'easeOut' }} className="text-center space-y-4 pb-4">
          <h1 className="text-4xl md:text-5xl font-extrabold text-white">
            {t('tracks.heroTitle')}{' '}<span className="text-gradient">{t('tracks.heroGradient')}</span>
          </h1>
          <p className="text-gray-400 max-w-md mx-auto text-sm">{t('tracks.heroSubtitle')}</p>
        </motion.div>

        {positions.length > 0 && <TokenTotalsCard positions={positions} selectedToken={selectedToken} onSelectToken={(addr) => { if (addr) { setSelectedToken(addr); visibility.selectOnly(addr); } else { setSelectedToken(null); visibility.reset(); } }} onOpenChart={() => setChartOpen(true)} unit={unit} onUnitChange={setUnit} />}

        {/* Token Evolutions Chart Popup */}
        {positions.length > 0 && chartOpen && createPortal(
          <div
            onClick={() => setChartOpen(false)}
            style={{ background: 'rgba(3, 7, 30, 0.82)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
            className="fixed inset-0 z-[998] flex items-center justify-center p-4 sm:p-6">
            <div
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-5xl max-h-[92vh] overflow-hidden rounded-2xl flex flex-col"
              style={{ background: 'linear-gradient(160deg, #0d1526f8 0%, #080e1ef8 100%)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 30px 60px -10px rgba(0,0,0,0.8)' }}>
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07] shrink-0">
                <span className="text-sm font-semibold text-dark-300 uppercase tracking-wider">Token Evolutions</span>
                <button onClick={() => setChartOpen(false)} className="p-2 rounded-xl hover:bg-white/10 text-slate-500 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              {/* Chart body */}
              <div className="overflow-y-auto flex-1 p-4">
                <TokenEvolutionsCard selectedToken={selectedToken} onClearSelection={() => { setSelectedToken(null); visibility.reset(); }} onDeselectCard={() => setSelectedToken(null)} visibility={visibility} />
              </div>
            </div>
          </div>,
          document.body
        )}

        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white"><span className="text-gradient">{t('tracks.sectionTitle')}</span></h1>
            <p className="text-sm text-gray-500 mt-1">
              {addresses.length === 1 ? t('tracks.addressCount_one', { count: 1 }) : t('tracks.addressCount_other', { count: addresses.length })}
              {' · '}
              {positions.length === 1 ? t('tracks.positionCount_one', { count: 1 }) : t('tracks.positionCount_other', { count: positions.length })}
              {hasFilter && <span className="ml-2 text-brand-400 font-medium">· {t('tracks.shownCount', { count: positionsByAddress.reduce((s, g) => s + g.filtered.length, 0) })}</span>}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {stakeCount  > 0 && <FilterBadge count={stakeCount}  type="stake"   active={activeFilters.has('stake')}   onClick={() => toggleFilter('stake')}   />}
            {lpCount     > 0 && <FilterBadge count={lpCount}     type="lp"      active={activeFilters.has('lp')}      onClick={() => toggleFilter('lp')}      />}
            {farmCount   > 0 && <FilterBadge count={farmCount}   type="harvest" active={activeFilters.has('harvest')} onClick={() => toggleFilter('harvest')} />}
            {tokenCount  > 0 && <FilterBadge count={tokenCount}  type="token"   active={activeFilters.has('token')}   onClick={() => toggleFilter('token')}   />}
            {customCount > 0 && <FilterBadge count={customCount} type="custom"  active={activeFilters.has('custom')}  onClick={() => toggleFilter('custom')}  />}
            {hasFilter && (
              <button onClick={clearFilters} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-white/20 bg-white/5 text-gray-400 hover:text-white hover:border-white/40 transition-all text-xs font-semibold" title={t('tracks.filterClearTitle')}>
                <X className="w-3.5 h-3.5" />{t('tracks.clearFilters')}
              </button>
            )}
            <button onClick={() => setSettingsOpen(true)} className="btn-ghost flex items-center gap-1.5 text-sm"><Settings className="w-3.5 h-3.5" />{t('common.settings')}</button>
            <button onClick={refresh} disabled={loading || refreshing} className="btn-ghost flex items-center gap-1.5 text-sm disabled:opacity-50">
              <RefreshCw className={`w-3.5 h-3.5 transition-transform ${(loading || refreshing) ? 'animate-spin' : ''}`} />
              {refreshing ? t('common.refreshing') : t('common.refresh')}
            </button>
          </div>
        </motion.div>

        {loading && positions.length === 0 && (
          <div className="glass rounded-2xl p-10 flex items-center justify-center">
            <LoadingSpinner label={t('tracks.fetchingPositions')} />
          </div>
        )}

        {!loading && error && (
          <div className="glass rounded-2xl p-6 border border-red-500/20 bg-red-500/5">
            <p className="text-sm text-red-400 font-medium">{t('tracks.failedToLoad')}</p>
            <p className="text-xs text-gray-600 mt-1">{error}</p>
          </div>
        )}

        <div className="space-y-10">
          <AnimatePresence>
            {positionsByAddress.map(({ addr, positions: addrPositions, filtered }) => {
              if (hasFilter && filtered.length === 0) return null;
              return (
                <motion.section key={addr.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-9 h-9 bg-gradient-to-br from-brand-400/20 to-brand-600/20 border border-brand-500/20 rounded-xl flex items-center justify-center">
                      <Wallet className="w-4 h-4 text-brand-400" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white">{addr.label}</div>
                      <div className="text-xs font-mono text-gray-500">{addr.address.slice(0, 12)}...{addr.address.slice(-10)}</div>
                    </div>
                  </div>
                  {loading && addrPositions.length === 0 && (
                    <div className="glass rounded-2xl p-10 flex items-center justify-center">
                      <LoadingSpinner label={t('tracks.fetchingPositions')} />
                    </div>
                  )}
                  {!loading && addrPositions.length === 0 && (
                    <div className="glass rounded-2xl p-8 text-center">
                      <p className="text-sm text-gray-500">{t('tracks.noPositions')}</p>
                      <p className="text-xs text-gray-600 mt-1">{t('tracks.noPositionsHint')}</p>
                    </div>
                  )}
                  {filtered.length > 0 && (
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <AnimatePresence>
                        {filtered.map((pos: Position, i: number) => (
                          <motion.div key={`${pos.id}-${i}`} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.15, delay: i * 0.03 }}>
                            <PositionCard position={pos} index={i} unit={unit} />
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  )}
                </motion.section>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
