import { useEffect, useRef, useCallback, useState } from 'react';
import { useAppStore } from '../store';

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

const WS_URL = 'wss://api.blockfeed.online/v1/stream';

type Listener = (event: StreamEvent) => void;
type ConnectListener = (connected: boolean) => void;

// Singleton WebSocket manager
let activeSocket: WebSocket | null = null;
let listeners: Set<Listener> = new Set();
let connectListeners: Set<ConnectListener> = new Set();
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let isConnecting = false;
let isConnected = false;

function notifyConnected(connected: boolean) {
  isConnected = connected;
  connectListeners.forEach((fn) => fn(connected));
}

function connect() {
  if (activeSocket?.readyState === WebSocket.OPEN || isConnecting) return;
  if (activeSocket?.readyState === WebSocket.CONNECTING) return;
  isConnecting = true;

  try {
    const socket = new WebSocket(WS_URL);
    activeSocket = socket;

    socket.onopen = () => {
      isConnecting = false;
      console.log('[BlockFeed WS] Connected');
      notifyConnected(true);
      if (socket.readyState === WebSocket.OPEN) {
        try {
          socket.send(JSON.stringify({ action: 'subscribe', channels: ['blocks', 'prices'] }));
        } catch {
          // ignore send errors
        }
      }
    };

    socket.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data as string) as Record<string, unknown>;
        let event: StreamEvent | null = null;

        if (msg.type === 'block' || msg.event === 'block' || msg.height !== undefined) {
          const blockHeight = Number(msg.height ?? msg.blockNumber ?? 0);
          // Ignore invalid/zero height events
          if (blockHeight > 0) {
            event = {
              type: 'block',
              height: blockHeight,
              hash: String(msg.hash ?? ''),
              timestamp: Number(msg.timestamp ?? Date.now()),
              transactions: Number(msg.transactions ?? msg.txCount ?? 0),
            };
          }
        }

        if (msg.type === 'price' || msg.event === 'price' || msg.symbol !== undefined) {
          event = {
            type: 'price',
            symbol: String(msg.symbol ?? 'BTC'),
            price: Number(msg.price ?? 0),
            change24h: msg.change24h !== undefined ? Number(msg.change24h) : undefined,
          };
        }

        if (event) {
          listeners.forEach((fn) => fn(event!));
        }
      } catch {
        // ignore parse errors
      }
    };

    socket.onerror = () => {
      isConnecting = false;
    };

    socket.onclose = () => {
      isConnecting = false;
      if (activeSocket === socket) {
        activeSocket = null;
        notifyConnected(false);
      }
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(() => {
        if (listeners.size > 0 || connectListeners.size > 0) connect();
      }, 5000);
    };
  } catch {
    isConnecting = false;
  }
}

function disconnect() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = null;
  activeSocket?.close();
  activeSocket = null;
  isConnecting = false;
}

/** Subscribe to stream events */
export function useBlockFeedStream(onEvent?: (event: StreamEvent) => void) {
  const setBtcPrice = useAppStore((s) => s.setBtcPrice);

  const handler = useCallback((event: StreamEvent) => {
    if (event.type === 'price' && event.symbol.toUpperCase().includes('BTC')) {
      setBtcPrice(event.price);
    }
    onEvent?.(event);
  }, [onEvent, setBtcPrice]);

  useEffect(() => {
    listeners.add(handler);
    connect();
    return () => {
      listeners.delete(handler);
      if (listeners.size === 0 && connectListeners.size === 0) disconnect();
    };
  }, [handler]);
}

/** Returns true when the WebSocket is open */
export function useBlockFeedConnected(): boolean {
  // Initialise with current state so it's correct even if already connected
  const [connected, setConnected] = useState<boolean>(isConnected);

  useEffect(() => {
    // Sync immediately in case the socket opened between renders
    setConnected(isConnected);

    const handler: ConnectListener = (c) => setConnected(c);
    connectListeners.add(handler);
    // Trigger a connection attempt if not already connecting/connected
    connect();

    return () => {
      connectListeners.delete(handler);
      if (listeners.size === 0 && connectListeners.size === 0) disconnect();
    };
  }, []);

  return connected;
}

/** Simple hook that provides latest block info via ref */
export function useLatestBlock() {
  const blockRef = useRef<{ height: number; timestamp: number } | null>(null);

  useBlockFeedStream(useCallback((event: StreamEvent) => {
    if (event.type === 'block') {
      blockRef.current = { height: event.height, timestamp: event.timestamp };
    }
  }, []));

  return blockRef;
}
