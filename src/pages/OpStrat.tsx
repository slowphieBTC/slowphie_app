import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, Wallet, Settings, TrendingUp, Droplets, Coins, Sparkles, Leaf, X } from 'lucide-react';
import { useAppStore } from '../store';
import { usePositions } from '../hooks/usePositions';
import { PositionCard } from '../components/PositionCard';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
import { TokenTotalsCard } from '../components/TokenTotalsCard';
import type { Position } from '../types';

type FilterType = 'stake' | 'harvest' | 'lp' | 'token' | 'custom';

const BADGE_CONFIG: Record<FilterType, { icon: React.ElementType; label: string; color: string; bg: string; activeBg: string }> = {
  stake:   { icon: TrendingUp, label: 'Stake',   color: 'text-brand-400',  bg: 'bg-brand-500/10 border-brand-500/20',   activeBg: 'bg-brand-500/30 border-brand-400/60'   },
  harvest: { icon: Leaf,       label: 'Harvest', color: 'text-green-400',  bg: 'bg-green-500/10 border-green-500/20',   activeBg: 'bg-green-500/30 border-green-400/60'   },
  lp:      { icon: Droplets,   label: 'LP',      color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/20',     activeBg: 'bg-blue-500/30 border-blue-400/60'     },
  token:   { icon: Coins,      label: 'Token',   color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20', activeBg: 'bg-yellow-500/30 border-yellow-400/60' },
  custom:  { icon: Sparkles,   label: 'Custom',  color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20', activeBg: 'bg-purple-500/30 border-purple-400/60' },
};

function FilterBadge({
  count, type, active, onClick,
}: { count: number; type: FilterType; active: boolean; onClick: () => void }) {
  const { icon: Icon, label, color, bg, activeBg } = BADGE_CONFIG[type];
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all duration-150
        ${active ? activeBg : bg}
        ${active ? 'ring-1 ring-offset-1 ring-offset-dark-900 ring-current opacity-100' : 'opacity-80 hover:opacity-100'}
        ${color}`}
    >
      <Icon className={`w-3.5 h-3.5`} />
      <span className="text-xs font-semibold">{count} {label}</span>
    </button>
  );
}

/** Returns true if a position matches the given filter type */
function matchesFilter(p: Position, type: FilterType): boolean {
  switch (type) {
    case 'stake':
      return p.type === 'stake' || (p.type === 'farm' && (p.farms?.some(f => f.staked > 0) ?? false));
    case 'lp':
      return p.type === 'lp';
    case 'harvest':
      return (
        (p.rewards > 0) ||
        (p.farms?.some(f => f.pending > 0) ?? false) ||
        (p.stakingRewards?.some(r => r.pending > 0) ?? false) ||
        ((p as any).mchadStaking?.positions?.some((pos: any) => parseFloat(pos.unclaimedRewardsFormatted) > 0) ?? false) ||
        (!!(p as any).mchadLpStaking && parseFloat((p as any).mchadLpStaking.unclaimedRewardsFormatted) > 0)
      );
    case 'token':
      return p.type === 'farm' && !(p.farms?.some(f => f.staked > 0 || f.pending > 0) ?? false);
    case 'custom':
      return !!(p as any).mchadStaking || !!(p as any).mchadLpStaking;
  }
}

export default function OpStrat() {
  const addresses       = useAppStore((s) => s.addresses);
  const setSettingsOpen = useAppStore((s) => s.setSettingsOpen);
  const latestBlock     = useAppStore((s) => s.latestBlock);

  const addressStrings = addresses.map((a) => a.address);
  const { positions, loading, refreshing, error, refresh } = usePositions(addressStrings);

  const [activeFilters, setActiveFilters] = useState<Set<FilterType>>(new Set());

  const toggleFilter = (type: FilterType) => {
    setActiveFilters(prev => {
      const next = new Set(prev);
      next.has(type) ? next.delete(type) : next.add(type);
      return next;
    });
  };

  const clearFilters = () => setActiveFilters(new Set());
  const hasFilter = activeFilters.size > 0;

  // Badge counts
  const stakeCount   = positions.filter((p: Position) => matchesFilter(p, 'stake')).length;
  const lpCount      = positions.filter((p: Position) => matchesFilter(p, 'lp')).length;
  const farmCount    = positions.filter((p: Position) => matchesFilter(p, 'harvest')).length;
  const tokenCount   = positions.filter((p: Position) => matchesFilter(p, 'token')).length;
  const customCount  = positions.filter((p: Position) => matchesFilter(p, 'custom')).length;

  if (addresses.length === 0) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
        <div className="max-w-6xl w-full mx-auto">
          <EmptyState
            icon={Wallet}
            title="No addresses tracked"
            description="Add your Bitcoin taproot or OPNet addresses in Settings to start tracking your DeFi positions."
            action={
              <button onClick={() => setSettingsOpen(true)} className="btn-primary flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Open Settings
              </button>
            }
          />
        </div>
      </div>
    );
  }

  const positionsByAddress = addresses.map((addr) => {
    const addrPositions = positions.filter((p: Position) => p.address === addr.address);
    const filtered = hasFilter
      ? addrPositions.filter(p => Array.from(activeFilters).some(f => matchesFilter(p, f)))
      : addrPositions;
    return { addr, positions: addrPositions, filtered };
  });

  return (
    <div className="min-h-[calc(100vh-4rem)] pb-16 px-4 pt-8">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* Hero Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="text-center space-y-4 pb-4"
        >
          <h1 className="text-4xl md:text-5xl font-extrabold text-white">
            Track your{' '}
            <span className="text-gradient">Positions</span>
          </h1>
          <p className="text-gray-400 max-w-md mx-auto text-sm">
            Monitor all your MotoSwap staking, farming, and liquidity positions
            across multiple wallets in real time.
          </p>
        </motion.div>

        {/* Aggregate Token Holdings */}
        {positions.length > 0 && <TokenTotalsCard positions={positions} />}

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">
              <span className="text-gradient">Tracks</span>
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {addresses.length} address{addresses.length !== 1 ? 'es' : ''}
              {' · '}{positions.length} position{positions.length !== 1 ? 's' : ''} detected
              {hasFilter && (
                <span className="ml-2 text-brand-400 font-medium">
                  · {positionsByAddress.reduce((s, g) => s + g.filtered.length, 0)} shown
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {stakeCount  > 0 && <FilterBadge count={stakeCount}  type="stake"   active={activeFilters.has('stake')}   onClick={() => toggleFilter('stake')}   />}
            {lpCount     > 0 && <FilterBadge count={lpCount}     type="lp"      active={activeFilters.has('lp')}      onClick={() => toggleFilter('lp')}      />}
            {farmCount   > 0 && <FilterBadge count={farmCount}   type="harvest" active={activeFilters.has('harvest')} onClick={() => toggleFilter('harvest')} />}
            {tokenCount  > 0 && <FilterBadge count={tokenCount}  type="token"   active={activeFilters.has('token')}   onClick={() => toggleFilter('token')}   />}
            {customCount > 0 && <FilterBadge count={customCount} type="custom"  active={activeFilters.has('custom')}  onClick={() => toggleFilter('custom')}  />}
            {/* Reset filter button */}
            {hasFilter && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-white/20 bg-white/5 text-gray-400 hover:text-white hover:border-white/40 transition-all text-xs font-semibold"
                title="Clear filters"
              >
                <X className="w-3.5 h-3.5" />
                Clear
              </button>
            )}
            <button
              onClick={() => setSettingsOpen(true)}
              className="btn-ghost flex items-center gap-1.5 text-sm"
            >
              <Settings className="w-3.5 h-3.5" />
              Settings
            </button>
            <button
              onClick={refresh}
              disabled={loading || refreshing}
              className="btn-ghost flex items-center gap-1.5 text-sm disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 transition-transform ${(loading || refreshing) ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </motion.div>

        {/* Global loading */}
        {loading && positions.length === 0 && (
          <div className="glass rounded-2xl p-10 flex items-center justify-center">
            <LoadingSpinner label="Fetching on-chain positions…" />
          </div>
        )}

        {/* Global error */}
        {!loading && error && (
          <div className="glass rounded-2xl p-6 border border-red-500/20 bg-red-500/5">
            <p className="text-sm text-red-400 font-medium">Failed to load positions</p>
            <p className="text-xs text-gray-600 mt-1">{error}</p>
          </div>
        )}

        {/* Per-address sections */}
        <div className="space-y-10">
          <AnimatePresence>
            {positionsByAddress.map(({ addr, positions: addrPositions, filtered }) => {
              // Hide entire address section if filter active and nothing matches
              if (hasFilter && filtered.length === 0) return null;
              return (
                <motion.section
                  key={addr.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  {/* Address header */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-9 h-9 bg-gradient-to-br from-brand-400/20 to-brand-600/20 border border-brand-500/20 rounded-xl flex items-center justify-center">
                      <Wallet className="w-4 h-4 text-brand-400" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white">{addr.label}</div>
                      <div className="text-xs font-mono text-gray-500">
                        {addr.address.slice(0, 12)}...{addr.address.slice(-10)}
                      </div>
                    </div>
                  </div>

                  {/* Loading per address */}
                  {loading && addrPositions.length === 0 && (
                    <div className="glass rounded-2xl p-10 flex items-center justify-center">
                      <LoadingSpinner label="Fetching on-chain positions…" />
                    </div>
                  )}

                  {/* No positions */}
                  {!loading && addrPositions.length === 0 && (
                    <div className="glass rounded-2xl p-8 text-center">
                      <p className="text-sm text-gray-500">No DeFi positions detected for this address</p>
                      <p className="text-xs text-gray-600 mt-1">Make sure the address has interacted with MotoSwap contracts</p>
                    </div>
                  )}

                  {/* Positions grid */}
                  {filtered.length > 0 && (
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <AnimatePresence>
                        {filtered.map((pos: Position, i: number) => (
                          <motion.div
                            key={`${pos.id}-${i}`}
                            initial={{ opacity: 0, scale: 0.97 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.15, delay: i * 0.03 }}
                          >
                            <PositionCard position={pos} index={i} />
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
