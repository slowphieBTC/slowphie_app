import { useEffect } from 'react';
import { useAppStore } from '../store';
import { blockfeed } from '../api/blockfeed';

/** Fetch BTC price + latest block from BlockFeed REST and seed store */
export function useBtcPrice() {
  const setBtcPrice    = useAppStore((s) => s.setBtcPrice);
  const addPricePoint  = useAppStore((s) => s.addPricePoint);
  const setLatestBlock = useAppStore((s) => s.setLatestBlock);

  useEffect(() => {
    const fetchData = async () => {
      // ── BTC Price ──────────────────────────────────────────────────
      try {
        const data = await blockfeed.getOraclePrices() as Record<string, unknown>;
        const prices = (data?.prices ?? data?.data ?? data) as unknown;
        let price: number | null = null;
        if (Array.isArray(prices)) {
          const btc = prices.find((p: Record<string, unknown>) =>
            String(p.symbol ?? '').toUpperCase().includes('BTC')
          ) as Record<string, unknown> | undefined;
          if (btc?.price) price = Number(btc.price);
        } else if (prices && typeof prices === 'object') {
          const p = prices as Record<string, unknown>;
          if (p.BTC)        price = Number(p.BTC);
          else if (p.price) price = Number(p.price);
        }
        if (price && price > 0) {
          setBtcPrice(price);
          addPricePoint({ time: Math.floor(Date.now() / 1000), value: price });
        }
      } catch {
        // silently fail
      }

      // ── Latest Block ───────────────────────────────────────────────
      // Blockfeed response: { ok: true, data: { block_height: '12983', ... } }
      try {
        const resp = await blockfeed.getLatestBlock() as Record<string, unknown>;
        const d = (resp?.data ?? resp) as Record<string, unknown>;
        const height = Number(d?.block_height ?? d?.height ?? d?.blockNumber ?? 0);
        if (height > 0) {
          const ts = Number(d?.indexed_at ? new Date(d.indexed_at as string).getTime() / 1000 : Date.now() / 1000);
          setLatestBlock({ height, timestamp: ts });
        }
      } catch {
        // silently fail
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30_000);
    return () => clearInterval(interval);
  }, [setBtcPrice, addPricePoint, setLatestBlock]);
}
