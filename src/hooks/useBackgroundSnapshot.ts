/**
 * useBackgroundSnapshot — global background task that saves a portfolio
 * snapshot on every new positions fetch, regardless of the active route.
 *
 * Mount once in AppInner (App.tsx) so snapshots are never lost when the
 * user navigates away from /tracks.
 */

import { useEffect, useRef } from 'react';
import { useAppStore } from '../store';
import { buildAndSaveSnapshot } from '../lib/portfolioSnapshot';

export function useBackgroundSnapshot(): void {
  const positions            = useAppStore(s => s.allPositions);
  const addresses            = useAppStore(s => s.addresses);
  const btcPrice             = useAppStore(s => s.btcPrice);
  const latestBlock          = useAppStore(s => s.latestBlock);
  const positionsLastFetched = useAppStore(s => s.positionsLastFetched);

  const setSnapshotIsSaving    = useAppStore(s => s.setSnapshotIsSaving);
  const setSnapshotLastSavedTs = useAppStore(s => s.setSnapshotLastSavedTs);

  const lastSavedFetchedRef = useRef<number>(0);

  useEffect(() => {
    if (positionsLastFetched === 0) return;
    if (!latestBlock) return;
    if (positions.length === 0 || addresses.length === 0) return;
    if (!btcPrice) return;
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
  }, [positionsLastFetched]);
}
