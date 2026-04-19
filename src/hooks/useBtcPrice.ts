import { useEffect } from 'react';
import { useAppStore } from '../store';
import { fetchOraclePrices, fetchLatestBlock } from '../api/slowphie';

/** Fetch BTC price + latest block from Slowphie Server REST and seed store */
export function useBtcPrice() {
  const setBtcPrice     = useAppStore((s) => s.setBtcPrice);
  const addPricePoint   = useAppStore((s) => s.addPricePoint);
  const setLatestBlock  = useAppStore((s) => s.setLatestBlock);
  const addBlockPoint   = useAppStore((s) => s.addBlockPoint);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      // ── BTC Price ──────────────────────────────────────────────────
      try {
        const resp = await fetchOraclePrices();
        if (!cancelled && resp.ok && Array.isArray(resp.data)) {
          const btc = resp.data.find(
            (p) => p.symbol.toUpperCase() === 'BTC'
          );
          if (btc) {
            const price = Number(btc.price);
            if (price > 0) {
              setBtcPrice(price);
              addPricePoint({ time: Math.floor(Date.now() / 1000), value: price });
            }
          }
        }
      } catch {
        // silently fail
      }

      // ── Latest Block ───────────────────────────────────────────────
      try {
        const resp = await fetchLatestBlock();
        if (!cancelled && resp.ok && resp.data) {
          const height = Number(resp.data.block_height ?? 0);
          if (height > 0) {
            const ts = resp.data.indexed_at
              ? Math.floor(new Date(resp.data.indexed_at).getTime() / 1000)
              : Math.floor(Date.now() / 1000);
            setLatestBlock({ height, timestamp: ts });
            addBlockPoint({ time: ts, height, txCount: resp.data.btc_tx_count ?? 0 });
          }
        }
      } catch {
        // silently fail
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [setBtcPrice, addPricePoint, setLatestBlock, addBlockPoint]);
}
