/**
 * WebSocket v2 Token Channel Hook
 *
 * Subscribes to real-time updates for a specific token via WebSocket.
 * Falls back to REST polling if WebSocket is unavailable.
 */
import { useEffect, useRef, useState, useCallback } from 'react';

const WS_URL = import.meta.env.VITE_SLOWPHIE_WS_URL ?? 'wss://api.slowphie.com/ws';

export interface TokenRouteData {
  bestPriceBtc: string;
  bestPriceUsd?: string;
  routeCount: number;
  bestRoute: {
    path: string[];
    feeAdjustedPrice: string;
    estimatedSlippagePct?: number;
    liquidityScore?: number;
  };
  allRoutes?: Array<{ path: string[]; feeAdjustedPrice: string; dex: string }>;
  arbitrage?: {
    exists: boolean;
    spreadPct: number;
    feasibility?: string;
    optimalSizeBtc?: string;
  };
}

export function useTokenChannel(tokenAddress: string | null) {
  const [connected, setConnected] = useState(false);
  const [routeData, setRouteData] = useState<TokenRouteData | null>(null);
  const [lastBlock, setLastBlock] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const delayRef = useRef(1000);
  const tokenRef = useRef(tokenAddress);

  tokenRef.current = tokenAddress;

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      delayRef.current = 1000;
      // Subscribe to global + token channel
      if (tokenRef.current) {
        ws.send(JSON.stringify({
          type: 'subscribe',
          channels: ['global', `token:${tokenRef.current}`],
        }));
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
          case 'token_route_update':
            if (msg.tokenAddress?.toLowerCase() === tokenRef.current?.toLowerCase()) {
              setRouteData(msg.data);
            }
            break;
          case 'block_update':
            setLastBlock(msg.blockHeight ?? null);
            break;
          case 'connection_welcome':
            // Re-subscribe after reconnect
            if (tokenRef.current) {
              ws.send(JSON.stringify({
                type: 'subscribe',
                channels: ['global', `token:${tokenRef.current}`],
              }));
            }
            break;
        }
      } catch {
        // ignore invalid JSON
      }
    };

    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;
      delayRef.current = Math.min(delayRef.current * 2, 30000);
      reconnectRef.current = setTimeout(connect, delayRef.current);
    };

    ws.onerror = () => ws.close();
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectRef.current) {
      clearTimeout(reconnectRef.current);
      reconnectRef.current = null;
    }
    // Unsubscribe before closing
    if (wsRef.current?.readyState === WebSocket.OPEN && tokenRef.current) {
      wsRef.current.send(JSON.stringify({
        type: 'unsubscribe',
        channels: [`token:${tokenRef.current}`],
      }));
    }
    wsRef.current?.close();
    wsRef.current = null;
    setConnected(false);
  }, []);

  useEffect(() => {
    if (!tokenAddress) {
      disconnect();
      return;
    }
    connect();
    return disconnect;
  }, [tokenAddress, connect, disconnect]);

  return { connected, routeData, lastBlock };
}
