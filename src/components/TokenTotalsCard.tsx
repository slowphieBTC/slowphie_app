import { motion } from 'framer-motion';
import type { Position } from '../types';

// ── Token display config ──────────────────────────────────────────────
const TOKEN_ORDER = ['BTC', 'MOTO', 'PILL', 'SAT', 'SWAP'];

const TOKEN_CONFIG: Record<string, { color: string; bg: string; border: string; icon: string; img?: string }> = {
  BTC:  { color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20', icon: '₿', img: 'https://raw.githubusercontent.com/btc-vision/contract-logo/main/contracts/bitcoin.png' },
  MOTO: { color: 'text-brand-400',  bg: 'bg-brand-500/10',  border: 'border-brand-500/20',  icon: 'M',     img: 'https://raw.githubusercontent.com/btc-vision/contract-logo/main/contracts/op1sqrxd0p3kd234wc5n2z7pl4hs82y8kpk4fqj9h78a.png' },
  PILL: { color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20', icon: 'P',     img: 'https://raw.githubusercontent.com/btc-vision/contract-logo/main/contracts/op1sqz0f729q22dv6trrvhn9msl9enqqaazy5cjy4ej6.png' },
  SAT:  { color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', icon: 'S' },
  SWAP: { color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/20',   icon: 'SW' },
};

// ── Breakdown row ─────────────────────────────────────────────────────
interface TokenBreakdown {
  label: string;
  amount: number;
  type: 'wallet' | 'staked' | 'pending' | 'lp';
}

interface TokenTotal {
  symbol: string;
  total: number;
  breakdown: TokenBreakdown[];
}

// ── Aggregation logic ─────────────────────────────────────────────────
function aggregateTokens(positions: Position[]): TokenTotal[] {
  const totals = new Map<string, { total: number; breakdown: TokenBreakdown[] }>();

  const add = (symbol: string, amount: number, label: string, type: TokenBreakdown['type']) => {
    if (!symbol || amount <= 0) return;
    const sym = symbol.toUpperCase();
    if (!totals.has(sym)) totals.set(sym, { total: 0, breakdown: [] });
    const entry = totals.get(sym)!;
    entry.total += amount;
    entry.breakdown.push({ label, amount, type });
  };

  for (const pos of positions) {
    const addrShort = pos.address.slice(0, 8) + '…';

    if (pos.type === 'stake') {
      if (pos.amount > 0) add(pos.token, pos.amount, `Staked (${addrShort})`, 'staked');
      pos.stakingRewards?.forEach(r => {
        if (r.pending > 0) add(r.symbol, r.pending, `Stake Reward (${addrShort})`, 'pending');
      });

    } else if (pos.type === 'farm') {
      if (pos.hasFarmView) {
        if ((pos.walletBalance ?? 0) > 0)
          add(pos.token, pos.walletBalance ?? 0, `Wallet (${addrShort})`, 'wallet');
        pos.farms?.forEach(f => {
          if (f.staked > 0)  add(pos.token,     f.staked,  `${f.farmName} Staked (${addrShort})`, 'staked');
          if (f.pending > 0) add(f.rewardToken, f.pending, `${f.farmName} Harvest (${addrShort})`, 'pending');
        });
      } else {
        // Wallet-only token (no active farm): show as Wallet, not Staked
        const hasActiveFarm = pos.farms?.some(f => f.staked > 0 || f.pending > 0) ?? false;
        const entryType: TokenBreakdown['type'] = hasActiveFarm ? 'staked' : 'wallet';
        const entryLabel = hasActiveFarm
          ? `${pos.label} Staked (${addrShort})`
          : `${pos.label} Wallet (${addrShort})`;
        if (pos.amount > 0) add(pos.token, pos.amount, entryLabel, entryType);
        if (pos.rewards > 0 && pos.rewardToken)
          add(pos.rewardToken, pos.rewards, `${pos.label} Harvest (${addrShort})`, 'pending');
        }
      }

    } else if (pos.type === 'lp') {
      // Wallet LP underlying
      if (pos.lpUnderlying) {
        const { token0Symbol, token1Symbol, token0Amount, token1Amount } = pos.lpUnderlying;
        if (token0Amount > 0) add(token0Symbol, token0Amount, `${pos.label} Wallet LP (${addrShort})`, 'lp');
        if (token1Amount > 0) add(token1Symbol, token1Amount, `${pos.label} Wallet LP (${addrShort})`, 'lp');
      }
      // Staked LP underlying (from all farms)
      if (pos.lpUnderlyingStaked) {
        const { token0Symbol, token1Symbol, token0Amount, token1Amount } = pos.lpUnderlyingStaked;
        if (token0Amount > 0) add(token0Symbol, token0Amount, `${pos.label} Staked LP (${addrShort})`, 'lp');
        if (token1Amount > 0) add(token1Symbol, token1Amount, `${pos.label} Staked LP (${addrShort})`, 'lp');
      }
      // Farm harvest rewards
      pos.farms?.forEach(f => {
        if (f.pending > 0) add(f.rewardToken, f.pending, `${f.farmName} Harvest (${addrShort})`, 'pending');
      });
      if (!pos.hasFarmView && pos.rewards > 0 && pos.rewardToken)
        add(pos.rewardToken, pos.rewards, `${pos.label} Harvest (${addrShort})`, 'pending');
    }
  }

  const result: TokenTotal[] = [];
  for (const sym of TOKEN_ORDER) {
    if (totals.has(sym)) result.push({ symbol: sym, ...totals.get(sym)! });
  }
  for (const [sym, data] of totals) {
    if (!TOKEN_ORDER.includes(sym)) result.push({ symbol: sym, ...data });
  }
  return result.filter(t => t.total > 0);
}

// ── Format helpers ────────────────────────────────────────────────────
function fmt(n: number, symbol: string): string {
  const decimals = symbol === 'BTC' ? 8 : 4;
  if (n >= 1_000_000) return (n / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 2 }) + 'M';
  if (n >= 1_000)     return (n / 1_000).toLocaleString(undefined, { maximumFractionDigits: 2 }) + 'K';
  return n.toLocaleString(undefined, { maximumFractionDigits: decimals });
}

const TYPE_BADGE: Record<TokenBreakdown['type'], { label: string; cls: string }> = {
  wallet:  { label: 'Wallet',  cls: 'bg-gray-500/20 text-gray-400' },
  staked:  { label: 'Staked',  cls: 'bg-brand-500/20 text-brand-400' },
  pending: { label: 'Harvest', cls: 'bg-green-500/20 text-green-400' },
  lp:      { label: 'LP Pool', cls: 'bg-blue-500/20 text-blue-400' },
};

// ── Main component ────────────────────────────────────────────────────
interface Props { positions: Position[] }

export function TokenTotalsCard({ positions }: Props) {
  const totals = aggregateTokens(positions);

  if (totals.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="col-span-full bg-dark-800/60 backdrop-blur-sm border border-dark-700/50 rounded-2xl p-6"
    >
      <h2 className="text-sm font-semibold text-dark-300 uppercase tracking-wider mb-4">Aggregate Token Holdings</h2>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {totals.map(t => {
          const cfg = TOKEN_CONFIG[t.symbol] ?? {
            color: 'text-dark-300', bg: 'bg-dark-700/30', border: 'border-dark-600/30', icon: t.symbol[0],
          };
          return (
            <div
              key={t.symbol}
              className={`rounded-xl border ${cfg.border} ${cfg.bg} p-4 flex flex-col gap-3`}
            >
              {/* Token header */}
              <div className="flex items-center gap-2">
                <div className={`w-9 h-9 ${'img' in cfg && cfg.img ? 'rounded-full' : 'rounded-lg'} ${cfg.bg} border ${cfg.border} flex items-center justify-center shrink-0 overflow-hidden`}>
                  {'img' in cfg && cfg.img
                    ? <img src={cfg.img} alt={t.symbol} className="w-8 h-8 object-contain rounded-full" />
                    : <span className={`text-xs font-bold ${cfg.color}`}>{cfg.icon}</span>
                  }
                </div>
                <div>
                  <div className={`text-base font-bold ${cfg.color}`}>{fmt(t.total, t.symbol)}</div>
                  <div className="text-xs text-dark-400">{t.symbol}</div>
                </div>
              </div>

              {/* Breakdown rows */}
              <div className="flex flex-col gap-1.5">
                {t.breakdown.map((b, i) => {
                  const badge = TYPE_BADGE[b.type];
                  return (
                    <div key={i} className="flex items-center justify-between gap-1">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${badge.cls} shrink-0`}>
                        {badge.label}
                      </span>
                      <span className="text-xs text-dark-300 text-right truncate" title={b.label}>
                        {fmt(b.amount, t.symbol)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
