/**
 * useBackgroundSnapshot — global background task that saves a portfolio
 * snapshot on every new positions fetch, regardless of the active route.
 *
 * Mount once in AppInner (App.tsx) so snapshots are never lost when the
 * user navigates away from /tracks.
 */

import { useEffect, useRef } from 'react';
import { useAppStore } from '../store';
import { buildAndSaveSnapshot, prefetchMarketPrices } from '../lib/portfolioSnapshot';

export function useBackgroundSnapshot(): void {
  const positions            = useAppStore(s => s.allPositions);
  const addresses            = useAppStore(s => s.addresses);
  const btcPrice             = useAppStore(s => s.btcPrice);
  const latestBlock          = useAppStore(s => s.latestBlock);
  const positionsLastFetched = useAppStore(s => s.positionsLastFetched);
  const fetchPhase           = useAppStore(s => s.fetchPhase);

  const setSnapshotIsSaving    = useAppStore(s => s.setSnapshotIsSaving);
  const setSnapshotLastSavedTs = useAppStore(s => s.setSnapshotLastSavedTs);

  const lastSavedFetchedRef = useRef<number>(0);
  const lastPricesFetchedRef = useRef<number>(0);

  // Always fetch market prices when positions update — independent of fetchPhase.
  // This prevents USD/BTC unit conversion in TokenTotalsCard from showing 0
  // while Phase-2 discovery is still in progress.
  useEffect(() => {
    if (positionsLastFetched === 0) return;
    if (lastPricesFetchedRef.current === positionsLastFetched) return;
    lastPricesFetchedRef.current = positionsLastFetched;
    prefetchMarketPrices().catch((err) => console.error('[market-prices]', err));
  }, [positionsLastFetched]);

  useEffect(() => {
    if (positionsLastFetched === 0) return;
    if (!latestBlock) return;
    if (positions.length === 0 || addresses.length === 0) return;
    if (!btcPrice) return;
    // Wait for the full fetch (Phase 1 + Phase 2 discovery) to complete so the
    // snapshot reflects the same totals the UI is showing — prevents the
    // mobile/desktop snapshot drift caused by saving a partial Phase-2 result.
    if (fetchPhase !== 'complete') return;
    // Guard: only save once per positions fetch cycle
    if (lastSavedFetchedRef.current === positionsLastFetched) return;

    lastSavedFetchedRef.current = positionsLastFetched;
    setSnapshotIsSaving(true);

    buildAndSaveSnapshot(
      positions,
      addresses,
      btcPrice,
      latestBlock.timestamp,
    )
      .then(result => { if (result) setSnapshotLastSavedTs(result.ts); })
      .catch(err => console.error('[background-snapshot]', err))
      .finally(() => setSnapshotIsSaving(false));

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positionsLastFetched, fetchPhase]);
}
