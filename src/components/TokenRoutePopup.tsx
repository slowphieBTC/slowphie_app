import { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink, ArrowRight, ShieldCheck, AlertTriangle, Anchor, Droplets, Clock, Activity } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store';
import { fetchTokenRoutes, fetchTokenHistory } from '../api/slowphie';
import { useTokenChannel } from '../hooks/useTokenChannel';
import { getTokenStyle } from '../lib/tokenColors';
import PriceChart from './PriceChart';
import type { HistoryResponse, RouteDetail as ApiRouteDetail, MarketRoute } from '../api/slowphie';

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
    return storeIcons[`addr:${contractAddress.toLowerCase()}`] ?? STATIC_TOKEN_ICONS[key];
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

/* ── Props & local types ────────────────────────────────────────────── */
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

/* ── Formatters ─────────────────────────────────────────────────────── */
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

function fmtAutoDecimal(val: number): string {
  if (!isFinite(val) || Number.isNaN(val)) return '—';
  const abs = Math.abs(val);
  if (abs === 0) return '0';
  if (abs >= 1e9) return val.toFixed(2);
  if (abs >= 1) return val.toLocaleString(undefined, { maximumFractionDigits: 6 });
  const log10 = Math.log10(abs);
  const leadingZeros = Math.max(0, Math.floor(-log10));
  const decimals = Math.min(leadingZeros + 5, 14);
  let result = val.toFixed(decimals);
  result = result.replace(/\.?0+$/, '');
  return result === '' || result === '-' ? '0' : result;
}

function fmtUsdSmart(val: number): string {
  if (!isFinite(val) || Number.isNaN(val)) return '—';
  const abs = Math.abs(val);
  if (abs >= 1e9) return '$' + (val / 1e9).toFixed(2) + 'B';
  if (abs >= 1e6) return '$' + (val / 1e6).toFixed(2) + 'M';
  if (abs >= 1e3) return '$' + (val / 1e3).toFixed(2) + 'K';
  if (abs >= 1) return '$' + val.toFixed(2);
  return '$' + fmtAutoDecimal(val);
}

function fmtTimeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const s = Math.floor(diff / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function fmtSats(satsStr: string | undefined): string {
  if (!satsStr) return '—';
  const n = parseInt(satsStr, 10);
  if (isNaN(n)) return '—';
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(3) + 'M sats';
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(1) + 'k sats';
  return n.toLocaleString() + ' sats';
}

function satsToBtc(satsStr: string | undefined): number {
  if (!satsStr) return 0;
  const n = parseInt(satsStr, 10);
  return isNaN(n) ? 0 : n / 1e8;
}

function shortAddr(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return addr.slice(0, 6) + '…' + addr.slice(-4);
}

function formatTimestamp(ts: string | number): string {
  try {
    const d = typeof ts === 'string' ? new Date(ts) : new Date(ts);
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return String(ts);
  }
}

/* ── Constants ──────────────────────────────────────────────────────── */
const DUST_THRESHOLD_SATS = 1_000;

const HEALTH_CONFIG: Record<string, { label: string; bg: string; border: string; text: string }> = {
  HEALTHY:    { label: 'Healthy',    bg: 'bg-green-500/20',  border: 'border-green-500/30',  text: 'text-green-400' },
  ILLIQUID:   { label: 'Illiquid',   bg: 'bg-orange-500/20', border: 'border-orange-500/30', text: 'text-orange-400' },
  BELOW_FEES: { label: 'Below Fees', bg: 'bg-yellow-500/20', border: 'border-yellow-500/30', text: 'text-yellow-400' },
  STALE:      { label: 'Stale',      bg: 'bg-slate-500/20',  border: 'border-slate-500/30',  text: 'text-slate-400' },
  NO_ROUTES:  { label: 'No Routes',  bg: 'bg-red-500/20',    border: 'border-red-500/30',    text: 'text-red-400' },
};

const FEASIBILITY_CONFIG: Record<string, { label: string; text: string; bg: string; border: string }> = {
  'profitable':       { label: 'Profitable',   text: 'text-green-400',  bg: 'bg-green-500/15',  border: 'border-green-500/25' },
  'below-fees':       { label: 'Below Fees',   text: 'text-yellow-400', bg: 'bg-yellow-500/15', border: 'border-yellow-500/25' },
  'dust-profit':      { label: 'Dust Profit',  text: 'text-yellow-400', bg: 'bg-yellow-500/15', border: 'border-yellow-500/25' },
  'liquidity-capped': { label: 'Illiquid',     text: 'text-orange-400', bg: 'bg-orange-500/15', border: 'border-orange-500/25' },
  'queue-impacted':   { label: 'Queue Impact', text: 'text-blue-400',   bg: 'bg-blue-500/15',   border: 'border-blue-500/25' },
  'shared-pool':      { label: 'Shared Pool',  text: 'text-slate-400',  bg: 'bg-slate-500/15',  border: 'border-slate-500/25' },
};

/* ── Badge components ───────────────────────────────────────────────── */
function TrustBadge({ trust }: { trust?: string }) {
  if (!trust) return null;
  const isOk = trust.toUpperCase() === 'OK';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide ${
      isOk
        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
        : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
    }`}>
      {isOk ? <ShieldCheck className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
      {trust}
    </span>
  );
}

function HealthBadge({ health }: { health?: string }) {
  if (!health) return null;
  const cfg = HEALTH_CONFIG[health] ?? HEALTH_CONFIG.NO_ROUTES;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide ${cfg.bg} ${cfg.text} border ${cfg.border}`}>
      {cfg.label}
    </span>
  );
}

function FeasibilityBadge({ feasibility }: { feasibility?: string }) {
  if (!feasibility) return null;
  const cfg = FEASIBILITY_CONFIG[feasibility];
  if (!cfg) return null;
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${cfg.text} ${cfg.bg} border ${cfg.border}`}>
      {cfg.label}
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

/* ── Slippage Sparkline ─────────────────────────────────────────────── */
function SlippageSparkline({ samples }: {
  samples: Array<{ btcInSats: string; effectivePriceBtc: string; slippagePct: number }>;
}) {
  if (!samples || samples.length < 2) return null;
  const W = 140, H = 40, PAD = 4;
  const vals = samples.map(s => s.slippagePct);
  const min = Math.min(...vals, -2);
  const max = Math.max(...vals, 2);
  const range = max - min || 1;
  const toX = (i: number) => PAD + (i / (samples.length - 1)) * (W - PAD * 2);
  const toY = (v: number) => PAD + ((max - v) / range) * (H - PAD * 2);
  const zeroY = toY(0);
  const points = samples.map((s, i) => `${toX(i)},${toY(s.slippagePct)}`).join(' ');

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[9px] text-slate-600 uppercase tracking-wider">Slippage vs input size</span>
      <div className="flex items-end gap-3">
        <svg width={W} height={H}>
          {/* Zero line */}
          <line x1={PAD} y1={zeroY} x2={W - PAD} y2={zeroY}
            stroke="#334155" strokeWidth={1} strokeDasharray="2,2" />
          {/* Curve */}
          <polyline points={points} fill="none" stroke="#6ee7b7"
            strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
          {/* Dots */}
          {samples.map((s, i) => (
            <circle key={i} cx={toX(i)} cy={toY(s.slippagePct)} r={2.5}
              fill={s.slippagePct > 0 ? '#f87171' : '#34d399'} />
          ))}
        </svg>
        {/* Sample labels */}
        <div className="flex flex-col gap-0.5 justify-end pb-1">
          {samples.map((s, i) => (
            <div key={i} className="flex gap-1.5 text-[9px] font-mono">
              <span className="text-slate-600">{fmtSats(s.btcInSats)}</span>
              <span className={s.slippagePct > 0 ? 'text-red-400' : 'text-green-400'}>
                {s.slippagePct > 0 ? '+' : ''}{s.slippagePct.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Arbitrage Panel ────────────────────────────────────────────────── */
// Replaces the old RouteSimulator.
// Reads server-computed data — no user input needed since the server already
// determines optimal position size via ternary search.
function ArbitragePanel({ routes, health, trust }: {
  routes: MarketRoute[];
  health?: string;
  trust?: string;
}) {
  const btcPrice = useAppStore((s) => s.btcPrice);

  const bestRoute = useMemo(() => {
    const trusted = routes.filter(r => r.trust !== 'WARNING');
    const profitable = trusted.filter(r =>
      r.feasibility === 'profitable' &&
      parseInt(r.executableProfitSats ?? '0', 10) > DUST_THRESHOLD_SATS
    );
    return profitable[0] ?? trusted[0] ?? routes[0];
  }, [routes]);

  if (!bestRoute) return null;

  const profitSats  = parseInt(bestRoute.executableProfitSats ?? '0', 10);
  const profitBtc   = satsToBtc(bestRoute.executableProfitSats);
  const profitUsd   = profitBtc * (btcPrice ?? 0);
  const maxBtcIn    = satsToBtc(bestRoute.maxBtcInputSats);
  const isActionable = health === 'HEALTHY' && profitSats > DUST_THRESHOLD_SATS;
  const healthCfg   = HEALTH_CONFIG[health ?? 'NO_ROUTES'] ?? HEALTH_CONFIG.NO_ROUTES;

  return (
    <div className={`rounded-xl border overflow-hidden ${
      isActionable
        ? 'border-green-500/25 bg-green-500/[0.03]'
        : 'border-white/[0.07] bg-white/[0.03]'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06]">
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5" />
          Arbitrage Opportunity
        </span>
        <div className="flex items-center gap-1.5">
          <TrustBadge trust={trust} />
          <HealthBadge health={health} />
        </div>
      </div>

      <div className="px-4 py-3 space-y-2.5">
        {isActionable ? (
          <>
            {/* Max profit */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Max Profit</span>
              <div className="text-right">
                <span className="text-sm font-mono font-bold text-green-400">
                  {fmtSats(bestRoute.executableProfitSats)}
                </span>
                {(btcPrice ?? 0) > 0 && (
                  <span className="text-[10px] text-slate-500 font-mono ml-2">
                    ≈ {fmtUsdSmart(profitUsd)}
                  </span>
                )}
              </div>
            </div>
            {/* Optimal input */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Optimal Input</span>
              <div className="text-right">
                <span className="text-sm font-mono text-slate-200">
                  {fmtSats(bestRoute.maxBtcInputSats)}
                </span>
                {(btcPrice ?? 0) > 0 && maxBtcIn > 0 && (
                  <span className="text-[10px] text-slate-500 font-mono ml-2">
                    ≈ {fmtUsdSmart(maxBtcIn * btcPrice!)}
                  </span>
                )}
              </div>
            </div>
            {/* Spread */}
            {bestRoute.spreadVsReferencePct !== undefined && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Spread vs Anchor</span>
                <span className={`text-sm font-mono font-semibold ${
                  bestRoute.spreadVsReferencePct < 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {bestRoute.spreadVsReferencePct > 0 ? '+' : ''}{bestRoute.spreadVsReferencePct.toFixed(2)}%
                </span>
              </div>
            )}
            {/* Bottleneck */}
            {bestRoute.bottleneckPool && (
              <div className="flex items-start justify-between gap-4">
                <span className="text-xs text-slate-500 flex items-center gap-1 shrink-0">
                  <Droplets className="w-3 h-3" /> Bottleneck
                </span>
                <div className="text-right">
                  <div className="text-[11px] font-mono text-slate-400">
                    {shortAddr(bestRoute.bottleneckPool)}
                  </div>
                  {bestRoute.bottleneckLiquidityBtc && (
                    <div className="text-[10px] text-slate-500">
                      {parseFloat(bestRoute.bottleneckLiquidityBtc).toFixed(5)} BTC depth
                    </div>
                  )}
                </div>
              </div>
            )}
            {/* Slippage sparkline */}
            {bestRoute.slippageSamples && bestRoute.slippageSamples.length >= 2 && (
              <div className="pt-1">
                <SlippageSparkline samples={bestRoute.slippageSamples} />
              </div>
            )}
          </>
        ) : (
          <div className="space-y-2">
            <p className={`text-xs ${healthCfg.text}`}>
              {health === 'ILLIQUID'   && 'Pool depth is too shallow — not enough liquidity to execute a meaningful trade.'}
              {health === 'BELOW_FEES' && 'Route exists but the potential profit is entirely absorbed by swap fees.'}
              {health === 'STALE'      && 'Route data is stale — waiting for the next block refresh.'}
              {health === 'NO_ROUTES'  && 'No swap routes discovered for this token yet.'}
              {!health                 && 'No actionable arbitrage detected at the current block.'}
            </p>
            {/* Still show minimal data for context */}
            {bestRoute.bottleneckLiquidityBtc && (
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500 flex items-center gap-1">
                  <Droplets className="w-3 h-3" /> Pool depth
                </span>
                <span className="font-mono text-slate-400">
                  {parseFloat(bestRoute.bottleneckLiquidityBtc).toFixed(5)} BTC
                </span>
              </div>
            )}
            {bestRoute.maxBtcInputSats && (
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500">Max safe input</span>
                <span className="font-mono text-slate-400">{fmtSats(bestRoute.maxBtcInputSats)}</span>
              </div>
            )}
            {profitSats !== 0 && (
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500">Best profit found</span>
                <span className="font-mono text-slate-400">{fmtSats(bestRoute.executableProfitSats)}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Route Card v2 ──────────────────────────────────────────────────── */
function RouteCard({ route, index }: { route: MarketRoute; index: number }) {
  const btcPrice = useAppStore((s) => s.btcPrice);
  const [expanded, setExpanded] = useState(false);

  const priceBtc   = parseFloat(route.feeAdjustedPrice || route.price || '0');
  const priceUsd   = priceBtc * (btcPrice ?? 0);
  const profitSats = parseInt(route.executableProfitSats ?? '0', 10);
  const isActionable = route.feasibility === 'profitable' && profitSats > DUST_THRESHOLD_SATS && route.trust !== 'WARNING';
  const hasEconomics = route.maxBtcInputSats !== undefined || route.executableProfitSats !== undefined;
  const hasLifecycle = route.firstSeenAt !== undefined || route.appearanceCount !== undefined;
  const hasDetails   = hasEconomics || hasLifecycle || (route.slippageSamples?.length ?? 0) >= 2;

  return (
    <div className={`rounded-xl border overflow-hidden transition-colors ${
      route.isReference
        ? 'border-blue-500/25 bg-blue-500/[0.03]'
        : isActionable
          ? 'border-green-500/20 bg-green-500/[0.02]'
          : 'border-white/[0.06] bg-white/[0.02]'
    }`}>
      {/* Top: path + badges */}
      <div
        className={`flex items-start justify-between gap-2 px-3 py-2.5 ${
          hasDetails ? 'cursor-pointer hover:bg-white/[0.02] transition-colors' : ''
        }`}
        onClick={() => hasDetails && setExpanded(e => !e)}
      >
        <div className="flex items-center gap-1 flex-wrap flex-1 min-w-0">
          <span className="text-xs font-bold text-slate-500 shrink-0">#{index + 1}</span>
          {route.path?.map((sym, i) => (
            <span key={i} className="flex items-center gap-0.5">
              {i > 0 && <ArrowRight className="w-2.5 h-2.5 text-slate-600 shrink-0" />}
              <span className="text-xs font-bold text-slate-200 bg-white/[0.06] px-1.5 py-0.5 rounded">
                {sym}
              </span>
            </span>
          ))}
        </div>
        <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
          {route.isReference && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold text-blue-400 bg-blue-500/15 border border-blue-500/25">
              <Anchor className="w-2.5 h-2.5" /> Anchor
            </span>
          )}
          <FeasibilityBadge feasibility={route.feasibility} />
          <TrustBadge trust={route.trust} />
          {hasDetails && (
            <span className={`text-[10px] text-slate-600 ml-0.5 transition-transform inline-block ${
              expanded ? 'rotate-180' : ''
            }`}>▼</span>
          )}
        </div>
      </div>

      {/* Price row — always visible */}
      <div className="px-3 pb-2.5 grid grid-cols-2 gap-x-4 gap-y-1">
        <div className="text-[11px] text-slate-500">Price</div>
        <div className="text-right">
          <div className="text-[11px] font-mono text-slate-200">
            {fmtBtc(priceBtc)} <span className="text-slate-500">BTC</span>
          </div>
          {(btcPrice ?? 0) > 0 && (
            <div className="text-[10px] font-mono text-slate-400">{fmtUsdSmart(priceUsd)}</div>
          )}
        </div>
        <div className="text-[11px] text-slate-500">Fees</div>
        <div className="text-[11px] font-mono text-slate-200 text-right">
          {route.totalFeePct?.toFixed?.(1) ?? '0'}%
        </div>
        {route.spreadVsReferencePct !== undefined && !route.isReference && (
          <>
            <div className="text-[11px] text-slate-500">vs Anchor</div>
            <div className={`text-[11px] font-mono font-semibold text-right ${
              route.spreadVsReferencePct < 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              {route.spreadVsReferencePct > 0 ? '+' : ''}{route.spreadVsReferencePct.toFixed(2)}%
            </div>
          </>
        )}
      </div>

      {/* Expanded detail section */}
      {expanded && hasDetails && (
        <div className="border-t border-white/[0.06] px-3 py-2.5 space-y-3">
          {/* Executable economics */}
          {hasEconomics && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {route.executableProfitSats !== undefined && (
                <>
                  <div className="text-[11px] text-slate-500">Max Profit</div>
                  <div className={`text-[11px] font-mono text-right font-semibold ${
                    profitSats > DUST_THRESHOLD_SATS ? 'text-green-400' : 'text-slate-400'
                  }`}>
                    {fmtSats(route.executableProfitSats)}
                  </div>
                </>
              )}
              {route.maxBtcInputSats !== undefined && (
                <>
                  <div className="text-[11px] text-slate-500">Optimal Input</div>
                  <div className="text-[11px] font-mono text-slate-200 text-right">
                    {fmtSats(route.maxBtcInputSats)}
                  </div>
                </>
              )}
              {route.bottleneckPool && (
                <>
                  <div className="text-[11px] text-slate-500 flex items-center gap-1">
                    <Droplets className="w-2.5 h-2.5" /> Pool Depth
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] font-mono text-slate-400">
                      {shortAddr(route.bottleneckPool)}
                    </div>
                    {route.bottleneckLiquidityBtc && (
                      <div className="text-[10px] text-slate-500">
                        {parseFloat(route.bottleneckLiquidityBtc).toFixed(5)} BTC
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Slippage sparkline */}
          {route.slippageSamples && route.slippageSamples.length >= 2 && (
            <SlippageSparkline samples={route.slippageSamples} />
          )}

          {/* Lifecycle row */}
          {hasLifecycle && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 border-t border-white/[0.04]">
              {route.firstSeenAt && (
                <div className="flex items-center gap-1 text-[10px] text-slate-500">
                  <Clock className="w-2.5 h-2.5" />
                  First seen {fmtTimeAgo(route.firstSeenAt)}
                </div>
              )}
              {route.appearanceCount !== undefined && (
                <div className="text-[10px] text-slate-500">
                  Seen {route.appearanceCount}×
                  {route.bestRouteCount ? ` · best ${route.bestRouteCount}×` : ''}
                </div>
              )}
              {route.avgSpreadPct !== undefined && (
                <div className="text-[10px] text-slate-500">
                  Avg spread {route.avgSpreadPct > 0 ? '+' : ''}{route.avgSpreadPct.toFixed(1)}%
                </div>
              )}
              {route.lastVerifiedBlock && (
                <div className="text-[10px] text-slate-500">
                  Block #{route.lastVerifiedBlock}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Route sort helper ──────────────────────────────────────────────── */
function sortRoutes(routes: MarketRoute[]): {
  anchors: MarketRoute[];
  opportunities: MarketRoute[];
  informational: MarketRoute[];
} {
  const anchors = routes.filter(r => r.isReference);
  const opportunities = routes
    .filter(r =>
      !r.isReference &&
      r.feasibility === 'profitable' &&
      parseInt(r.executableProfitSats ?? '0', 10) > DUST_THRESHOLD_SATS &&
      r.trust !== 'WARNING'
    )
    .sort((a, b) =>
      parseInt(b.executableProfitSats ?? '0', 10) -
      parseInt(a.executableProfitSats ?? '0', 10)
    );
  const informational = routes.filter(r =>
    !r.isReference &&
    !(
      r.feasibility === 'profitable' &&
      parseInt(r.executableProfitSats ?? '0', 10) > DUST_THRESHOLD_SATS &&
      r.trust !== 'WARNING'
    )
  );
  return { anchors, opportunities, informational };
}

/* ── Main Component ─────────────────────────────────────────────────── */
export default function TokenRoutePopup({ tokenContract, symbol, onClose }: Props) {
  const { t } = useTranslation();
  const btcPrice = useAppStore((s) => s.btcPrice);
  const [detail, setDetail] = useState<LocalRouteDetail | null>(null);
  const [chartHistory, setChartHistory] = useState<HistoryResponse | null>(null);
  const [chartMode, setChartMode] = useState<'line' | 'candle'>('line');
  const [chartSource, setChartSource] = useState<'motoswap' | 'nativeswap'>('motoswap');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { connected: wsConnected, routeData: liveRouteData, lastBlock } = useTokenChannel(tokenContract ?? null);

  const load = useCallback(async () => {
    if (!tokenContract) return;
    try {
      setLoading(true);
      setError(null);
      const [routeDetail, history] = await Promise.all([
        fetchTokenRoutes(tokenContract),
        fetchTokenHistory(tokenContract, '1h', 'USD', '1w', chartSource),
      ]);
      setDetail(routeDetail as LocalRouteDetail);
      setChartHistory(history);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [tokenContract, chartSource]);

  useEffect(() => { load(); }, [load]);

  const displayData = useMemo(() => {
    if (!detail) return null;
    if (!liveRouteData) return detail;
    return { ...detail, price: liveRouteData.bestPriceBtc || detail.price };
  }, [detail, liveRouteData]);

  const style = getTokenStyle(tokenContract ?? undefined, symbol);
  const opscanUrl = (addr: string) => `https://opscan.org/tokens/${addr}?network=mainnet`;

  const sortedRoutes = useMemo(() => {
    if (!displayData?.routes) return null;
    return sortRoutes(displayData.routes);
  }, [displayData?.routes]);

  // Suppress unused import warning
  void t;

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
          {/* ── Header — UNCHANGED ─────────────────────────────────────── */}
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

          {/* ── Content ──────────────────────────────────────────────── */}
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
                <button
                  onClick={load}
                  className="text-sm px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:text-white transition-colors"
                >
                  Retry
                </button>
              </div>
            )}

            {!loading && !error && displayData && (
              <>
                {/* Price Chart — UNCHANGED */}
                <PriceChart
                  data={chartHistory?.candles ?? []}
                  mode={chartMode}
                  onModeChange={setChartMode}
                  livePrice={displayData.price}
                  color={style.hex}
                  source={chartSource}
                  onSourceChange={setChartSource}
                />

                {/* Arbitrage Panel (replaces Route Simulator) */}
                {displayData.routes && displayData.routes.length > 0 && (
                  <ArbitragePanel
                    routes={displayData.routes}
                    health={displayData.bestRouteHealth}
                    trust={displayData.bestRouteTrust}
                  />
                )}

                {/* Current Best Price */}
                <div className="bg-white/[0.04] border border-white/[0.07] rounded-xl p-4">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Current Best Price</div>
                  <div className="flex flex-col gap-1.5">
                    {btcPrice && parseFloat(displayData.price) > 0 && (
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-mono font-bold text-white">
                          ${fmtAutoDecimal(parseFloat(displayData.price) * btcPrice)}
                        </span>
                        <span className="text-sm text-slate-400 font-mono">USD</span>
                      </div>
                    )}
                    {parseFloat(displayData.price) > 0 && (
                      <div className="flex items-baseline gap-2">
                        <span className="text-lg font-mono font-bold text-slate-300">
                          {fmtAutoDecimal(parseFloat(displayData.price))}
                        </span>
                        <span className="text-sm text-slate-500 font-mono">BTC</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <StatBox
                    label="Market Cap"
                    value={fmtUsd((parseFloat(displayData.marketcap) || 0) * (btcPrice ?? 0))}
                  />
                  <StatBox label="Routes" value={String(displayData.routes?.length ?? 0)} />
                  <StatBox label="Buy Tax" value={`${displayData.buyTax ?? 0}%`} />
                  <StatBox label="Sell Tax" value={`${displayData.sellTax ?? 0}%`} />
                </div>

                {/* Routes */}
                {sortedRoutes && displayData.routes && displayData.routes.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider">Routes</span>
                      <span className="text-[10px] text-slate-600">{displayData.routes.length} total</span>
                    </div>

                    {/* Anchor route — always first */}
                    {sortedRoutes.anchors.map((r, i) => (
                      <RouteCard key={`anchor-${i}`} route={r} index={i} />
                    ))}

                    {/* Profitable opportunities */}
                    {sortedRoutes.opportunities.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-[10px] text-green-500/60 uppercase tracking-wider pl-1 pt-1">
                          Opportunities ({sortedRoutes.opportunities.length})
                        </div>
                        {sortedRoutes.opportunities.map((r, i) => (
                          <RouteCard
                            key={`opp-${i}`}
                            route={r}
                            index={sortedRoutes.anchors.length + i}
                          />
                        ))}
                      </div>
                    )}

                    {/* Informational — collapsed by default */}
                    {sortedRoutes.informational.length > 0 && (
                      <details>
                        <summary className="text-[10px] text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-400 transition-colors select-none pl-1 pt-1 pb-1.5 list-none flex items-center gap-1">
                          <span>Informational ({sortedRoutes.informational.length})</span>
                          <span className="text-[9px] text-slate-600">(click to expand)</span>
                        </summary>
                        <div className="space-y-2 pt-1">
                          {sortedRoutes.informational.map((r, i) => (
                            <RouteCard
                              key={`info-${i}`}
                              route={r}
                              index={sortedRoutes.anchors.length + sortedRoutes.opportunities.length + i}
                            />
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                )}

                {/* Last Trade */}
                {displayData.lastTradePrice && (
                  <div className="bg-white/[0.04] border border-white/[0.07] rounded-xl p-4 space-y-2">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider">Last Trade</div>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                      <div className="text-[11px] text-slate-500">Price</div>
                      <div className="text-[11px] font-mono text-slate-200 text-right">
                        {fmtBtc(displayData.lastTradePrice)}
                      </div>
                      <div className="text-[11px] text-slate-500">Volume</div>
                      <div className="text-[11px] font-mono text-slate-200 text-right">
                        {fmtBtc(displayData.lastTradeVolumeBtc ?? '0')}
                      </div>
                      <div className="text-[11px] text-slate-500">Time</div>
                      <div className="text-[11px] font-mono text-slate-200 text-right">
                        {formatTimestamp(displayData.lastTradeTime ?? Date.now())}
                      </div>
                      <div className="text-[11px] text-slate-500">Block</div>
                      <div className="text-[11px] font-mono text-slate-200 text-right">
                        {displayData.blockHeight ?? '—'}
                      </div>
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
