/**
 * Shared token holdings aggregation.
 *
 * Single source of truth for both:
 *  - TokenTotalsCard (UI Token Holdings card on /tracks)
 *  - portfolioSnapshot.extractHoldings (background IDB snapshot)
 *
 * Two stages:
 *   1. walkPositionHoldings(positions) → flat RawHolding[]   (raw, no aggregation)
 *   2. aggregateHoldings(holdings, opts) → TokenTotal[]      (UI grouping + ordering)
 *
 * Determinism guarantees:
 *   • Internal totals are accumulated as `bigint` (sats-scale, 1e8) so the same
 *     set of holdings always produces the EXACT same `total`, regardless of the
 *     order in which holdings arrive.
 *   • Final ordering is fully driven by `addressOrder` + `discoveredSymbolOrder`,
 *     not by Map iteration insertion order.
 *
 * Reward tokens that arrive without a contract address are resolved via the
 * optional `symbolToContract` map; if still unresolved they keep a symbol-only
 * map key (UI keeps showing them, snapshot can filter them out).
 */

import type { Position } from '../types';
import { BTC_NATIVE } from './coreTokens';

export type HoldingType = 'wallet' | 'staked' | 'pending' | 'lp';

/** Flat per-source holding row produced by walkPositionHoldings. */
export interface RawHolding {
  walletAddress: string;
  symbol:        string;             // uppercase
  tokenContract: string | undefined; // normalized lowercase, or undefined for unresolved reward tokens
  amount:        number;             // formatted units
  type:          HoldingType;
  label:         string;
}

export interface TokenBreakdown {
  address:       string;
  label:         string;
  amount:        number;
  type:          HoldingType;
  tokenContract?: string;
}

export interface TokenTotal {
  symbol:        string;
  tokenContract?: string;
  total:         number;
  breakdown:     TokenBreakdown[];
}

// ── Sats-scale helpers (1e8) ────────────────────────────────────────────────
const SCALE = 100_000_000;            // 1e8
const SCALE_BI = BigInt(SCALE);
const toScaled = (n: number): bigint => BigInt(Math.round(n * SCALE));
const fromScaled = (b: bigint): number => Number(b) / SCALE;

const norm = (a: string | undefined): string | undefined =>
  a ? a.toLowerCase() : undefined;

/**
 * Compute the canonical map key for a holding.
 *  - BTC native           → BTC_NATIVE
 *  - any token w/ contract → contract.toLowerCase()
 *  - reward without contract → symbol.toUpperCase() (resolved later if possible)
 */
function mapKeyFor(symbol: string, contract: string | undefined): string {
  const sym = symbol.toUpperCase();
  if (sym === 'BTC') return BTC_NATIVE;
  if (contract) return contract.toLowerCase();
  return sym; // symbol-only fallback
}

// ─── Stage 1 — walk positions into flat raw holdings ────────────────────────

/**
 * Convert a Position[] into a flat list of RawHolding rows.
 *
 * No grouping, no totals — pure deterministic walk. Both UI and snapshot reuse
 * this so they will never disagree on what counts as a holding.
 */
export function walkPositionHoldings(positions: Position[]): RawHolding[] {
  const out: RawHolding[] = [];
  const push = (
    walletAddress: string,
    symbol:        string,
    amount:        number,
    label:         string,
    type:          HoldingType,
    tokenContract: string | undefined,
  ): void => {
    if (!symbol || !(amount > 0)) return; // skip 0, NaN, negatives
    const sym = symbol.toUpperCase();
    out.push({
      walletAddress,
      symbol:        sym,
      tokenContract: sym === 'BTC' ? undefined : norm(tokenContract),
      amount,
      type,
      label,
    });
  };

  for (const pos of positions) {
    const addr      = pos.address;
    const addrShort = `${addr.slice(0, 8)}\u2026`;
    const cAddr     = pos.contractAddress;

    if (pos.type === 'stake') {
      if (pos.mchadStaking) {
        const p = pos.mchadStaking.positions[0];
        if (p) {
          const staked = parseFloat(p.stakedFormatted);
          if (staked > 0) push(addr, 'MCHAD', staked, `MCHAD Staked (${addrShort})`, 'staked', cAddr);
          const pending = parseFloat(p.unclaimedRewardsFormatted);
          if (pending > 0) push(addr, p.rewardSymbol, pending, `MCHAD Pending Harvest (${addrShort})`, 'pending', undefined);
        }
      } else {
        if (pos.amount > 0) push(addr, pos.token, pos.amount, `Staked (${addrShort})`, 'staked', cAddr);
        pos.stakingRewards?.forEach((r) => {
          if (r.pending > 0) push(addr, r.symbol, r.pending, `Stake Reward (${addrShort})`, 'pending', r.tokenAddress);
        });
      }
    } else if (pos.type === 'farm') {
      if (pos.hasFarmView) {
        if ((pos.walletBalance ?? 0) > 0) {
          push(addr, pos.token, pos.walletBalance!, `Wallet (${addrShort})`, 'wallet', cAddr);
        }
        pos.farms?.forEach((f) => {
          if (f.staked  > 0) push(addr, pos.token,    f.staked,  `${f.farmName} Staked`,  'staked',  cAddr);
          if (f.pending > 0) push(addr, f.rewardToken, f.pending, `${f.farmName} Harvest`, 'pending', undefined);
        });
      } else {
        const hasActiveFarm = pos.farms?.some((f) => f.staked > 0 || f.pending > 0) ?? false;
        const entryType: HoldingType = hasActiveFarm ? 'staked' : 'wallet';
        if (pos.amount > 0) push(addr, pos.token, pos.amount, pos.label, entryType, cAddr);
        if (pos.rewards > 0 && pos.rewardToken) {
          push(addr, pos.rewardToken, pos.rewards, `${pos.label} Harvest`, 'pending', undefined);
        }
      }
    } else if (pos.type === 'lp') {
      if (pos.lpUnderlying) {
        const u = pos.lpUnderlying;
        if (u.token0Amount > 0) push(addr, u.token0Symbol, u.token0Amount, `${pos.label} Wallet LP`, 'lp', u.token0Address);
        if (u.token1Amount > 0) push(addr, u.token1Symbol, u.token1Amount, `${pos.label} Wallet LP`, 'lp', u.token1Address);
      }
      if (pos.lpUnderlyingStaked) {
        const u = pos.lpUnderlyingStaked;
        if (u.token0Amount > 0) push(addr, u.token0Symbol, u.token0Amount, `${pos.label} Staked LP`, 'lp', u.token0Address);
        if (u.token1Amount > 0) push(addr, u.token1Symbol, u.token1Amount, `${pos.label} Staked LP`, 'lp', u.token1Address);
      }
      pos.farms?.forEach((f) => {
        if (f.pending > 0) push(addr, f.rewardToken, f.pending, `${f.farmName} Harvest`, 'pending', undefined);
      });
      if (!pos.hasFarmView && pos.rewards > 0 && pos.rewardToken) {
        push(addr, pos.rewardToken, pos.rewards, `${pos.label} Harvest`, 'pending', undefined);
      }
      if (pos.mchadLpStaking) {
        const lp = pos.mchadLpStaking;
        const pending = parseFloat(lp.unclaimedRewardsFormatted);
        if (pending > 0) push(addr, lp.rewardSymbol, pending, `MCHAD LP Pending Harvest (${addrShort})`, 'pending', undefined);
      }
    }
  }
  return out;
}

// ─── Resolution helper — best-effort symbol→contract for reward tokens ─────

/**
 * Resolve missing contract addresses on holdings using a symbol→contract map.
 * Holdings that already have a contract are left untouched. Returns a NEW array
 * (no mutation) so callers can choose whether to use this resolver.
 */
export function resolveHoldingContracts(
  holdings:         RawHolding[],
  symbolToContract: Map<string, string>,
): RawHolding[] {
  if (symbolToContract.size === 0) return holdings;
  return holdings.map((h) => {
    if (h.tokenContract || h.symbol === 'BTC') return h;
    const resolved = symbolToContract.get(h.symbol);
    return resolved ? { ...h, tokenContract: resolved.toLowerCase() } : h;
  });
}

// ─── Stage 2 — aggregate flat holdings into ordered TokenTotal[] ───────────

export interface AggregateOptions {
  /** Lowercased preferred address ordering for known core tokens. */
  addressOrder?:           readonly string[];
  /** Optional uppercase symbol ordering for discovered (non-core) tokens. */
  discoveredSymbolOrder?:  readonly string[];
  /** When true, drops symbol-only entries that never resolved to a contract. */
  dropUnresolvedSymbols?:  boolean;
}

/**
 * Aggregate raw holdings into UI-ready TokenTotal[].
 *
 * Steps:
 *  1. Group by canonical mapKey. Sum totals as scaled bigint (sats precision).
 *  2. Merge symbol-only entries into address-keyed entries with the same
 *     symbol when one exists (reward token reconciliation).
 *  3. Order results: known address order first, then discovered symbol order,
 *     then alphabetical, then total > 0 filter.
 */
export function aggregateHoldings(
  holdings: RawHolding[],
  opts:     AggregateOptions = {},
): TokenTotal[] {
  interface Bucket {
    symbol:        string;
    tokenContract: string | undefined;
    totalScaled:   bigint;
    breakdown:     TokenBreakdown[];
  }
  const buckets = new Map<string, Bucket>();

  for (const h of holdings) {
    if (!h.symbol || !(h.amount > 0)) continue;
    const key = mapKeyFor(h.symbol, h.tokenContract);
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        symbol:        h.symbol.toUpperCase(),
        tokenContract: h.symbol.toUpperCase() === 'BTC' ? undefined : h.tokenContract,
        totalScaled:   0n,
        breakdown:     [],
      };
      buckets.set(key, bucket);
    }
    bucket.totalScaled += toScaled(h.amount);
    bucket.breakdown.push({
      address:       h.walletAddress,
      label:         h.label,
      amount:        h.amount,
      type:          h.type,
      tokenContract: bucket.tokenContract,
    });
  }

  // Reconcile symbol-only buckets into address-keyed buckets sharing the same
  // symbol — mirrors the legacy "reward token name match" merge.
  for (const [key, bucket] of [...buckets.entries()]) {
    if (bucket.tokenContract) continue;             // already address-keyed
    if (bucket.symbol === 'BTC') continue;          // BTC native is its own bucket
    const target = [...buckets.values()].find(
      (b) => b.tokenContract && b.symbol === bucket.symbol,
    );
    if (target) {
      target.totalScaled += bucket.totalScaled;
      // Re-stamp breakdown with target contract for downstream display
      for (const br of bucket.breakdown) {
        target.breakdown.push({ ...br, tokenContract: target.tokenContract });
      }
      buckets.delete(key);
    } else if (opts.dropUnresolvedSymbols) {
      buckets.delete(key);
    }
  }

  // Build ordered output
  const result: TokenTotal[] = [];
  const used = new Set<string>();

  if (opts.addressOrder) {
    for (const addrKey of opts.addressOrder) {
      const k = addrKey.toLowerCase();
      const bucket = buckets.get(k);
      if (bucket) {
        result.push({
          symbol:        bucket.symbol,
          tokenContract: bucket.tokenContract,
          total:         fromScaled(bucket.totalScaled),
          breakdown:     bucket.breakdown,
        });
        used.add(k);
      }
    }
  }

  // Discovered tail — sort by symbol order, then alphabetical
  const symbolOrder = opts.discoveredSymbolOrder ?? [];
  const remaining = [...buckets.entries()].filter(([k]) => !used.has(k));
  remaining.sort(([, a], [, b]) => {
    const ad = symbolOrder.indexOf(a.symbol);
    const bd = symbolOrder.indexOf(b.symbol);
    if (ad !== -1 && bd !== -1) return ad - bd;
    if (ad !== -1) return -1;
    if (bd !== -1) return  1;
    return a.symbol.localeCompare(b.symbol);
  });
  for (const [, bucket] of remaining) {
    result.push({
      symbol:        bucket.symbol,
      tokenContract: bucket.tokenContract,
      total:         fromScaled(bucket.totalScaled),
      breakdown:     bucket.breakdown,
    });
  }

  return result.filter((t) => t.total > 0);
}

/**
 * Convenience composite — walk + (optional resolve) + aggregate in one call.
 */
export function aggregateTokenHoldings(
  positions:        Position[],
  opts: AggregateOptions & { symbolToContract?: Map<string, string> } = {},
): TokenTotal[] {
  let holdings = walkPositionHoldings(positions);
  if (opts.symbolToContract) {
    holdings = resolveHoldingContracts(holdings, opts.symbolToContract);
  }
  return aggregateHoldings(holdings, opts);
}

// ─── Tiny helpers exported for callers that want intermediate stages ───────
export const __scale  = SCALE;
export const __scaleBi = SCALE_BI;
