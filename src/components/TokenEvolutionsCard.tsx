import { useEffect, useRef, useState, memo, useCallback } from 'react';
import {
  createChart,
  ColorType,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from 'lightweight-charts';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, Database, Loader2, AlertCircle, Eye, EyeOff, RotateCcw, ChevronDown } from 'lucide-react';
import { usePortfolioHistory, type TimeRange, type ViewMode, type ChartSeries } from '../hooks/usePortfolioHistory';
import { useTokenVisibility, type TokenVisibilityEntry } from '../hooks/useTokenVisibility';
import { clearAllSnapshots } from '../lib/snapshotStore';

// ── Constants ─────────────────────────────────────────────────────────────────

const TIME_RANGES: TimeRange[] = ['1H', '6H', '24H', '7D', 'ALL'];

// ── Time Range Dropdown ───────────────────────────────────────────────────────

function TimeRangeDropdown({ value, onChange }: { value: TimeRange; onChange: (r: TimeRange) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-1 text-[11px] font-semibold transition-all py-1 px-2.5 rounded-lg ${open ? "text-dark-200 bg-dark-700/60" : "text-dark-400 bg-dark-900/60 hover:text-dark-200 hover:bg-dark-800/60"}`}
      >
        {value}
        <ChevronDown className={`w-3 h-3 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            key="tr-dropdown"
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.12 }}
            className="absolute right-0 top-full mt-1 z-50 bg-dark-900 rounded-xl overflow-hidden shadow-xl shadow-black/40"
          >
            {TIME_RANGES.map(r => (
              <button
                key={r}
                onClick={() => { onChange(r); setOpen(false); }}
                className={`w-full text-left px-4 py-2 text-[11px] font-semibold transition-colors ${
                  r === value
                    ? 'text-white bg-dark-700/60'
                    : 'text-dark-400 hover:text-dark-200 hover:bg-dark-800/60'
                }`}
              >
                {r}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


const VIEW_MODES: { id: ViewMode; label: string }[] = [
  { id: 'total_btc',  label: 'Total BTC'  },
  { id: 'total_usd',  label: 'Total USD'  },
  { id: 'per_token',  label: 'Per Token'  },
  { id: 'per_wallet', label: 'Per Wallet' },
];

const CHART_HEIGHT = 240;

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function fmtTs(ts: number | null): string {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ── Chart core (memoized to avoid recreation on parent re-renders) ─────────────

interface ChartCoreProps {
  series:        ChartSeries[];
  viewMode:      ViewMode;
  showRawAmount: boolean;
}

function ChartCoreInner({ series, viewMode, showRawAmount }: ChartCoreProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef     = useRef<IChartApi | null>(null);
  const seriesRefs   = useRef<ISeriesApi<'Line'>[]>([]);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#6b7280',
        fontSize: 11,
        fontFamily: 'Inter, system-ui, sans-serif',
      },
      grid: {
        vertLines: { color: '#1a1a28', style: LineStyle.Dashed },
        horzLines: { color: '#1a1a28', style: LineStyle.Dashed },
      },
      crosshair: {
        vertLine: { color: '#f97316', width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#f97316' },
        horzLine: { color: '#f97316', width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#f97316' },
      },
      rightPriceScale: { borderColor: '#1a1a28', textColor: '#6b7280' },
      timeScale: {
        borderColor: '#1a1a28',
        timeVisible: true,
        secondsVisible: false,
        fixLeftEdge: true,
        fixRightEdge: true,
      },
      handleScroll: true,
      handleScale: true,
      width:  containerRef.current.clientWidth,
      height: CHART_HEIGHT,
    });
    chartRef.current   = chart;
    seriesRefs.current = [];
    const ro = new ResizeObserver(() => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth });
    });
    ro.observe(containerRef.current);
    return () => { ro.disconnect(); chart.remove(); chartRef.current = null; seriesRefs.current = []; };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    for (const s of seriesRefs.current) { try { chart.removeSeries(s); } catch { /* ignore */ } }
    seriesRefs.current = [];
    if (series.length === 0) return;
    const isSingle = series.length === 1;
    for (const s of series) {

      const lineSeries = chart.addLineSeries({
        color: s.color, lineWidth: isSingle ? 2 : 1,
        priceLineVisible: isSingle, priceLineColor: s.color, priceLineWidth: 1,
        priceLineStyle: LineStyle.Dashed, lastValueVisible: true,
        crosshairMarkerVisible: true, crosshairMarkerRadius: 4,
        crosshairMarkerBorderColor: s.color, crosshairMarkerBackgroundColor: '#0a0a0f',
        title: s.label,
        priceFormat: (viewMode !== 'total_usd' && !showRawAmount)
          ? { type: 'price' as const, precision: 5, minMove: 0.00001 }
          : { type: 'price' as const, precision: 2, minMove: 0.01 },
      });
      const deduped = new Map<number, number>();
      for (const p of s.data) deduped.set(p.time, p.value);
      const sorted = Array.from(deduped.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([time, value]) => ({ time: time as Time, value }));
      try { lineSeries.setData(sorted); } catch { /* ignore stale */ }
      seriesRefs.current.push(lineSeries);
    }
    chart.timeScale().fitContent();
  }, [series, viewMode]);

  return <div ref={containerRef} style={{ height: CHART_HEIGHT }} />;
}

const ChartCore = memo(ChartCoreInner);

// ── Legend ────────────────────────────────────────────────────────────────────

function Legend({ series }: { series: ChartSeries[] }) {
  if (series.length <= 1) return null;
  return (
    <div className="flex flex-wrap gap-3 mt-3">
      {series.map(s => (
        <div key={s.id} className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 rounded-full inline-block" style={{ backgroundColor: s.color }} />
          <span className="text-[11px] text-gray-400 font-medium">{s.label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Token pill (filter panel) ─────────────────────────────────────────────────

function TokenPill({ entry, onToggle }: { entry: TokenVisibilityEntry; onToggle: (addr: string) => void }) {
  const coreStyle      = entry.isCore
    ? 'border-dark-600/60 bg-dark-700/40 text-dark-200'
    : 'border-dark-700/40 bg-dark-800/30 text-dark-500';
  const hiddenOverlay  = !entry.isVisible ? 'opacity-40 line-through' : '';
  return (
    <button
      onClick={() => onToggle(entry.address)}
      title={`${entry.isVisible ? 'Hide' : 'Show'} ${entry.symbol} (${entry.isCore ? 'core' : 'discovered'})`}
      className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-semibold transition-all hover:opacity-100 ${coreStyle} ${hiddenOverlay}`}
    >
      {entry.isVisible
        ? <Eye    className="w-3 h-3 shrink-0" />
        : <EyeOff className="w-3 h-3 shrink-0 text-dark-600" />}
      {entry.symbol}
    </button>
  );
}

// ── Filter Panel ──────────────────────────────────────────────────────────────

interface FilterPanelProps {
  entries:             TokenVisibilityEntry[];
  showDiscovered:      boolean;
  onToggleToken:       (addr: string) => void;
  onToggleDiscovered:  () => void;
  onReset:             () => void;
}

function FilterPanel({ entries, showDiscovered, onToggleToken, onToggleDiscovered, onReset }: FilterPanelProps) {
  const coreEntries       = entries.filter(e => e.isCore);
  const discoveredEntries = entries.filter(e => !e.isCore);
  const hiddenCount       = entries.filter(e => !e.isVisible).length;

  return (
    <motion.div
      key="filter-panel"
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.18 }}
      className="overflow-hidden"
    >
      <div className="border border-dark-700/50 rounded-xl bg-dark-900/40 p-4 mb-4 space-y-3">

        {/* Header row */}
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-dark-400 uppercase tracking-wider">Token Filter</span>
          <div className="flex items-center gap-3">
            {hiddenCount > 0 && (
              <span className="text-[11px] text-dark-600">{hiddenCount} hidden</span>
            )}
            <button
              onClick={onReset}
              className="flex items-center gap-1 text-[11px] text-dark-600 hover:text-dark-300 transition-colors"
              title="Reset to defaults"
            >
              <RotateCcw className="w-3 h-3" /> Reset
            </button>
          </div>
        </div>

        {/* Core tokens */}
        {coreEntries.length > 0 && (
          <div>
            <div className="text-[10px] font-semibold text-dark-500 uppercase tracking-wider mb-1.5">Core</div>
            <div className="flex flex-wrap gap-1.5">
              {coreEntries.map(e => (
                <TokenPill key={e.address} entry={e} onToggle={onToggleToken} />
              ))}
            </div>
          </div>
        )}

        {/* Discovered tokens */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <div className="text-[10px] font-semibold text-dark-500 uppercase tracking-wider">
              Discovered{discoveredEntries.length > 0 && ` (${discoveredEntries.length})`}
            </div>
            {/* Master toggle */}
            <button
              onClick={onToggleDiscovered}
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold border transition-all ${
                showDiscovered
                  ? 'bg-brand-500/20 border-brand-500/40 text-brand-400'
                  : 'bg-dark-800/40 border-dark-600/40 text-dark-500 hover:text-dark-300'
              }`}
            >
              {showDiscovered ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
              Show all discovered
            </button>
          </div>
          {discoveredEntries.length === 0 ? (
            <span className="text-[11px] text-dark-700 italic">No discovered tokens in history yet</span>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {discoveredEntries.map(e => (
                <TokenPill key={e.address} entry={e} onToggle={onToggleToken} />
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

function TokenEvolutionsCardInner() {
  const [timeRange,     setTimeRange]     = useState<TimeRange>('24H');
  const [viewMode,      setViewMode]      = useState<ViewMode>('total_btc');
  const [filterOpen,    setFilterOpen]    = useState(false);
  const [clearing,      setClearing]      = useState(false);
  const [showRawAmount, setShowRawAmount] = useState(false);

  const visibility = useTokenVisibility();

  const { series, isSaving, lastSavedTs, stats, error, tokenIndex, reload } =
    usePortfolioHistory(timeRange, viewMode, visibility.isVisible, showRawAmount);

  // Build token entries for the filter panel (only tokens that have appeared in history)
  const filterEntries = visibility.buildEntries(tokenIndex);

  const isEmpty   = series.length === 0 || series.every(s => s.data.length === 0);
  const noHistory = !stats || stats.count === 0;

  const handleClear = async () => {
    if (!confirm('Clear all portfolio history snapshots? This cannot be undone.')) return;
    setClearing(true);
    try { await clearAllSnapshots(); await reload(); } finally { setClearing(false); }
  };

  // Reload when visibility changes
  const stableIsVisible = visibility.isVisible;
  useEffect(() => { reload(); }, [stableIsVisible, reload]);

  // Count hidden discovered tokens for eye button badge
  const hiddenDiscoveredCount = filterEntries.filter(e => !e.isCore && !e.isVisible).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 }}
      className="col-span-full bg-dark-800/60 backdrop-blur-sm border border-dark-700/50 rounded-2xl p-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-dark-300 uppercase tracking-wider">
            Token Evolutions
          </h2>
          {isSaving && (
            <span className="flex items-center gap-1 text-[10px] text-brand-400 font-medium">
              <Loader2 className="w-3 h-3 animate-spin" /> saving
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Raw amount toggle — only in Per Token view */}
          {viewMode === 'per_token' && (
            <div className="flex items-center gap-0.5 bg-dark-900/60 rounded-lg p-0.5">
              <button
                onClick={() => setShowRawAmount(false)}
                title="Show value in BTC"
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                  !showRawAmount
                    ? 'bg-brand-500/30 text-brand-300 border border-brand-500/40'
                    : 'text-dark-400 hover:text-dark-200'
                }`}
              >
                ₿ Value
              </button>
              <button
                onClick={() => setShowRawAmount(true)}
                title="Show raw token amount"
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                  showRawAmount
                    ? 'bg-brand-500/30 text-brand-300 border border-brand-500/40'
                    : 'text-dark-400 hover:text-dark-200'
                }`}
              >
                # Amount
              </button>
            </div>
          )}

          {/* Eye / filter toggle button */}
          <button
            onClick={() => setFilterOpen(v => !v)}
            title={filterOpen ? 'Hide token filter' : 'Show token filter'}
            className={`relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition-all ${
              filterOpen
                ? 'bg-brand-500/20 border-brand-500/40 text-brand-400'
                : 'bg-dark-700/40 border-dark-600/40 text-dark-400 hover:text-dark-200 hover:border-dark-500/60'
            }`}
          >
            {filterOpen ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            Tokens
            {hiddenDiscoveredCount > 0 && !filterOpen && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-brand-500 text-white text-[9px] font-bold flex items-center justify-center">
                {hiddenDiscoveredCount > 9 ? '9+' : hiddenDiscoveredCount}
              </span>
            )}
          </button>

          {/* View mode toggle */}
          <div className="flex items-center gap-1 bg-dark-900/60 rounded-lg p-0.5">
            {VIEW_MODES.map(v => (
              <button
                key={v.id}
                onClick={() => setViewMode(v.id)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                  viewMode === v.id
                    ? 'bg-brand-500/30 text-brand-300 border border-brand-500/40'
                    : 'text-dark-400 hover:text-dark-200'
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>

          {/* Time range selector */}
          <TimeRangeDropdown value={timeRange} onChange={setTimeRange} />
        </div>
      </div>

      {/* Collapsible filter panel */}
      <AnimatePresence>
        {filterOpen && (
          <FilterPanel
            entries={filterEntries}
            showDiscovered={visibility.showDiscovered}
            onToggleToken={visibility.toggleToken}
            onToggleDiscovered={visibility.toggleShowDiscovered}
            onReset={visibility.reset}
          />
        )}
      </AnimatePresence>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mb-3">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Chart area */}
      {noHistory ? (
        <div className="flex flex-col items-center justify-center gap-3 text-center" style={{ height: CHART_HEIGHT }}>
          <div className="text-3xl">📊</div>
          <div>
            <div className="text-sm font-semibold text-white">No history yet</div>
            <div className="text-xs text-gray-600 mt-1">
              A snapshot is recorded every new block after positions load.
              <br />Check back after the next refresh.
            </div>
          </div>
        </div>
      ) : isEmpty ? (
        <div className="flex flex-col items-center justify-center gap-2 text-center" style={{ height: CHART_HEIGHT }}>
          <div className="text-2xl">🔍</div>
          <div className="text-sm text-gray-500">No priced data in this time range</div>
          <div className="text-xs text-gray-700">Try a wider range or enable more tokens in the filter.</div>
        </div>
      ) : (
        <>
          <ChartCore series={series} viewMode={viewMode} showRawAmount={showRawAmount} />
          <Legend series={series} />
        </>
      )}

      {/* Footer stats */}
      {stats && stats.count > 0 && (
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-dark-700/40">
          <div className="flex items-center gap-3 text-[11px] text-dark-500">
            <span className="flex items-center gap-1">
              <Database className="w-3 h-3" />
              {stats.count} snapshots · {fmtBytes(stats.estimatedBytes)}
            </span>
            {lastSavedTs && <span>Last saved: {fmtTs(lastSavedTs)}</span>}
          </div>
          <button
            onClick={handleClear}
            disabled={clearing}
            className="text-[11px] text-dark-600 hover:text-red-400 transition-colors disabled:opacity-50"
          >
            {clearing ? 'Clearing…' : 'Clear history'}
          </button>
        </div>
      )}
    </motion.div>
  );
}

export const TokenEvolutionsCard = memo(TokenEvolutionsCardInner);
