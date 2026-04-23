import { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink, ArrowRight, ShieldCheck, AlertTriangle, Zap, Calculator } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store';
import { fetchTokenRoutes, fetchTokenHistory } from '../api/slowphie';
import { useTokenChannel } from '../hooks/useTokenChannel';
import { getTokenStyle } from '../lib/tokenColors';
import PriceChart from './PriceChart';
import type { HistoryResponse, RouteDetail as ApiRouteDetail } from '../api/slowphie';

/* ── Static token icons ─────────────────────────────────────────────── */

const STATIC_TOKEN_ICONS: Record<string, string> = {
  PILL:  'https://raw.githubusercontent.com/btc-vision/contract-logo/main/contracts/op1sqz0f729q22dv6trrvhn9msl9enqqaazy5cjy4ej6.png',
  MOTO:  'https://raw.githubusercontent.com/btc-vision/contract-logo/main/contracts/op1sqrxd0p3kd234wc5n2z7pl4hs82y8kpk4fqj9h78a.png',
  BTC:   'https://raw.githubusercontent.com/btc-vision/contract-logo/main/contracts/bitcoin.png',
  BLUE:  '/tokens/BLUE.jpg',
  MCHAD: '/tokens/MCHAD.jpg',
};

function resolveIcon(symbol: string, storeIcons: Record<string, string>, contractAddress?: string): string | undefined {
  const key = symbol.toUpperCase();
  if (contractAddress) {
    const addrKey = `addr:${contractAddress.toLowerCase()}`;
    return storeIcons[addrKey] ?? STATIC_TOKEN_ICONS[key];
  }
  return STATIC_TOKEN_ICONS[key];
}

function TokenIconImg({ symbol, contractAddress }: { symbol: string; contractAddress?: string }) {
  const storeIcons = useAppStore((s) => s.tokenIcons);
  const [imgErr, setImgErr] = useState(false);
  const url = resolveIcon(symbol, storeIcons, contractAddress);
  if (url && !imgErr) {
    return (
      <img
        src={url}
        alt={symbol}
        className="w-10 h-10 rounded-full object-cover border-2 border-white/10 shrink-0"
        onError={() => setImgErr(true)}
      />
    );
  }
  // Fallback letter avatar with colored background
  const hue = symbol.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <div
      className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 border-white/10 shrink-0"
      style={{ background: `hsl(${hue}, 50%, 25%)` }}
    >
      {symbol.slice(0, 2).toUpperCase()}
    </div>
  );
}

/* ── Helpers ────────────────────────────────────────────────────────── */

interface Props {
  tokenContract: string | null;
  symbol: string;
  onClose: () => void;
}

interface LocalRouteDetail extends ApiRouteDetail {
  feeAdjustedPrice?: string;
  totalSupply?: string;
  holders?: number;
  trust?: string;
  lastTradePrice?: string;
  lastTradeVolumeBtc?: string;
  lastTradeTime?: string;
  blockHeight?: string;
}

function fmtBtc(val: string | number): string {
  const v = typeof val === 'string' ? parseFloat(val) : val;
  if (Number.isNaN(v)) return '—';
  const abs = Math.abs(v);
  if (abs >= 1e6) return (v / 1e6).toFixed(2) + 'M';
  if (abs >= 1e3) return (v / 1e3).toFixed(2) + 'K';
  if (abs < 1e-8) return v.toExponential(3);
  if (abs < 0.001) return v.toFixed(10);
  if (abs < 1) return v.toFixed(6);
  return v.toFixed(4);
}

function fmtUsd(val: number): string {
  if (Number.isNaN(val)) return '—';
  const abs = Math.abs(val);
  if (abs >= 1e9) return '$' + (val / 1e9).toFixed(2) + 'B';
  if (abs >= 1e6) return '$' + (val / 1e6).toFixed(2) + 'M';
  if (abs >= 1e3) return '$' + (val / 1e3).toFixed(2) + 'K';
  return '$' + val.toFixed(2);
}

function formatTimestamp(ts: string | number): string {
  try {
    const d = typeof ts === 'string' ? new Date(ts) : new Date(ts);
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return String(ts);
  }
}

/* ── Sparkline from history ─────────────────────────────────────────── */

function PriceSparkline({ data, livePrice }: { data: HistoryResponse['data']; livePrice?: string }) {
  const points = useMemo(() => {
    const arr = Array.isArray(data) ? data : [];
    if (arr.length === 0) return [];
    return arr.map((d: any) => parseFloat(d.close ?? d.bestPriceBtc ?? '0')).filter(v => v > 0);
  }, [data]);

  if (points.length < 2) return null;

  const width = 400;
  const height = 80;
  const padding = 4;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;

  const coords = points.map((v, i) => {
    const x = padding + (i / (points.length - 1)) * (width - padding * 2);
    const y = height - padding - ((v - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  }).join(' ');

  const change = ((points[points.length - 1] - points[0]) / points[0]) * 100;
  const changeColor = change >= 0 ? 'text-green-400' : 'text-red-400';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-slate-500 uppercase tracking-wider">24h Price</span>
        <span className={`text-xs font-mono font-bold ${changeColor}`}>
          {change >= 0 ? '+' : ''}{change.toFixed(2)}%
        </span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-20" preserveAspectRatio="none">
        <defs>
          <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.3" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon
          points={`${padding},${height} ${coords} ${width - padding},${height}`}
          fill="url(#sparkGrad)"
          className={change >= 0 ? 'text-green-400' : 'text-red-400'}
        />
        <polyline
          points={coords}
          fill="none"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={change >= 0 ? 'stroke-green-400' : 'stroke-red-400'}
        />
      </svg>
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────────────────── */

function TrustBadge({ trust }: { trust?: string }) {
  if (!trust) return null;
  const isOk = trust.toUpperCase() === 'OK';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide ${
      isOk ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
    }`}>
      {isOk ? <ShieldCheck className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
      {trust}
    </span>
  );
}

function StatBox({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white/[0.04] border border-white/[0.07] rounded-xl p-3">
      <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{label}</div>
      <div className="text-sm font-mono font-bold text-white">{value}</div>
      {sub && <div className="text-xs text-slate-400 font-mono mt-0.5">{sub}</div>}
    </div>
  );
}

function RouteCard({ route, index }: { route: any; index: number }) {
  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-xs font-bold text-slate-500">#{index + 1}</span>
          {route.path?.map((sym: string, i: number) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <ArrowRight className="w-3 h-3 text-slate-600" />}
              <span className="text-xs font-bold text-slate-200 bg-white/[0.06] px-1.5 py-0.5 rounded">{sym}</span>
            </span>
          ))}
        </div>
        <TrustBadge trust={route.trust} />
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1">
        <div className="text-[11px] text-slate-500">Price</div>
        <div className="text-[11px] font-mono text-slate-200 text-right">{fmtBtc(route.feeAdjustedPrice || route.price)}</div>
        <div className="text-[11px] text-slate-500">Fees</div>
        <div className="text-[11px] font-mono text-slate-200 text-right">{route.totalFeePct?.toFixed?.(1) ?? '0'}%</div>
        <div className="text-[11px] text-slate-500">Source</div>
        <div className="text-[11px] font-mono text-slate-200 text-right capitalize">{route.source?.replace(/\+/g, ' + ')}</div>
      </div>
    </div>
  );
}

/* ── Route Simulator ────────────────────────────────────────────────── */

function RouteSimulator({ routes, bestPrice }: { routes: any[]; bestPrice: string }) {
  const [amount, setAmount] = useState<string>('1000');
  const [showSim, setShowSim] = useState(false);

  const simulations = useMemo(() => {
    if (!routes || routes.length === 0 || !bestPrice) return [];
    const btcIn = parseFloat(amount) || 0;
    if (btcIn <= 0) return [];

    return routes.map((route: any) => {
      const price = parseFloat(route.feeAdjustedPrice || route.price || bestPrice);
      const feePct = route.totalFeePct || 0;
      const tokensOut = btcIn / price;
      const feeAmount = tokensOut * (feePct / 100);
      const netTokens = tokensOut - feeAmount;
      return {
        ...route,
        btcIn,
        tokensOut,
        feeAmount,
        netTokens,
        feePct,
      };
    }).sort((a: any, b: any) => b.netTokens - a.netTokens);
  }, [routes, bestPrice, amount]);

  return (
    <div className="bg-white/[0.04] border border-white/[0.07] rounded-xl overflow-hidden">
      <button
        onClick={() => setShowSim(!showSim)}
        className="w-full flex items-center justify-between px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider hover:text-slate-300 transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <Calculator className="w-3.5 h-3.5" />
          Route Simulator
        </span>
        <span className={`text-[10px] transition-transform ${showSim ? 'rotate-180' : ''}`}>▼</span>
      </button>
      {showSim && (
        <div className="px-4 pb-4 space-y-3 border-t border-white/[0.06]">
          <div className="pt-3 flex items-center gap-2">
            <span className="text-xs text-slate-500">BTC Amount:</span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="flex-1 bg-dark-900/60 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white font-mono focus:outline-none focus:border-white/20"
              min="0"
              step="0.001"
            />
            <span className="text-xs text-slate-500 font-mono">₿</span>
          </div>
          {simulations.length > 0 && (
            <div className="space-y-2">
              {simulations.slice(0, 3).map((sim: any, i: number) => (
                <div
                  key={i}
                  className={`p-2.5 rounded-lg border text-[11px] ${
                    i === 0
                      ? 'bg-green-500/[0.04] border-green-500/20'
                      : 'bg-white/[0.02] border-white/[0.06]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-300">{sim.path?.join(' → ') || 'Direct'}</span>
                    {i === 0 && <span className="text-[10px] text-green-400 font-bold">Best</span>}
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[10px]">
                    <span className="text-slate-500">Output</span>
                    <span className="font-mono text-slate-200 text-right">{sim.netTokens.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
                    <span className="text-slate-500">Fees</span>
                    <span className="font-mono text-red-400 text-right">-{sim.feeAmount.toLocaleString(undefined, { maximumFractionDigits: 4 })} ({sim.feePct.toFixed(1)}%)</span>
                    <span className="text-slate-500">Price</span>
                    <span className="font-mono text-slate-200 text-right">{fmtBtc(sim.price)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Main Component ─────────────────────────────────────────────────── */

export default function TokenRoutePopup({ tokenContract, symbol, onClose }: Props) {
  const { t } = useTranslation();
  const btcPrice = useAppStore((s) => s.btcPrice);
  const [detail, setDetail] = useState<LocalRouteDetail | null>(null);
  const [lineHistory, setLineHistory] = useState<HistoryResponse | null>(null);
  const [candleHistory, setCandleHistory] = useState<HistoryResponse | null>(null);
  const [chartMode, setChartMode] = useState<'line' | 'candle'>('line');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { connected: wsConnected, routeData: liveRouteData, lastBlock } = useTokenChannel(tokenContract ?? null);

  const load = useCallback(async () => {
    if (!tokenContract) return;
    try {
      setLoading(true);
      setError(null);
      const [routeDetail, lineHist, candleHist] = await Promise.all([
        fetchTokenRoutes(tokenContract),
        fetchTokenHistory(tokenContract, '15m', '24h', false),
        fetchTokenHistory(tokenContract, '15m', '24h', true),
      ]);
      setDetail(routeDetail as LocalRouteDetail);
      setLineHistory(lineHist);
      setCandleHistory(candleHist);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [tokenContract]);

  useEffect(() => {
    load();
  }, [load]);

  const displayData = useMemo(() => {
    if (!detail) return null;
    if (!liveRouteData) return detail;
    return {
      ...detail,
      price: liveRouteData.bestPriceBtc || detail.price,
      routeCount: liveRouteData.routeCount ?? detail.routes?.length ?? 0,
      arbitrage: liveRouteData.arbitrage?.exists ?? detail.arbitrage,
    };
  }, [detail, liveRouteData]);

  // Use unified tokenColors.ts for consistent styling with /router cards
  const style = getTokenStyle(tokenContract ?? undefined, symbol);
  const opscanUrl = (addr: string) => `https://opscan.org/tokens/${addr}?network=mainnet`;

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-xl max-h-[85vh] overflow-y-auto rounded-2xl border border-white/[0.08] bg-[#0d0f1a] shadow-2xl"
          style={{ boxShadow: `0 25px 50px -12px ${style.hex}20` }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-white/[0.06] bg-[#0d0f1a]/95 backdrop-blur">
            <div className="flex items-center gap-3">
              <TokenIconImg symbol={symbol} contractAddress={tokenContract ?? undefined} />
              <div>
                <h2 className="text-lg font-bold text-white">{symbol}</h2>
                <div className="flex items-center gap-2">
                  {wsConnected && (
                    <span className="flex items-center gap-1 text-[10px] text-green-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                      Live {lastBlock ? `(Block ${lastBlock})` : ''}
                    </span>
                  )}
                  <a
                    href={tokenContract ? opscanUrl(tokenContract) : '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-slate-500 hover:text-slate-300 flex items-center gap-0.5 transition-colors"
                  >
                    Opscan <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/[0.06] text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-5 space-y-5">
            {loading && (
              <div className="flex items-center justify-center py-12 gap-2 text-slate-500">
                <div className="w-4 h-4 border-2 border-slate-600 border-t-white rounded-full animate-spin" />
                Loading market data...
              </div>
            )}

            {error && (
              <div className="text-center py-8">
                <p className="text-red-400 text-sm mb-3">{error}</p>
                <button onClick={load} className="text-sm px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:text-white transition-colors">
                  Retry
                </button>
              </div>
            )}

            {!loading && !error && displayData && (
              <>
                {/* Price Chart */}
                <PriceChart
                  data={chartMode === 'candle' ? candleHistory?.data : lineHistory?.data}
                  mode={chartMode}
                  onModeChange={setChartMode}
                  livePrice={displayData.price}
                  color={style.hex}
                />

                {/* Route Simulator */}
                <RouteSimulator routes={displayData.routes} bestPrice={displayData.price} />

                {/* Current Price */}
                <div className="bg-white/[0.04] border border-white/[0.07] rounded-xl p-4">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Current Price</div>
                  <div className="flex items-baseline gap-3">
                    <span className="text-2xl font-mono font-bold text-white">{fmtBtc(displayData.price)}</span>
                    {btcPrice && parseFloat(displayData.price) > 0 && (
                      <span className="text-sm text-slate-400 font-mono">
                        {fmtUsd(parseFloat(displayData.price) * btcPrice)}
                      </span>
                    )}
                  </div>
                  {displayData.arbitrage && (
                    <div className="mt-2 flex items-center gap-1.5 text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded px-2 py-1">
                      <Zap className="w-3.5 h-3.5" />
                      <span>Arbitrage opportunity detected ({displayData.spread}% spread)</span>
                    </div>
                  )}
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <StatBox label="Market Cap" value={fmtBtc(displayData.marketcap)} />
                  <StatBox label="Routes" value={String(displayData.routes?.length ?? 0)} />
                  <StatBox label="Buy Tax" value={`${displayData.buyTax ?? 0}%`} />
                  <StatBox label="Sell Tax" value={`${displayData.sellTax ?? 0}%`} />
                </div>

                {/* Best Route */}
                {displayData.routes && displayData.routes.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider">Best Route</span>
                      <span className="text-[10px] text-slate-600">{displayData.routes.length} total routes</span>
                    </div>
                    <RouteCard route={displayData.routes[0]} index={0} />
                  </div>
                )}

                {/* All Routes */}
                {displayData.routes && displayData.routes.length > 1 && (
                  <details className="space-y-2">
                    <summary className="text-[10px] text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-400 transition-colors select-none">
                      All Routes ({displayData.routes.length})
                    </summary>
                    <div className="space-y-2 pt-2">
                      {displayData.routes.slice(1).map((route: any, i: number) => (
                        <RouteCard key={i} route={route} index={i + 1} />
                      ))}
                    </div>
                  </details>
                )}

                {/* Last Trade */}
                {displayData.lastTradePrice && (
                  <div className="bg-white/[0.04] border border-white/[0.07] rounded-xl p-4 space-y-2">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider">Last Trade</div>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                      <div className="text-[11px] text-slate-500">Price</div>
                      <div className="text-[11px] font-mono text-slate-200 text-right">{fmtBtc(displayData.lastTradePrice)}</div>
                      <div className="text-[11px] text-slate-500">Volume</div>
                      <div className="text-[11px] font-mono text-slate-200 text-right">{fmtBtc(displayData.lastTradeVolumeBtc ?? '0')}</div>
                      <div className="text-[11px] text-slate-500">Time</div>
                      <div className="text-[11px] font-mono text-slate-200 text-right">{formatTimestamp(displayData.lastTradeTime ?? Date.now())}</div>
                      <div className="text-[11px] text-slate-500">Block</div>
                      <div className="text-[11px] font-mono text-slate-200 text-right">{displayData.blockHeight ?? '—'}</div>
                    </div>
                  </div>
                )}

                {/* Trust badge */}
                {displayData.trust && (
                  <div className="flex justify-end">
                    <TrustBadge trust={displayData.trust} />
                  </div>
                )}
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
