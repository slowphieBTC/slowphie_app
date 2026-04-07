import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Address, AddressPositions, Position } from '../types';

/** UUID v4 using getRandomValues — works on HTTP and HTTPS */
function uuid(): string {
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  buf[6] = (buf[6] & 0x0f) | 0x40;
  buf[8] = (buf[8] & 0x3f) | 0x80;
  const hex = Array.from(buf).map((b) => b.toString(16).padStart(2, '0')).join('');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-');
}

export interface PricePoint {
  time: number;  // unix seconds
  value: number; // USD price
}

export interface BlockPoint {
  time: number;
  height: number;
  txCount: number;
}

interface AppState {
  // Saved addresses
  addresses: Address[];
  addAddress: (label: string, address: string) => void;
  removeAddress: (id: string) => void;
  updateAddress: (id: string, label: string) => void;

  // Positions per address (legacy per-address map)
  positions: Record<string, AddressPositions>;
  setPositions: (address: string, data: Partial<AddressPositions>) => void;

  // Cached aggregated positions (navigation-stable)
  allPositions: Position[];
  positionsLastFetched: number;  // unix ms timestamp, 0 = never
  setAllPositions: (positions: Position[]) => void;

  // UI state
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;

  // BTC price
  btcPrice: number | null;
  setBtcPrice: (price: number) => void;

  // Price history for charts (last 200 points)
  priceHistory: PricePoint[];
  addPricePoint: (point: PricePoint) => void;

  // Block history
  blockHistory: BlockPoint[];
  addBlockPoint: (point: BlockPoint) => void;

  // Latest block
  latestBlock: { height: number; timestamp: number } | null;
  setLatestBlock: (b: { height: number; timestamp: number }) => void;

  // Dynamic token icon map: symbol (uppercase) -> image url
  tokenIcons: Record<string, string>;
  mergeTokenIcons: (icons: Record<string, string>) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      addresses: [],
      addAddress: (label, address) =>
        set((s) => ({
          addresses: [
            ...s.addresses,
            { id: uuid(), label, address, addedAt: Date.now() },
          ],
          positionsLastFetched: 0,
        })),
      removeAddress: (id) =>
        set((s) => ({ addresses: s.addresses.filter((a) => a.id !== id), positionsLastFetched: 0 })),
      updateAddress: (id, label) =>
        set((s) => ({
          addresses: s.addresses.map((a) => (a.id === id ? { ...a, label } : a)),
        })),

      positions: {},
      setPositions: (address, data) =>
        set((s) => ({
          positions: {
            ...s.positions,
            [address]: { ...s.positions[address], ...data } as AddressPositions,
          },
        })),

      allPositions: [],
      positionsLastFetched: 0,
      setAllPositions: (positions) =>
        set({ allPositions: positions, positionsLastFetched: Date.now() }),

      settingsOpen: false,
      setSettingsOpen: (open) => set({ settingsOpen: open }),

      btcPrice: null,
      setBtcPrice: (price) => set({ btcPrice: price }),

      priceHistory: [],
      addPricePoint: (point) =>
        set((s) => ({
          priceHistory: [...s.priceHistory.slice(-199), point],
        })),

      blockHistory: [],
      addBlockPoint: (point) =>
        set((s) => ({
          blockHistory: [...s.blockHistory.slice(-99), point],
        })),

      latestBlock: null,
      setLatestBlock: (b) => set({ latestBlock: b }),

      tokenIcons: {
        // Static seeds — always available regardless of server
        BTC:  'https://raw.githubusercontent.com/btc-vision/contract-logo/main/contracts/bitcoin.png',
        MOTO: 'https://raw.githubusercontent.com/btc-vision/contract-logo/main/contracts/op1sqrxd0p3kd234wc5n2z7pl4hs82y8kpk4fqj9h78a.png',
        PILL: 'https://raw.githubusercontent.com/btc-vision/contract-logo/main/contracts/op1sqz0f729q22dv6trrvhn9msl9enqqaazy5cjy4ej6.png',
      },
      mergeTokenIcons: (icons) =>
        set((s) => ({ tokenIcons: { ...s.tokenIcons, ...icons } })),
    }),
    {
      name: 'motostrategy-storage',
      partialize: (s) => ({ addresses: s.addresses }),
    }
  )
);
