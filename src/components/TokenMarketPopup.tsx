import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink, Activity, Hash } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { fetchMarketByAddress, type MarketData } from '../api/slowphie';
import type { TokenTotal } from '../components/TokenTotalsCard';
import { getTokenStyle } from '../lib/tokenColors';
import { useAppStore } from '../store';
import { BTC_NATIVE } from '../lib/coreTokens';

interface Props {
  tokenContract: string | undefined;
  symbol: string;
  tokenTotal?: TokenTotal;
  onClose: () => void;
}

/* ── Formatters ─────────────────────────────────────────────────────── */

function fmtBtc(value: string | number): string {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(n) || n === 0) return '0 ₿';
  if (n >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: 8 }) + ' ₿';
  if (n >= 0.001) return n.toFixed(6) + ' ₿';
  if (n >= 0.000001) return n.toFixed(8) + ' ₿';
  const sats = n * 1e8;
  if (sats >= 0.5) return Math.round(sats).toLocaleString() + ' sats';
  if (sats >= 0.001) return sats.toFixed(4) + ' sats';
  const abs = Math.abs(n);
  const leadingZeros = Math.floor(-Math.log10(abs));
  const decimals = Math.min(leadingZeros + 6, 20);
  return n.toFixed(decimals).replace(/0+$/, '') + ' ₿';
}

function fmtUsd(value: number, showCents = true): string {
  if (value === 0) return '$0.00';
  if (value >= 1_000_000_000) return '$' + (value / 1_000_000_000).toFixed(2) + 'B';
  if (value >= 1_000_000) return '$' + (value / 1_000_000).toFixed(2) + 'M';
  if (value >= 1_000) return '$' + (value / 1_000).toFixed(2) + 'K';
  if (value >= 1) return '$' + value.toFixed(2);
  if (value >= 0.01 && showCents) return '$' + value.toFixed(4);
  if (value >= 0.0001) return '$' + value.toFixed(6);
  const abs = Math.abs(value);
  if (abs > 0) {
    const leadingZeros = Math.floor(-Math.log10(abs));
    const decimals = Math.min(leadingZeros + 4, 12);
    return '$' + value.toFixed(decimals).replace(/0+$/, '');
  }
  return '<$0.01';
}

function fmtTokenAmount(value: string, symbol?: string): string {
  const n = parseFloat(value);
  if (isNaN(n) || n === 0) return '0';
  const frac = symbol?.toUpperCase() === 'BTC' ? 8 : 4;
  if (n >= 1e18) return (n / 1e18).toLocaleString(undefined, { maximumFractionDigits: 2 }) + 'Q';
  if (n >= 1e15) return (n / 1e15).toLocaleString(undefined, { maximumFractionDigits: 2 }) + 'P';
  if (n >= 1e12) return (n / 1e12).toLocaleString(undefined, { maximumFractionDigits: 2 }) + 'T';
  if (n >= 1e9)  return (n / 1e9).toLocaleString(undefined,  { maximumFractionDigits: 2 }) + 'B';
  if (n >= 1e6)  return (n / 1e6).toLocaleString(undefined,  { maximumFractionDigits: 2 }) + 'M';
  if (n >= 1e3)  return (n / 1e3).toLocaleString(undefined,  { maximumFractionDigits: 2 }) + 'K';
  return n.toLocaleString(undefined, { maximumFractionDigits: frac });
}

function fmtTimestamp(ts: string | number): string {
  try {
    const d = typeof ts === 'string' ? new Date(ts) : new Date(ts * 1000);
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return String(ts);
  }
}

function fmtTimeAgo(ts: number): string {
  const diff = Date.now() / 1000 - ts;
  if (diff < 60) return Math.round(diff) + 's ago';
  if (diff < 3600) return Math.round(diff / 60) + 'm ago';
  if (diff < 86400) return Math.round(diff / 3600) + 'h ago';
  return Math.round(diff / 86400) + 'd ago';
}

function groupByType(items: { type: 'wallet' | 'staked' | 'pending' | 'lp'; amount: number }[]): { type: 'wallet' | 'staked' | 'pending' | 'lp'; total: number }[] {
  const map = new Map<string, number>();
  for (const b of items) map.set(b.type, (map.get(b.type) ?? 0) + b.amount);
  const order: ('wallet' | 'staked' | 'lp' | 'pending')[] = ['wallet', 'staked', 'lp', 'pending'];
  return order.filter(t => map.has(t)).map(t => ({ type: t, total: map.get(t)! }));
}

/* ── Sub-components ─────────────────────────────────────────────────── */


function StatBox({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white/[0.04] border border-white/[0.07] rounded-xl p-3">
      <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{label}</div>
      <div className="text-sm font-mono font-bold text-white">{value}</div>
      {sub && <div className="text-xs text-slate-400 font-mono mt-0.5">{sub}</div>}
    </div>
  );
}



/* ── BTC Price Sparkline ─────────────────────────────────────────────── */

function BtcPriceSparkline({ data }: { data: { time: number; value: number }[] }) {
  if (data.length < 2) return null;
  const width = 400;
  const height = 80;
  const padding = 4;
  const values = data.map(d => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1)) * (width - padding * 2);
    const y = height - padding - ((d.value - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  }).join(' ');
  const change = ((values[values.length - 1] - values[0]) / values[0]) * 100;
  const changeColor = change >= 0 ? 'text-green-400' : 'text-red-400';
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-slate-500 uppercase tracking-wider">Price History</span>
        <span className={`text-xs font-mono font-bold ${changeColor}`}>{change >= 0 ? '+' : ''}{change.toFixed(2)}%</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-20" preserveAspectRatio="none">
        <defs>
          <linearGradient id="btcSparkFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f97316" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`M${padding},${height} L${points.split(' ')[0]} ${points.replace(/,/g, ' ')} L${width - padding},${height} Z`} fill="url(#btcSparkFill)" />
        <polyline points={points} fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

/* ── BTC Feed View ───────────────────────────────────────────────────── */

function BtcFeedPopup({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const btcPrice     = useAppStore((s) => s.btcPrice);
  const priceHistory = useAppStore((s) => s.priceHistory);
  const latestBlock  = useAppStore((s) => s.latestBlock);
  const blockHistory = useAppStore((s) => s.blockHistory);
  const cfg = getTokenStyle(BTC_NATIVE, 'BTC');
  const storeIcons   = useAppStore((s) => s.tokenIcons);
  const iconUrl = storeIcons['BTC'];

  // 24h change from price history
  const dayChange = useMemo(() => {
    if (priceHistory.length < 2) return null;
    const now = priceHistory[priceHistory.length - 1].value;
    const dayAgo = priceHistory[0].value;
    return ((now - dayAgo) / dayAgo) * 100;
  }, [priceHistory]);

  return (
    <AnimatePresence>
      <motion.div
        key="market-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        onClick={onClose}
        className="fixed inset-0 z-[999] flex items-center justify-center p-4 sm:p-6"
        style={{ background: 'rgba(3, 7, 30, 0.75)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
      >
        <motion.div
          key="market-modal"
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl flex flex-col"
          style={{
            background: 'linear-gradient(160deg, #0d1526f8 0%, #080e1ef8 100%)',
            border: `1px solid ${cfg.hex}45`,
            boxShadow: `0 0 0 1px ${cfg.hex}15, 0 30px 60px -10px rgba(0,0,0,0.8), 0 0 60px ${cfg.hex}10`,
          }}
        >
          {/* Header */}
          <div className="flex items-center gap-4 px-5 py-4 border-b border-white/[0.07] shrink-0"
            style={{ background: `linear-gradient(135deg, ${cfg.hex}12 0%, transparent 60%)` }}>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden"
              style={{ background: `${cfg.hex}15`, border: `2px solid ${cfg.hex}50` }}>
              {iconUrl ? (
                <img src={iconUrl} alt="BTC" className="w-10 h-10 object-contain rounded-xl" />
              ) : (
                <span className="text-xl font-black text-orange-400">BT</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-black text-orange-400 truncate">Bitcoin</h2>
                <span className="text-sm text-slate-500 font-mono bg-white/[0.05] px-2 py-0.5 rounded-lg">BTC</span>
              </div>
              <div className="flex items-baseline gap-2 mt-1 flex-wrap">
                {btcPrice ? (
                  <>
                    <span className="text-2xl font-black text-white font-mono">{fmtUsd(btcPrice)}</span>
                    {dayChange !== null && (
                      <span className={`text-sm font-bold font-mono ${dayChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {dayChange >= 0 ? '+' : ''}{dayChange.toFixed(2)}%
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-sm text-slate-500 animate-pulse">Loading…</span>
                )}
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/10 text-slate-500 hover:text-white transition-colors shrink-0">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="overflow-y-auto flex-1 p-5 space-y-5">
            {/* Price sparkline */}
            {priceHistory.length >= 2 && <BtcPriceSparkline data={priceHistory} />}

            {/* Stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <StatBox label="Price" value={btcPrice ? fmtUsd(btcPrice) : '—'} sub={dayChange !== null ? `${dayChange >= 0 ? '+' : ''}${dayChange.toFixed(2)}%` : undefined} />
              <StatBox label="Block Height" value={latestBlock ? latestBlock.height.toLocaleString() : '—'} sub={latestBlock ? fmtTimeAgo(latestBlock.timestamp) : undefined} />
              <StatBox label="Data Points" value={priceHistory.length.toString()} sub={`${blockHistory.length} blocks`} />
            </div>

            {/* Latest block details */}
            {latestBlock && (
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 space-y-2.5">
                <div className="flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5 text-orange-400" />
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Latest Block</span>
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                  <div className="text-[11px] text-slate-500">Height</div>
                  <div className="text-[11px] font-mono text-slate-200 text-right">#{latestBlock.height.toLocaleString()}</div>
                  <div className="text-[11px] text-slate-500">Timestamp</div>
                  <div className="text-[11px] font-mono text-slate-200 text-right">{fmtTimestamp(latestBlock.timestamp)}</div>
                </div>
              </div>
            )}

            {/* Block history */}
            {blockHistory.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Hash className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Recent Blocks</span>
                </div>
                <div className="space-y-1.5">
                  {Array.from(new Map(blockHistory.map(b => [b.height, b])).values())
                    .slice(-5)
                    .reverse()
                    .map((b, i) => (
                    <div key={b.height} className="flex items-center justify-between bg-white/[0.03] rounded-lg px-3 py-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-500">#{b.height.toLocaleString()}</span>
                        <span className="text-[10px] text-slate-600">{b.txCount} txs</span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-500">{fmtTimeAgo(b.time)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-white/[0.06] flex items-center justify-between shrink-0"
            style={{ background: `linear-gradient(135deg, ${cfg.hex}06, transparent)` }}>
            <span className="text-xs text-slate-600">Feed updates every 30s</span>
            <span className="text-xs text-slate-600">Source: Slowphie Server</span>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ── Loading skeleton ────────────────────────────────────────────────── */

function Skeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-3 bg-white/5 rounded w-3/4" />
      <div className="h-3 bg-white/5 rounded w-1/2" />
      <div className="h-3 bg-white/5 rounded w-2/3" />
      <div className="h-3 bg-white/5 rounded w-1/3" />
    </div>
  );
}

/* ── Token Market Popup ──────────────────────────────────────────────── */

export function TokenMarketPopup({ tokenContract, symbol, tokenTotal, onClose }: Props) {
  const { t } = useTranslation();
  const btcPrice     = useAppStore((s) => s.btcPrice);
  const marketPrices = useAppStore((s) => s.marketPrices);
  const storeIcons = useAppStore((s) => s.tokenIcons);
  const [data,    setData]    = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const address = tokenContract || symbol;
  const cfg     = getTokenStyle(tokenContract, symbol);
  const isBtc   = symbol.toUpperCase() === 'BTC' || !tokenContract || tokenContract === BTC_NATIVE;

  /* Fetch market data (non-BTC only) */
  const fetchMarket = useCallback(async () => {
    if (!address || isBtc) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchMarketByAddress(address);
      setData(result);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load market data');
    } finally {
      setLoading(false);
    }
  }, [address, isBtc]);

  useEffect(() => { fetchMarket(); }, [fetchMarket]);

  /* Keyboard close */
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  /* Scroll lock */
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  /* BTC: render feed view */
  if (isBtc) {
    const modal = <BtcFeedPopup onClose={onClose} />;
    return createPortal(modal, document.body);
  }

  /* Non-BTC: resolve icon + derived values */
  const iconKey = symbol.toUpperCase();
  const addrKey = tokenContract ? `addr:${tokenContract.toLowerCase()}` : null;
  const iconUrl = addrKey ? (storeIcons[addrKey] ?? storeIcons[iconKey]) : storeIcons[iconKey];

  const priceBtc     = data ? parseFloat(data.rawPriceBtc || data.price || '0') : 0;
  const priceUsd     = btcPrice && priceBtc > 0 ? fmtUsd(priceBtc * btcPrice, false) : '';

  const modal = (
    <AnimatePresence>
      <motion.div
        key="market-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        onClick={onClose}
        className="fixed inset-0 z-[999] flex items-center justify-center p-4 sm:p-6"
        style={{ background: 'rgba(3, 7, 30, 0.75)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
      >
        <motion.div
          key="market-modal"
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl flex flex-col"
          style={{
            background: 'linear-gradient(160deg, #0d1526f8 0%, #080e1ef8 100%)',
            border: `1px solid ${cfg.hex}45`,
            boxShadow: `0 0 0 1px ${cfg.hex}15, 0 30px 60px -10px rgba(0,0,0,0.8), 0 0 60px ${cfg.hex}10`,
          }}
        >
          {/* ─── Header ─────────────────────────────────────────── */}
          <div className="flex items-center gap-4 px-5 py-4 border-b border-white/[0.07] shrink-0"
            style={{ background: `linear-gradient(135deg, ${cfg.hex}12 0%, transparent 60%)` }}>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden"
              style={{ background: `${cfg.hex}15`, border: `2px solid ${cfg.hex}50` }}>
              {iconUrl ? (
                <img src={iconUrl} alt={symbol} className="w-10 h-10 object-contain rounded-xl"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              ) : (
                <span className={`text-xl font-black ${cfg.color}`}>{symbol.replace(/[^A-Z0-9]/gi, '').slice(0, 2).toUpperCase()}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className={`text-xl font-black ${cfg.color} truncate`}>{data?.name ?? symbol}</h2>
                <span className="text-sm text-slate-500 font-mono bg-white/[0.05] px-2 py-0.5 rounded-lg">{data?.symbol ?? symbol}</span>
                {data?.arbitrage && (
                  <span className="text-[10px] font-bold text-green-400 bg-green-500/15 border border-green-500/25 px-2 py-0.5 rounded-lg">ARB</span>
                )}
              </div>
              <div className="flex items-baseline gap-2 mt-1 flex-wrap">
                {loading && !data && <span className="text-xs text-slate-500 animate-pulse">{t('market.loading')}</span>}
                {data && (
                  <>
                    <span className="text-2xl font-black text-white font-mono">{fmtBtc(data.rawPriceBtc || data.price)}</span>
                    {priceUsd && <span className="text-base font-semibold text-slate-300">{priceUsd}</span>}
                  </>
                )}
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/10 text-slate-500 hover:text-white transition-colors shrink-0">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* ─── Scrollable body ─────────────────────────────────── */}
          <div className="overflow-y-auto flex-1 p-5">
            {error && <div className="bg-red-500/10 border border-red-500/25 rounded-xl p-4 text-sm text-red-400 mb-4">{error}</div>}
            {loading && !data && <Skeleton />}

            {/* Per-wallet breakdown (Aggregate Token Holdings detail) */}
            {tokenTotal && (() => {
              const tokenKey = tokenTotal.tokenContract ? tokenTotal.tokenContract.toLowerCase() : tokenTotal.symbol;
              const tokenPriceBtc = data ? parseFloat(data.rawPriceBtc || data.price || '0') : (marketPrices[tokenKey] ?? 0);
              const fmtAmt = (n: number): string => {
                if (n >= 1_000_000_000_000) return (n / 1_000_000_000_000).toLocaleString(undefined, { maximumFractionDigits: 2 }) + 'T';
                if (n >= 1_000_000_000)     return (n / 1_000_000_000).toLocaleString(undefined, { maximumFractionDigits: 2 }) + 'B';
                if (n >= 1_000_000)         return (n / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 2 }) + 'M';
                if (n >= 1_000)             return (n / 1_000).toLocaleString(undefined, { maximumFractionDigits: 2 }) + 'K';
                return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
              };
              const walletMap = new Map<string, { amount: number; type: 'wallet' | 'staked' | 'pending' | 'lp' }[]>();
              for (const b of tokenTotal.breakdown) {
                const key = b.address.toLowerCase();
                if (!walletMap.has(key)) walletMap.set(key, []);
                walletMap.get(key)!.push({ amount: b.amount, type: b.type });
              }
              const badgeLabel: Record<string, string> = { wallet: 'Wallet', staked: 'Staked', pending: 'Pending', lp: 'LP' };
              const badgeCls: Record<string, string> = {
                wallet:  'bg-gray-500/20 text-gray-400',
                staked:  'bg-brand-500/20 text-brand-400',
                pending: 'bg-green-500/20 text-green-400',
                lp:      'bg-blue-500/20 text-blue-400',
              };
              return (
                <div className="space-y-3">
                  {Array.from(walletMap.entries()).map(([addr, items]) => {
                    const groups = groupByType(items);
                    const totalAmt   = items.reduce((s, b) => s + b.amount, 0);
                    const totalBtc   = totalAmt * tokenPriceBtc;
                    const totalUsd   = btcPrice ? totalBtc * btcPrice : null;
                    return (
                      <div key={addr} className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
                        {/* Wallet header row */}
                        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/[0.05]" style={{ background: `${cfg.hex}08` }}>
                          <span className="text-[11px] font-mono text-slate-400 flex-1 truncate">{addr.slice(0, 8)}…{addr.slice(-6)}</span>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <div className={`text-xs font-bold ${cfg.color} font-mono`}>{fmtAmt(totalAmt)} <span className="text-[10px] font-medium text-slate-500">{tokenTotal.symbol}</span></div>
                            </div>
                            {tokenPriceBtc > 0 && (
                              <div className="text-right border-l border-white/[0.06] pl-3">
                                <div className="text-xs font-bold text-slate-200 font-mono">{fmtBtc(totalBtc)}</div>
                                {totalUsd !== null && <div className="text-[10px] text-slate-500 font-mono">{fmtUsd(totalUsd)}</div>}
                              </div>
                            )}
                          </div>
                        </div>
                        {/* Type badges */}
                        <div className="flex flex-wrap gap-1.5 px-4 py-2.5">
                          {groups.map(g => {
                            const gBtc = g.total * tokenPriceBtc;
                            const gUsd = btcPrice ? gBtc * btcPrice : null;
                            return (
                              <div key={g.type} className={`flex flex-col px-2 py-1 rounded-lg border border-white/[0.04] ${badgeCls[g.type]}`}>
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] font-bold uppercase tracking-wide">{badgeLabel[g.type]}</span>
                                </div>
                                <span className="text-[10px] font-mono font-semibold">{fmtAmt(g.total)} {tokenTotal.symbol}</span>
                                {tokenPriceBtc > 0 && (
                                  <span className="text-[10px] font-mono text-slate-400">{fmtBtc(gBtc)}{gUsd !== null ? ` · ${fmtUsd(gUsd)}` : ''}</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {!tokenTotal && data && (
              <div className="py-8 text-center text-sm text-slate-600">
                {/* Empty for now */}
              </div>
            )}
          </div>

          {/* ─── Footer ──────────────────────────────────────────── */}
          <div className="px-5 py-3 border-t border-white/[0.06] flex items-center justify-between shrink-0"
            style={{ background: `linear-gradient(135deg, ${cfg.hex}06, transparent)` }}>
            <button onClick={fetchMarket} disabled={loading}
              className="text-xs text-slate-500 hover:text-white transition-colors disabled:opacity-40 font-medium">
              {loading ? t('common.refreshing') : '↺ ' + t('common.refresh')}
            </button>
            {data?.id && (
              <a href={`https://opscan.org/token/${encodeURIComponent(data.id)}?network=mainnet`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors font-medium">
                View on Opscan <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );

  return createPortal(modal, document.body);
}
