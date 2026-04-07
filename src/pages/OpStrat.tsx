import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, Wallet, Settings, TrendingUp, Wheat, Droplets } from 'lucide-react';
import { useAppStore } from '../store';
import { usePositions } from '../hooks/usePositions';
import { PositionCard } from '../components/PositionCard';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
import { TokenTotalsCard } from '../components/TokenTotalsCard';
import type { Position } from '../types';

function AddressSummaryBadge({ count, type }: { count: number; type: 'stake' | 'farm' | 'lp' }) {
  const config = {
    stake: { icon: TrendingUp, label: 'Stake', color: 'text-brand-400', bg: 'bg-brand-500/10 border-brand-500/20' },
    farm:  { icon: Wheat,      label: 'Farm',  color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
    lp:    { icon: Droplets,   label: 'LP',    color: 'text-blue-400',  bg: 'bg-blue-500/10 border-blue-500/20'  },
  };
  const { icon: Icon, label, color, bg } = config[type];
  return (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${bg}`}>
      <Icon className={`w-3.5 h-3.5 ${color}`} />
      <span className={`text-xs font-semibold ${color}`}>{count} {label}</span>
    </div>
  );
}

export default function OpStrat() {
  const addresses      = useAppStore((s) => s.addresses);
  const setSettingsOpen = useAppStore((s) => s.setSettingsOpen);
  const latestBlock    = useAppStore((s) => s.latestBlock);

  const addressStrings = addresses.map((a) => a.address);
  const { positions, loading, refreshing, error, refresh } = usePositions(addressStrings);

  const stakeCount = positions.filter((p: Position) => p.type === 'stake').length;
  const farmCount  = positions.filter((p: Position) => p.type === 'farm').length;
  const lpCount    = positions.filter((p: Position) => p.type === 'lp').length;

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

  const positionsByAddress = addresses.map((addr) => ({
    addr,
    positions: positions.filter((p: Position) => p.address === addr.address),
  }));

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
              {latestBlock && (
                <span className="ml-2 text-gray-600">· Block #{latestBlock.height.toLocaleString()}</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {stakeCount > 0 && <AddressSummaryBadge count={stakeCount} type="stake" />}
            {farmCount  > 0 && <AddressSummaryBadge count={farmCount}  type="farm"  />}
            {lpCount    > 0 && <AddressSummaryBadge count={lpCount}    type="lp"    />}
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
            {positionsByAddress.map(({ addr, positions: addrPositions }) => (
              <motion.section
                key={addr.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
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
                {addrPositions.length > 0 && (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {addrPositions.map((pos: Position, i: number) => (
                      <PositionCard key={`${pos.id}-${i}`} position={pos} index={i} />
                    ))}
                  </div>
                )}
              </motion.section>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
