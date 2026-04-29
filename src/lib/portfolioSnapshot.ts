/**
 * Portfolio snapshot orchestrator.
 *
 * Fetches /markets prices, reads current positions from Zustand,
 * aggregates per-wallet / per-token amounts, encodes binary,
 * and saves to IndexedDB.
 */

import { fetchMarkets } from '../api/slowphie';
import { encodeSnapshot, type SnapshotPayload, type PriceEntry, type WalletEntry, type HoldingEntry } from './snapshotEncoder';
import { saveSnapshot, resolveWalletIndex, resolveTokenIndex } from './snapshotStore';
import { BTC_NATIVE } from './coreTokens';
import type { Position, Address } from '../types';
import { useAppStore } from '../store';

// ── Token aggregation (mirrors aggregateTokens in TokenTotalsCard) ─────────────
// We keep this local and minimal — only what we need for snapshot building.

interface TokenHolding {
  walletAddress:   string;
  tokenContract:   string;  // 0x... or BTC_NATIVE for native BTC
  symbol:          string;
  amount:          number;  // formatted token units
}

function extractHoldings(
  positions:         Position[],
  symbolToContract:  Map<string, string>,  // symbol.toUpperCase() → contractAddress
): TokenHolding[] {
  const holdings: TokenHolding[] = [];

  const add = (
    walletAddress: string,
    tokenContract: string,
    symbol: string,
    amount: number,
  ) => {
    if (!symbol || amount <= 0) return;
    const sym = symbol.toUpperCase();
    if (sym === 'BTC') {
      holdings.push({ walletAddress, tokenContract: BTC_NATIVE, symbol: sym, amount });
      return;
    }
    // Use provided contract, or fall back to symbol→contract map from /markets
    const contract = tokenContract || symbolToContract.get(sym) || '';
    if (!contract) return; // truly unresolvable — skip
    holdings.push({ walletAddress, tokenContract: contract, symbol: sym, amount });
  };

  for (const pos of positions) {
    const addr  = pos.address;
    const cAddr = pos.contractAddress ?? '';

    if (pos.type === 'stake') {
      if (pos.mchadStaking) {
        const p = pos.mchadStaking.positions[0];
        if (p) {
          const staked = parseFloat(p.stakedFormatted);
          if (staked > 0) add(addr, cAddr, 'MCHAD', staked);
          const pending = parseFloat(p.unclaimedRewardsFormatted);
          if (pending > 0) add(addr, '', p.rewardSymbol.toUpperCase(), pending);
        }
      } else {
        if (pos.amount > 0) add(addr, cAddr, pos.token, pos.amount);
        pos.stakingRewards?.forEach(r => {
          if (r.pending > 0) add(addr, r.tokenAddress ?? '', r.symbol, r.pending);
        });
      }
    } else if (pos.type === 'farm') {
      if (pos.hasFarmView) {
        if ((pos.walletBalance ?? 0) > 0) add(addr, cAddr, pos.token, pos.walletBalance!);
        pos.farms?.forEach(f => {
          if (f.staked  > 0) add(addr, cAddr, pos.token, f.staked);
          if (f.pending > 0) add(addr, '',    f.rewardToken, f.pending);
        });
      } else {
        if (pos.amount > 0) add(addr, cAddr, pos.token, pos.amount);
        if (pos.rewards > 0 && pos.rewardToken) add(addr, '', pos.rewardToken, pos.rewards);
      }
    } else if (pos.type === 'lp') {
      if (pos.lpUnderlying) {
        const u = pos.lpUnderlying;
        if (u.token0Amount > 0) add(addr, u.token0Address ?? '', u.token0Symbol, u.token0Amount);
        if (u.token1Amount > 0) add(addr, u.token1Address ?? '', u.token1Symbol, u.token1Amount);
      }
      if (pos.lpUnderlyingStaked) {
        const u = pos.lpUnderlyingStaked;
        if (u.token0Amount > 0) add(addr, u.token0Address ?? '', u.token0Symbol, u.token0Amount);
        if (u.token1Amount > 0) add(addr, u.token1Address ?? '', u.token1Symbol, u.token1Amount);
      }
      pos.farms?.forEach(f => {
        if (f.pending > 0) add(addr, '', f.rewardToken, f.pending);
      });
      if (!pos.hasFarmView && pos.rewards > 0 && pos.rewardToken) {
        add(addr, '', pos.rewardToken, pos.rewards);
      }
      if (pos.mchadLpStaking) {
        const lp = pos.mchadLpStaking;
        const pending = parseFloat(lp.unclaimedRewardsFormatted);
        if (pending > 0) add(addr, '', lp.rewardSymbol.toUpperCase(), pending);
      }
    }
  }

  return holdings;
}

// ── Main orchestrator ─────────────────────────────────────────────────────────

export interface SnapshotResult {
  ts:            number;   // unix seconds saved
  totalValueBtc: number;   // total portfolio value in BTC at snapshot time
  pricedTokens:  number;   // number of tokens with active market price
}

export async function buildAndSaveSnapshot(
  positions:  Position[],
  addresses:  Address[],
  btcUsdPrice: number,     // USD price of BTC (from Zustand btcPrice)
  blockTs:    number,      // unix seconds (from latestBlock.timestamp)
): Promise<SnapshotResult | null> {
  if (positions.length === 0 || addresses.length === 0) return null;

  // 1. Fetch /markets — best-route price in BTC per token
  let marketsData: Awaited<ReturnType<typeof fetchMarkets>>;
  try {
    marketsData = await fetchMarkets();
  } catch {
    marketsData = { markets: [], total: 0, fetchedAt: Date.now(), nextRefreshAt: Date.now() };
  }

  // Build contractAddress → { priceBtc, confidence } map
  const marketPriceMap = new Map<string, { priceBtc: number; confidence: number }>();
  // BTC native: price = 1 BTC, confidence = 1 (direct, no route needed)
  marketPriceMap.set(BTC_NATIVE, { priceBtc: 1.0, confidence: 1 });
  for (const m of marketsData.markets) {
    const p = parseFloat(m.rawPriceBtc || m.price);
    if (p > 0 && m.routes.length > 0) {
      marketPriceMap.set(m.id.toLowerCase(), {
        priceBtc:   p,
        confidence: m.routes[0].confidence,
      });
    }
  }

  // Push market prices to Zustand store so TokenTotalsCard can use them without re-fetching
  const storePrices: Record<string, number> = {};
  for (const [addr, m] of marketPriceMap.entries()) {
    storePrices[addr] = m.priceBtc;
  }
  useAppStore.getState().setMarketPrices(storePrices);


  // 2. Build symbol → contractAddress map from /markets for reward token resolution
  const symbolToContract = new Map<string, string>();
  for (const m of marketsData.markets) {
    if (m.symbol && m.id) symbolToContract.set(m.symbol.toUpperCase(), m.id.toLowerCase());
  }
  // Add BTC_NATIVE sentinel for BTC symbol
  symbolToContract.set('BTC', BTC_NATIVE);

  // 3. Extract holdings from positions
  const rawHoldings = extractHoldings(positions, symbolToContract);

  // 3. Resolve wallet indices
  const walletIndexMap = new Map<string, number>();
  for (const addr of addresses) {
    const idx = await resolveWalletIndex(addr.address, addr.label || addr.address.slice(0, 8));
    walletIndexMap.set(addr.address, idx);
  }

  // 4. Resolve token indices — BTC_NATIVE always, plus all tokens appearing in holdings
  const tokenKeySet = new Set<string>();
  tokenKeySet.add(BTC_NATIVE); // Always register BTC as a token
  for (const h of rawHoldings) {
    if (h.tokenContract) tokenKeySet.add(h.tokenContract.toLowerCase());
  }
  const tokenIndexMap = new Map<string, number>();
  // Register BTC_NATIVE first (always idx 0 after DB init)
  const btcIdx = await resolveTokenIndex(BTC_NATIVE, 'BTC');
  tokenIndexMap.set(BTC_NATIVE, btcIdx);
  for (const contractAddr of tokenKeySet) {
    if (contractAddr === BTC_NATIVE) continue; // already registered
    const sym = rawHoldings.find(h => h.tokenContract.toLowerCase() === contractAddr)?.symbol ?? '?';
    const idx = await resolveTokenIndex(contractAddr, sym);
    tokenIndexMap.set(contractAddr, idx);
  }

  // 5. Build price entries (BTC + all tokens we hold AND have a market price)
  const priceEntries: PriceEntry[] = [];
  for (const [contractAddr, market] of marketPriceMap.entries()) {
    const tokenIdx = tokenIndexMap.get(contractAddr);
    if (tokenIdx === undefined) continue; // token not in our holdings, skip
    priceEntries.push({
      tokenIdx,
      priceBtc:   market.priceBtc,
      confidence: market.confidence,
    });
  }

  // 6. Build wallet BTC entries
  const walletEntries: WalletEntry[] = addresses.map(addr => ({
    walletIdx: walletIndexMap.get(addr.address) ?? 0,
    sats: 0,  // reserved — native BTC balance populated from wallet positions
  }));

  // 7. Build holding entries — ALL tokens including BTC
  const holdingEntries: HoldingEntry[] = [];
  let totalValueBtc = 0;

  for (const h of rawHoldings) {
    const contractAddr = h.tokenContract.toLowerCase();
    const walletIdx = walletIndexMap.get(h.walletAddress);
    const tokenIdx  = tokenIndexMap.get(contractAddr);
    if (walletIdx === undefined || tokenIdx === undefined) continue;

    holdingEntries.push({ walletIdx, tokenIdx, amount: h.amount });

    // Accumulate total portfolio value
    const market = marketPriceMap.get(contractAddr);
    if (market) totalValueBtc += h.amount * market.priceBtc;
  }

  // 8. Encode + save
  const ts = Math.floor(blockTs);
  const payload: SnapshotPayload = {
    timestamp:   ts,
    btcUsdCents: Math.round(btcUsdPrice * 100),
    prices:      priceEntries,
    wallets:     walletEntries,
    holdings:    holdingEntries,
  };

  const binary = encodeSnapshot(payload);
  await saveSnapshot(ts, binary);

  return {
    ts,
    totalValueBtc,
    pricedTokens: priceEntries.length,
  };
}
