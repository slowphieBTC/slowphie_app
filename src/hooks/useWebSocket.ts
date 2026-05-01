import { useEffect, useState } from 'react';
import { fetchOraclePrices, fetchLatestBlock } from '../api/slowphie';

/**
 * Feed connection status — reflects whether the Slowphie Server
 * REST endpoints are reachable and returning valid data.
 *
 * Replaces the old BlockFeed WebSocket connection with simple
 * health-check polling.
 */

// Shared state — survives re-renders and remounts
let _lastOk = false;
let _listeners = new Set<(connected: boolean) => void>();
let _pollTimer: ReturnType<typeof setInterval> | null = null;
let _refCount = 0;

function notifyAll(connected: boolean) {
  if (_lastOk === connected) return;
  _lastOk = connected;
  _listeners.forEach((fn) => fn(connected));
}

async function healthCheck() {
  try {
    const [block, oracle] = await Promise.all([
      fetchLatestBlock(),
      fetchOraclePrices(),
    ]);
    notifyAll(block.ok && Array.isArray(oracle.data));
  } catch {
    notifyAll(false);
  }
}

function startPolling() {
  if (_pollTimer) return;
  healthCheck(); // immediate first check
  _pollTimer = setInterval(healthCheck, 15_000);
}

function stopPolling() {
  if (_pollTimer) {
    clearInterval(_pollTimer);
    _pollTimer = null;
  }
}

/** Returns true when the Slowphie feed is reachable */
export function useFeedConnected(): boolean {
  const [connected, setConnected] = useState<boolean>(_lastOk);

  useEffect(() => {
    _listeners.add(setConnected);
    _refCount++;
    startPolling();

    return () => {
      _listeners.delete(setConnected);
      _refCount--;
      if (_refCount <= 0) {
        _refCount = 0;
        stopPolling();
        _lastOk = false;
      }
    };
  }, []);

  return connected;
}

// ── Backwards-compatible aliases ──────────────────────────────────────
// StatsBar and App still import these names; keep them working
export const useBlockFeedConnected = useFeedConnected;
export const useBlockFeedStream = (_onEvent?: unknown) => {
  // No-op: data now comes from useBtcPrice polling
};

export interface BlockEvent {
  type: 'block';
  height: number;
  hash: string;
  timestamp: number;
  transactions: number;
}

export interface PriceEvent {
  type: 'price';
  symbol: string;
  price: number;
  change24h?: number;
}

export type StreamEvent = BlockEvent | PriceEvent;

export function useLatestBlock() {
  // Delegated to useBtcPrice → store.latestBlock
  return { current: null };
}
