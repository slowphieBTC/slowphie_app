/**
 * usePortfolioHistory — triggers portfolio snapshots on each new block
 * and exposes decoded chart series for TokenEvolutionsCard.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { useAppStore } from '../store';
import { buildAndSaveSnapshot } from '../lib/portfolioSnapshot';
import {
  getSnapshotsInRange,
  getAllTokenIndices,
  getAllWalletIndices,
  getSnapshotStats,
  downsample,
  type TokenIndexEntry,
  type WalletIndexEntry,
} from '../lib/snapshotStore';
import { decodeSnapshot, type SnapshotPayload } from '../lib/snapshotEncoder';

// ── Public types ──────────────────────────────────────────────────────────────

export type TimeRange = '1H' | '6H' | '24H' | '7D' | 'ALL';
export type ViewMode  = 'total_btc' | 'total_usd' | 'per_token' | 'per_wallet';

export interface ChartPoint {
  time:  number;  // unix seconds
  value: number;
}

export interface ChartSeries {
  id:    string;  // contract address or wallet address
  label: string;  // token symbol or wallet label
  color: string;
  data:  ChartPoint[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const RANGE_SECONDS: Record<TimeRange, number> = {
  '1H':  3_600,
  '6H':  21_600,
  '24H': 86_400,
  '7D':  604_800,
  'ALL': 0,  // 0 = no lower bound
};

const TOKEN_COLOR_MAP: Record<string, string> = {
  BTC:  '#fb923c',  // orange-400
  MOTO: '#e0e0e0',  // soft white (pure white too harsh on dark bg)
  PILL: '#e64900',
  SAT:  '#facc15',  // yellow-400
  SWAP: '#60a5fa',  // blue-400
  BLUE: '#0577c0',
  PEPE: '#4c9641',
  UNGA: '#b85c1b',
  MCHAD: '#75bbdf',
};

const FALLBACK_COLORS = [
  '#a78bfa', '#f59e0b', '#ef4444', '#06b6d4', '#84cc16',
  '#ec4899', '#8b5cf6', '#14b8a6', '#f43f5e', '#22d3ee',
];

function getTokenColor(symbol: string, index: number): string {
  return TOKEN_COLOR_MAP[symbol.toUpperCase()] ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

const MAX_CHART_POINTS = 500;

// ── Series builder ────────────────────────────────────────────────────────────

function buildSeries(
  snapshots:      SnapshotPayload[],
  tokenIndex:     TokenIndexEntry[],
  walletIndex:    WalletIndexEntry[],
  viewMode:       ViewMode,
  isVisible:      (address: string) => boolean,
  showRawAmount:  boolean,
): ChartSeries[] {
  if (snapshots.length === 0) return [];

  const tokenByIdx  = new Map<number, TokenIndexEntry>(tokenIndex.map(t => [t.index, t]));
  const walletByIdx = new Map<number, WalletIndexEntry>(walletIndex.map(w => [w.index, w]));

  // Pre-compute visible token set from tokenIndex
  const visibleTokenIdx = new Set<number>(
    tokenIndex
      .filter(t => isVisible(t.address))
      .map(t => t.index),
  );

  // ── Total BTC ──
  if (viewMode === 'total_btc') {
    const data: ChartPoint[] = snapshots.map(snap => {
      const priceByIdx = new Map<number, number>(snap.prices.map(p => [p.tokenIdx, p.priceBtc]));
      let total = 0;
      for (const h of snap.holdings) {
        if (!visibleTokenIdx.has(h.tokenIdx)) continue;
        total += h.amount * (priceByIdx.get(h.tokenIdx) ?? 0);
      }
      return { time: snap.timestamp, value: total };
    });
    return [{ id: 'total_btc', label: 'Portfolio (BTC)', color: TOKEN_COLOR_MAP['BTC'] ?? '#f97316', data }];
  }

  // ── Total USD ──
  if (viewMode === 'total_usd') {
    const data: ChartPoint[] = snapshots.map(snap => {
      const priceByIdx = new Map<number, number>(snap.prices.map(p => [p.tokenIdx, p.priceBtc]));
      let totalBtc = 0;
      for (const h of snap.holdings) {
        if (!visibleTokenIdx.has(h.tokenIdx)) continue;
        totalBtc += h.amount * (priceByIdx.get(h.tokenIdx) ?? 0);
      }
      return { time: snap.timestamp, value: totalBtc * (snap.btcUsdCents / 100) };
    });
    return [{ id: 'total_usd', label: 'Portfolio (USD)', color: TOKEN_COLOR_MAP['BTC'] ?? '#f97316', data }];
  }

  // ── Per token ──
  if (viewMode === 'per_token') {
    // Only tokens that have a price AND are visible
    const tokenIdxSet = new Set<number>();
    for (const snap of snapshots) {
      for (const p of snap.prices) {
        if (visibleTokenIdx.has(p.tokenIdx)) tokenIdxSet.add(p.tokenIdx);
      }
    }

    const result: ChartSeries[] = [];
    let ci = 0;
    for (const tokenIdx of tokenIdxSet) {
      const entry = tokenByIdx.get(tokenIdx);
      if (!entry) continue;

      const data: ChartPoint[] = [];
      for (const snap of snapshots) {
        let tokenTotal = 0;
        for (const h of snap.holdings) {
          if (h.tokenIdx === tokenIdx) tokenTotal += h.amount;
        }
        if (showRawAmount) {
          // Raw token units — no BTC conversion
          if (tokenTotal > 0) data.push({ time: snap.timestamp, value: tokenTotal });
        } else {
          const priceEntry = snap.prices.find(p => p.tokenIdx === tokenIdx);
          if (!priceEntry) continue;
          const valueBtc = tokenTotal * priceEntry.priceBtc;
          if (valueBtc > 0) data.push({ time: snap.timestamp, value: valueBtc });
        }
      }

      if (data.length > 0) {
        result.push({
          id:    entry.address,
          label: entry.symbol,
          color: getTokenColor(entry.symbol, ci),
          data,
        });
        ci++;
      }
    }
    return result;
  }

  // ── Per wallet ──
  if (viewMode === 'per_wallet') {
    const walletIdxSet = new Set<number>();
    for (const snap of snapshots) {
      for (const h of snap.holdings) {
        if (visibleTokenIdx.has(h.tokenIdx)) walletIdxSet.add(h.walletIdx);
      }
    }

    const result: ChartSeries[] = [];
    let ci = 0;
    for (const walletIdx of walletIdxSet) {
      const entry = walletByIdx.get(walletIdx);

      const data: ChartPoint[] = [];
      for (const snap of snapshots) {
        const priceByIdx = new Map<number, number>(snap.prices.map(p => [p.tokenIdx, p.priceBtc]));
        let walletTotal = 0;
        for (const h of snap.holdings) {
          if (h.walletIdx === walletIdx && visibleTokenIdx.has(h.tokenIdx)) {
            walletTotal += h.amount * (priceByIdx.get(h.tokenIdx) ?? 0);
          }
        }
        if (walletTotal > 0) data.push({ time: snap.timestamp, value: walletTotal });
      }

      if (data.length > 0) {
        result.push({
          id:    entry?.address ?? String(walletIdx),
          label: entry?.label  ?? `Wallet ${walletIdx}`,
          color: FALLBACK_COLORS[ci % FALLBACK_COLORS.length],
          data,
        });
        ci++;
      }
    }
    return result;
  }

  return [];
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function usePortfolioHistory(
  timeRange:     TimeRange,
  viewMode:      ViewMode,
  isVisible:     (address: string) => boolean,
  showRawAmount: boolean,
) {
  const positions            = useAppStore(s => s.allPositions);
  const addresses            = useAppStore(s => s.addresses);
  const btcPrice             = useAppStore(s => s.btcPrice);
  const latestBlock          = useAppStore(s => s.latestBlock);
  const positionsLastFetched = useAppStore(s => s.positionsLastFetched);

  const lastSavedHeightRef = useRef<number | null>(null);

  const [isSaving,    setIsSaving]    = useState(false);
  const [lastSavedTs, setLastSavedTs] = useState<number | null>(null);
  const [series,      setSeries]      = useState<ChartSeries[]>([]);
  const [stats,       setStats]       = useState<{ count: number; estimatedBytes: number } | null>(null);
  const [error,       setError]       = useState<string | null>(null);
  // Expose raw token index so the UI can build the filter panel
  const [tokenIndex,  setTokenIndex]  = useState<Array<{ address: string; symbol: string }>>([]);

  // Load chart data from IndexedDB
  const loadChartData = useCallback(async () => {
    try {
      const nowSec   = Math.floor(Date.now() / 1000);
      const rangeSec = RANGE_SECONDS[timeRange];
      const fromTs   = rangeSec === 0 ? 0 : nowSec - rangeSec;

      const [records, tkIndex, walletIndex, snapshotStats] = await Promise.all([
        getSnapshotsInRange(fromTs, nowSec + 86_400),
        getAllTokenIndices(),
        getAllWalletIndices(),
        getSnapshotStats(),
      ]);

      setTokenIndex(tkIndex);

      const decoded = records.map(r => decodeSnapshot(r.d));
      const sampled = downsample(decoded, MAX_CHART_POINTS);
      const built   = buildSeries(sampled, tkIndex, walletIndex, viewMode, isVisible, showRawAmount);

      setSeries(built);
      setStats(snapshotStats);
      setError(null);
    } catch (err) {
      setError(String(err));
    }
  }, [timeRange, viewMode, isVisible, showRawAmount]);

  // Save snapshot when positions are freshly fetched (new block data)
  // Save snapshot ONLY after positions are freshly fetched for the new block.
  // Guard by positionsLastFetched (not block height) to avoid saving stale data:
  // - latestBlock.height fires BEFORE positions are re-fetched → would save previous block data
  // - positionsLastFetched fires AFTER usePositions completes → positions are current
  const lastSavedFetchedRef = useRef<number>(0);

  useEffect(() => {
    if (positionsLastFetched === 0) return;
    if (!latestBlock) return;
    if (positions.length === 0 || addresses.length === 0) return;
    if (!btcPrice) return;
    // Guard: only save once per positions fetch cycle
    if (lastSavedFetchedRef.current === positionsLastFetched) return;

    lastSavedFetchedRef.current = positionsLastFetched;
    setIsSaving(true);
    setError(null);

    buildAndSaveSnapshot(
      positions,
      addresses,
      btcPrice,
      latestBlock.timestamp,
    )
      .then(result => { if (result) setLastSavedTs(result.ts); })
      .catch(err => setError(String(err)))
      .finally(() => {
        setIsSaving(false);
        loadChartData();
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positionsLastFetched]);

  // Reload chart when range, view, or visibility changes
  useEffect(() => {
    loadChartData();
  }, [loadChartData]);

  return { series, isSaving, lastSavedTs, stats, error, tokenIndex, reload: loadChartData };
}
