import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { ExternalLink, AlertTriangle } from 'lucide-react';
import { fetchRouterTokens, fetchTrackedTokens, type TrackedToken } from '../api/slowphie';
import { getTokenStyle } from '../lib/tokenColors';
import { useAppStore } from '../store';
import TokenRoutePopup from '../components/TokenRoutePopup';
import SearchFilterBar, { type FilterState } from '../components/SearchFilterBar';
import { TokenGridSkeleton } from '../components/TokenCardSkeleton';
import { LoadingSpinner } from '../components/LoadingSpinner';
const STATIC_TOKEN_ICONS: Record<string, string> = {
  BTC:   'https://raw.githubusercontent.com/btc-vision/contract-logo/main/contracts/bitcoin.png',
  MOTO:  'https://raw.githubusercontent.com/btc-vision/contract-logo/main/contracts/op1sqrxd0p3kd234wc5n2z7pl4hs82y8kpk4fqj9h78a.png',
  PILL:  'https://raw.githubusercontent.com/btc-vision/contract-logo/main/contracts/op1sqz0f729q22dv6trrvhn9msl9enqqaazy5cjy4ej6.png',
  MCHAD: '/tokens/MCHAD.jpg',
  BLUE:  '/tokens/BLUE.jpg',
};

/* ── Token icon component (same logic as TokenTotalsCard) ───────────── */
function TokenIcon({ symbol, contractAddress, size = 40 }: { symbol: string; contractAddress?: string; size?: number }) {
  const storeIcons = useAppStore((s) => s.tokenIcons);
  const [err, setErr] = useState(false);
  const key = symbol.toUpperCase();
  const addrKey = contractAddress ? `addr:${contractAddress.toLowerCase()}` : null;
  let url: string | undefined;
  if (addrKey) { url = storeIcons[addrKey] ?? STATIC_TOKEN_ICONS[key]; }
  else { url = storeIcons[key] ?? STATIC_TOKEN_ICONS[key]; }
  const abbr = symbol.replace(/[^A-Z0-9]/gi, '').slice(0, 2).toUpperCase();

  if (url && !err) {
    return (
      <img
        src={url}
        alt={symbol}
        className="object-contain"
        style={{ width: size, height: size, borderRadius: '50%' }}
        onError={() => setErr(true)}
      />
    );
  }
  return (
    <span
      className="inline-flex items-center justify-center bg-dark-700 text-white font-bold text-xs"
      style={{ width: size, height: size, borderRadius: '50%' }}
    >
      {abbr}
    </span>
  );
}

/* ── Formatters ─────────────────────────────────────────────────────── */
function shortAddr(addr: string): string {
  if (!addr) return '';
  return addr.slice(0, 6) + '…' + addr.slice(-4);
}

function fmtTimeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/* ── Animation variants ─────────────────────────────────────────────── */
const containerVariants = { hidden: {}, visible: { transition: { staggerChildren: 0.05 } } };
const cardVariants = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] } } };

/* ── Main component ─────────────────────────────────────────────────── */
/* ── Main component ─────────────────────────────────────────────────── */
export default function OpRouter() {
  const { t } = useTranslation();
  const [tokens, setTokens] = useState<TrackedToken[]>([]);
  const [totalTokens, setTotalTokens] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mergeTokenIcons = useAppStore((s) => s.mergeTokenIcons);

  // Filter state
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    trust: 'all',
    sort: 'deployedAt_asc',
  });

  // Popup state
  const [popupToken, setPopupToken] = useState<{ tokenContract: string | undefined; symbol: string } | null>(null);

  const load = useCallback(async (currentFilters: FilterState) => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchRouterTokens({
        search: currentFilters.search || undefined,
        trust: currentFilters.trust !== 'all' ? currentFilters.trust : undefined,
        sort: currentFilters.sort,
        limit: 5000,
        offset: 0,
      });
      // Extract icons from API response and merge into store (collision-safe)
      const allItems = [...data.tokens, ...data.pools];
      const symbolIconCount: Record<string, number> = {};
      for (const t of allItems) {
        if (t.icon && t.icon.startsWith('http')) {
          const sym = t.symbol.toUpperCase();
          symbolIconCount[sym] = (symbolIconCount[sym] ?? 0) + 1;
        }
      }
      const icons: Record<string, string> = {};
      for (const t of allItems) {
        if (t.icon && t.icon.startsWith('http')) {
          const sym = t.symbol.toUpperCase();
          if ((symbolIconCount[sym] ?? 0) <= 1) {
            icons[sym] = t.icon;
          }
          if (t.address) {
            icons[`addr:${t.address.toLowerCase()}`] = t.icon;
          }
        }
      }
      if (Object.keys(icons).length > 0) mergeTokenIcons(icons);
      // Filter tokens: remove BTC (not a real tracked token) and dedupe
      const all = [...data.tokens];
      const seen = new Set<string>();
      const unique: TrackedToken[] = [];
      for (const t of all) {
        if (!t.address || seen.has(t.address.toLowerCase())) continue;
        if (t.symbol.toUpperCase() === 'BTC') continue;
        seen.add(t.address.toLowerCase());
        unique.push(t);
      }
      setTokens(unique);
      setTotalTokens(data.total);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load tokens');
    } finally {
      setLoading(false);
    }
  }, [mergeTokenIcons]);

  useEffect(() => {
    load(filters);
  }, [load, filters]);

  // Load ALL token icons once (unfiltered) so non-swappable tokens like ICHI
  // still have their icons resolved when referenced on the router page.
  useEffect(() => {
    let cancelled = false;
    fetchTrackedTokens()
      .then((data) => {
        if (cancelled) return;
        const allItems = [...data.tokens, ...data.pools];
        const symbolIconCount: Record<string, number> = {};
        for (const t of allItems) {
          if (t.icon && t.icon.startsWith('http')) {
            const sym = t.symbol.toUpperCase();
            symbolIconCount[sym] = (symbolIconCount[sym] ?? 0) + 1;
          }
        }
        const icons: Record<string, string> = {};
        for (const t of allItems) {
          if (t.icon && t.icon.startsWith('http')) {
            const sym = t.symbol.toUpperCase();
            if ((symbolIconCount[sym] ?? 0) <= 1) {
              icons[sym] = t.icon;
            }
            if (t.address) {
              icons[`addr:${t.address.toLowerCase()}`] = t.icon;
            }
          }
        }
        if (Object.keys(icons).length > 0) mergeTokenIcons(icons);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [mergeTokenIcons]);

  const handleIconClick = (token: TrackedToken) => {
    setPopupToken({ tokenContract: token.address, symbol: token.symbol });
  };

  const opscanUrl = (addr: string) => `https://opscan.org/tokens/${addr}?network=mainnet`;


  return (
    <div className="relative min-h-[calc(100vh-4rem)] bg-grid pb-16 overflow-hidden">
      {/* Ambient glows */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[700px] h-[400px] rounded-full bg-[#4ade80]/4 blur-[140px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[300px] rounded-full bg-[#22d3ee]/4 blur-[120px] pointer-events-none" />

      <div className="max-w-6xl mx-auto px-4 pt-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="text-center mb-10 space-y-3"
        >
          <h1 className="text-4xl md:text-5xl font-extrabold text-white">
            {t('router.heroTitle')}{' '}
            <span className="text-gradient">{t('router.heroGradient')}</span>
          </h1>
          <p className="text-gray-400 max-w-lg mx-auto text-sm">
            {t('router.heroSubtitle')}
          </p>
        </motion.div>

        {/* Stats bar */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="flex items-center justify-center gap-4 mb-6"
        >
          <div className="glass rounded-xl px-4 py-2 text-xs text-gray-400">
            <span className="text-white font-semibold">{totalTokens}</span> tokens tracked
          </div>
        </motion.div>

        {/* Search & Filters */}
        {!loading && !error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mb-6"
          >
            <SearchFilterBar
              filters={filters}
              onChange={setFilters}
              totalCount={totalTokens}
              showingCount={tokens.length}
            />
          </motion.div>
        )}

        {/* Loading skeleton */}
        {loading && <TokenGridSkeleton count={12} />}

        {/* Error */}
        {error && (
          <div className="text-center py-20">
            <p className="text-red-400 text-sm mb-3">{error}</p>
            <button
              onClick={() => load(filters)}
              className="text-sm px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:text-white hover:bg-white/10 transition-all"
            >
              {t('common.refresh')}
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && tokens.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20"
          >
            <p className="text-gray-500 text-sm">{t('router.noResults', 'No tokens match your filters')}</p>
          </motion.div>
        )}

        {/* Token Grid */}
        {!loading && !error && (
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {tokens.map((token) => {
              const style = getTokenStyle(token.address, token.symbol);
              const isBtc = token.symbol.toUpperCase() === 'BTC';

              return (
                <motion.div
                  key={token.address}
                  variants={cardVariants}
                  className="glass-card group relative p-5 flex flex-col gap-4 transition-all duration-200 hover:-translate-y-0.5 cursor-pointer"
                  style={{
                    borderColor: `${style.hex}30`,
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.borderColor = `${style.hex}80`;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.borderColor = `${style.hex}30`;
                  }}
                  onClick={() => handleIconClick(token)}
                >
                  {/* Top row: icon + symbol badge */}
                  <div className="flex items-start justify-between">
                    <button
                      className="appearance-none bg-transparent flex items-center justify-center shrink-0 overflow-hidden cursor-pointer hover:scale-110 transition-transform"
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: '50%',
                        border: `1px solid ${style.hex}40`,
                        background: `${style.hex}10`,
                      }}
                      title={t('market.price', 'Market info')}
                    >
                      <TokenIcon symbol={token.symbol} contractAddress={token.address} size={32} />
                    </button>
                    <span
                      className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md border"
                      style={{
                        color: style.hex,
                        borderColor: `${style.hex}30`,
                        background: `${style.hex}10`,
                      }}
                    >
                      {token.symbol}
                    </span>
                  </div>

                  {/* Name */}
                  <div className="min-h-[2.5rem]">
                    <h3 className="text-base font-bold text-white leading-snug">
                      {token.name || token.symbol}
                    </h3>
                    {token.name && token.name !== token.symbol && (
                      <p className="text-xs text-gray-500 mt-0.5">{token.symbol}</p>
                    )}
                  </div>

                  {/* Swap meta */}
                  {token.swapMeta && (
                    <div className="flex items-center gap-2 text-[11px]">
                      <span className="px-1.5 py-0.5 rounded bg-white/5 text-gray-400 border border-white/5">
                        {token.swapMeta.routeCount} route{token.swapMeta.routeCount > 1 ? 's' : ''}
                      </span>
                      <span className="text-gray-500 ml-auto">
                        {fmtTimeAgo(token.swapMeta.lastRouteUpdate)}
                      </span>
                    </div>
                  )}

                  {/* Swap pair counts */}
                  {token.swapPairCounts && (
                    <div className="flex items-center gap-2 text-[11px]">
                      {token.swapPairCounts.motoSwap > 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {token.swapPairCounts.motoSwap} MotoSwap
                        </span>
                      )}
                      {token.swapPairCounts.nativeSwap > 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                          {token.swapPairCounts.nativeSwap} NativeSwap
                        </span>
                      )}
                    </div>
                  )}

                  {/* Warning badge */}
                  {token.trust === 'warning' && (
                    <div className="flex items-center gap-1.5 text-[11px] text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded px-2 py-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span className="font-semibold">Warning</span>
                    </div>
                  )}

                  {/* Address + opscan link */}
                  <a
                    href={opscanUrl(token.address)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors mt-auto pt-2 border-t border-white/5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="font-mono">{shortAddr(token.address)}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </motion.div>
              );
            })}
          </motion.div>
        )}

        {/* Footer links */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-10 flex flex-wrap justify-center gap-6 text-xs text-gray-600"
        >
          <a href="https://opnet.org" target="_blank" rel="noopener noreferrer" className="hover:text-gray-400 transition-colors">opnet.org ↗</a>
          <a href="https://opscan.org/tokens?network=mainnet" target="_blank" rel="noopener noreferrer" className="hover:text-gray-400 transition-colors">Explorer ↗</a>
        </motion.div>
      </div>

      {/* Route info popup */}
      {popupToken && (
        <TokenRoutePopup
          tokenContract={popupToken.tokenContract ?? null}
          symbol={popupToken.symbol}
          onClose={() => setPopupToken(null)}
        />
      )}
    </div>
  );
}
