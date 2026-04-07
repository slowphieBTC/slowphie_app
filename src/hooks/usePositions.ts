import { useState, useEffect, useCallback, useRef } from 'react';
import {
  resolveToOpnetAddress,
  getStakingInfo,
  getAllFarmPositions,
  getAllSatFarmPositions,
  getAllSwapFarmPositions,
  getTokenBalance,
  getLPUnderlying,
  formatTokenAmount,
  CONTRACTS,
} from '../api/opnet';
import { fetchTrackedTokens } from '../api/slowphie';
import { useAppStore } from '../store';
import type { Position, FarmInfo } from '../types';

// ── Farm contract addresses ────────────────────────────────────────────────
const PILL_FARM_ADDR = '0x3fb33dc12672aba975babfa8c0b400a3c86461d364861a7de50d20672cb1b80f';
const SAT_FARM_ADDR  = '0x22b1217f899b93db082d0634c167a744809d02b2a9ac46cd965706380350e0b1';
const SWAP_FARM_ADDR = '0x96a7f30400afc8b56650c81b06634c1e7901917e45f16e3c03e6b3b658ce72f9';
const PILL_LINK      = 'https://motoswap.org/farm/pill';
const SAT_LINK       = `https://motoswap.org/farm/${SAT_FARM_ADDR}`;
const SWAP_LINK      = `https://motoswap.org/farm/${SWAP_FARM_ADDR}`;

/** Cache TTL: 30 seconds */
const CACHE_TTL_MS = 30_000;

/** Farm/staking contracts — excluded from wallet balance scan */
const EXCLUDED_ADDRESSES = new Set([
  PILL_FARM_ADDR,
  SAT_FARM_ADDR,
  SWAP_FARM_ADDR,
  CONTRACTS.STAKING,
].map(a => a.toLowerCase()));

// ── Minimal token shape used for detection ────────────────────────────────
interface TokenEntry {
  address:      string;
  symbol:       string;
  decimals:     number;
  isPool:       boolean;
  token0Symbol: string | null;
  token1Symbol: string | null;
}

/**
 * Static fallback — used when Slowphie server is unreachable.
 * Covers all known MotoSwap ecosystem tokens + LP pairs.
 */
const FALLBACK_TOKENS: TokenEntry[] = [
  { address: CONTRACTS.MOTO_TOKEN,   symbol: 'MOTO',      decimals: 18, isPool: false, token0Symbol: null,   token1Symbol: null   },
  { address: CONTRACTS.PILL_TOKEN,   symbol: 'PILL',      decimals: 18, isPool: false, token0Symbol: null,   token1Symbol: null   },
  { address: CONTRACTS.SAT_TOKEN,    symbol: 'SAT',       decimals: 18, isPool: false, token0Symbol: null,   token1Symbol: null   },
  { address: CONTRACTS.SWAP_TOKEN,   symbol: 'SWAP',      decimals: 18, isPool: false, token0Symbol: null,   token1Symbol: null   },
  { address: CONTRACTS.MOTO_PILL_LP, symbol: 'MOTO/PILL', decimals: 18, isPool: true,  token0Symbol: 'MOTO', token1Symbol: 'PILL' },
  { address: CONTRACTS.LP_SWMOTO,    symbol: 'SWAP/MOTO', decimals: 18, isPool: true,  token0Symbol: 'SWAP', token1Symbol: 'MOTO' },
];

function makeFarmInfo(
  farmName: string, farmContract: string, farmLink: string,
  poolId: number, staked: bigint, pending: bigint,
  decimals: number, rewardToken: string,
): FarmInfo | null {
  const s = formatTokenAmount(staked, decimals);
  const p = formatTokenAmount(pending, 18);
  if (s === 0 && p === 0) return null;
  return { farmName, farmContract, farmLink, poolId, staked: s, pending: p, rewardToken };
}

const norm = (a: string) => a.toLowerCase();

export function usePositions(addresses: string[]) {
  const allPositions         = useAppStore((s) => s.allPositions);
  const positionsLastFetched = useAppStore((s) => s.positionsLastFetched);
  const setAllPositions      = useAppStore((s) => s.setAllPositions);

  const [loading,    setLoading]    = useState(() => allPositions.length === 0 && addresses.length > 0);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const fetchingRef                 = useRef(false);

  /**
   * Token list cache — loaded once from Slowphie server per session.
   * Cleared on manual refresh so the user can pick up new tokens.
   */
  const tokenListRef = useRef<TokenEntry[] | null>(null);

  const fetchAll = useCallback(async (silent = false) => {
    if (!addresses.length) { setAllPositions([]); return; }
    if (fetchingRef.current) return; // prevent concurrent fetches
    fetchingRef.current = true;
    if (!silent) setLoading(true);
    setError(null);

    // ── 1. Load token/pool list from Slowphie server (or fallback) ────────
    if (!tokenListRef.current) {
      try {
        const resp = await fetchTrackedTokens();
        const list: TokenEntry[] = [];

        // Regular tokens (non-pool, non-excluded)
        for (const t of resp.tokens) {
          if (t.isPool || EXCLUDED_ADDRESSES.has(norm(t.address))) continue;
          list.push({
            address:      t.address,
            symbol:       t.symbol,
            decimals:     t.decimals,
            isPool:       false,
            token0Symbol: null,
            token1Symbol: null,
          });
        }

        // LP pools (server returns full pool list — never paginated)
        for (const p of resp.pools) {
          if (EXCLUDED_ADDRESSES.has(norm(p.address))) continue;
          list.push({
            address:      p.address,
            symbol:       p.symbol,
            decimals:     p.decimals,
            isPool:       true,
            token0Symbol: p.token0Symbol,
            token1Symbol: p.token1Symbol,
          });
        }

        tokenListRef.current = list;
      } catch {
        // Server unreachable — fall back to known static list
        tokenListRef.current = FALLBACK_TOKENS;
      }
    }
    const tokenList = tokenListRef.current!;

    const positions: Position[] = [];

    // ── 2. Per-address detection ───────────────────────────────────────────
    for (const rawAddr of addresses) {
      try {
        const opnetAddr = await resolveToOpnetAddress(rawAddr);

        // ── 2a. Fetch all farm + staking data in parallel ────────────────
        const [staking, pillFarmPools, satFarmPools, swapFarmPools] = await Promise.all([
          getStakingInfo(opnetAddr),
          getAllFarmPositions(opnetAddr),
          getAllSatFarmPositions(opnetAddr),
          getAllSwapFarmPositions(opnetAddr),
        ]);

        // ── 2b. MOTO Staking position ─────────────────────────────────────
        const hasStakingRewards = staking.rewardTokens.some(rt => rt.pending > 0n);
        if (staking.stakedMoto > 0n || hasStakingRewards) {
          const stakingRewards = staking.rewardTokens.map(rt => ({
            tokenAddress: rt.address,
            symbol:       rt.symbol,
            pending:      formatTokenAmount(rt.pending, 18),
          }));
          const primaryReward = stakingRewards.find(r => r.pending > 0) ?? stakingRewards[0];
          positions.push({
            id: `stake-${rawAddr}`, address: rawAddr, type: 'stake',
            label: 'MotoSwap Stake', token: 'MOTO',
            amount:          formatTokenAmount(staking.stakedMoto, 18),
            rewards:         primaryReward?.pending ?? 0,
            rewardToken:     primaryReward?.symbol ?? null,
            contractAddress: CONTRACTS.STAKING,
            stakingRewards,
          });
        }

        // ── 2c. BTC self-custody farm positions (pool id 0 in each farm) ──
        const pillBtc = pillFarmPools.find(f => f.poolId === 0);
        if (pillBtc && (pillBtc.staked > 0n || pillBtc.pendingReward > 0n)) {
          positions.push({
            id: `pillfarm-btc-${rawAddr}`, address: rawAddr, type: 'farm',
            label: 'BTC Farm · PILL Farm', token: 'BTC',
            amount: formatTokenAmount(pillBtc.staked, 8),
            rewards: formatTokenAmount(pillBtc.pendingReward, 18),
            rewardToken: 'PILL', contractAddress: PILL_FARM_ADDR, poolId: 0,
          });
        }
        const satBtc = satFarmPools.find(f => f.poolId === 0);
        if (satBtc && (satBtc.staked > 0n || satBtc.pendingReward > 0n)) {
          positions.push({
            id: `satfarm-btc-${rawAddr}`, address: rawAddr, type: 'farm',
            label: "Satoshi's Farm · BTC", token: 'BTC',
            amount: formatTokenAmount(satBtc.staked, 8),
            rewards: formatTokenAmount(satBtc.pendingReward, 18),
            rewardToken: 'SAT', contractAddress: SAT_FARM_ADDR, poolId: 0,
          });
        }
        const swapBtc = swapFarmPools.find(f => f.poolId === 0);
        if (swapBtc && (swapBtc.staked > 0n || swapBtc.pendingReward > 0n)) {
          positions.push({
            id: `swapfarm-btc-${rawAddr}`, address: rawAddr, type: 'farm',
            label: 'SWAP Farm · BTC', token: 'BTC',
            amount: formatTokenAmount(swapBtc.staked, 8),
            rewards: formatTokenAmount(swapBtc.pendingReward, 18),
            rewardToken: 'SWAP', contractAddress: SWAP_FARM_ADDR, poolId: 0,
          });
        }

        // ── 2d. Farm lookup map: tokenAddress → FarmInfo[] ────────────────
        const farmsByToken = new Map<string, FarmInfo[]>();
        const addFarm = (contractAddr: string, info: FarmInfo | null) => {
          if (!info) return;
          const key = norm(contractAddr);
          const arr = farmsByToken.get(key) ?? [];
          arr.push(info);
          farmsByToken.set(key, arr);
        };

        // PILL token: farmed in PILL Farm (p1), Satoshi's Farm (p3), SWAP Farm (p3)
        addFarm(CONTRACTS.PILL_TOKEN, makeFarmInfo('PILL Farm',      PILL_FARM_ADDR, PILL_LINK, 1, pillFarmPools.find(f => f.poolId === 1)?.staked ?? 0n, pillFarmPools.find(f => f.poolId === 1)?.pendingReward ?? 0n, 18, 'PILL'));
        addFarm(CONTRACTS.PILL_TOKEN, makeFarmInfo("Satoshi's Farm", SAT_FARM_ADDR,  SAT_LINK,  3, satFarmPools.find(f => f.poolId === 3)?.staked  ?? 0n, satFarmPools.find(f => f.poolId === 3)?.pendingReward  ?? 0n, 18, 'SAT'));
        addFarm(CONTRACTS.PILL_TOKEN, makeFarmInfo('SWAP Farm',      SWAP_FARM_ADDR, SWAP_LINK, 3, swapFarmPools.find(f => f.poolId === 3)?.staked ?? 0n, swapFarmPools.find(f => f.poolId === 3)?.pendingReward ?? 0n, 18, 'SWAP'));

        // MOTO token: farmed in PILL Farm (p3), Satoshi's Farm (p2), SWAP Farm (p2)
        addFarm(CONTRACTS.MOTO_TOKEN, makeFarmInfo('PILL Farm',      PILL_FARM_ADDR, PILL_LINK, 3, pillFarmPools.find(f => f.poolId === 3)?.staked ?? 0n, pillFarmPools.find(f => f.poolId === 3)?.pendingReward ?? 0n, 18, 'PILL'));
        addFarm(CONTRACTS.MOTO_TOKEN, makeFarmInfo("Satoshi's Farm", SAT_FARM_ADDR,  SAT_LINK,  2, satFarmPools.find(f => f.poolId === 2)?.staked  ?? 0n, satFarmPools.find(f => f.poolId === 2)?.pendingReward  ?? 0n, 18, 'SAT'));
        addFarm(CONTRACTS.MOTO_TOKEN, makeFarmInfo('SWAP Farm',      SWAP_FARM_ADDR, SWAP_LINK, 2, swapFarmPools.find(f => f.poolId === 2)?.staked ?? 0n, swapFarmPools.find(f => f.poolId === 2)?.pendingReward ?? 0n, 18, 'SWAP'));

        // SAT token: farmed in Satoshi's Farm (p1)
        addFarm(CONTRACTS.SAT_TOKEN,  makeFarmInfo("Satoshi's Farm", SAT_FARM_ADDR,  SAT_LINK,  1, satFarmPools.find(f => f.poolId === 1)?.staked  ?? 0n, satFarmPools.find(f => f.poolId === 1)?.pendingReward  ?? 0n, 18, 'SAT'));

        // SWAP token: farmed in SWAP Farm (p1)
        addFarm(CONTRACTS.SWAP_TOKEN, makeFarmInfo('SWAP Farm',      SWAP_FARM_ADDR, SWAP_LINK, 1, swapFarmPools.find(f => f.poolId === 1)?.staked ?? 0n, swapFarmPools.find(f => f.poolId === 1)?.pendingReward ?? 0n, 18, 'SWAP'));

        // LP MOTO/PILL: farmed in PILL Farm (p2)
        addFarm(CONTRACTS.MOTO_PILL_LP, makeFarmInfo('PILL Farm',    PILL_FARM_ADDR, PILL_LINK, 2, pillFarmPools.find(f => f.poolId === 2)?.staked ?? 0n, pillFarmPools.find(f => f.poolId === 2)?.pendingReward ?? 0n, 18, 'PILL'));

        // LP SWAP/MOTO: farmed in SWAP Farm (p4)
        addFarm(CONTRACTS.LP_SWMOTO,    makeFarmInfo('SWAP Farm',    SWAP_FARM_ADDR, SWAP_LINK, 4, swapFarmPools.find(f => f.poolId === 4)?.staked ?? 0n, swapFarmPools.find(f => f.poolId === 4)?.pendingReward ?? 0n, 18, 'SWAP'));

        // Keep raw staked bigints for LP underlying calculation
        const lpStakedRaw = new Map<string, bigint>();
        lpStakedRaw.set(norm(CONTRACTS.MOTO_PILL_LP), pillFarmPools.find(f => f.poolId === 2)?.staked ?? 0n);
        lpStakedRaw.set(norm(CONTRACTS.LP_SWMOTO),    swapFarmPools.find(f => f.poolId === 4)?.staked ?? 0n);

        // ── 2e. Fetch all wallet balances in parallel ─���────────────────────
        const walletRaw = await Promise.all(
          tokenList.map(t => getTokenBalance(t.address, opnetAddr).catch(() => 0n))
        );

        // ── 2f. Build token + LP positions ────────────────────────────────
        for (let i = 0; i < tokenList.length; i++) {
          const token     = tokenList[i];
          const rawBal    = walletRaw[i];
          const walletAmt = formatTokenAmount(rawBal, token.decimals);
          const farms     = farmsByToken.get(norm(token.address)) ?? [];
          const hasFarm   = farms.length > 0;

          if (token.isPool) {
            // ── LP position ─────────────────────────────────────────────
            const stakedRaw   = lpStakedRaw.get(norm(token.address)) ?? 0n;
            const hasPosition = rawBal > 0n || stakedRaw > 0n ||
              farms.some(f => f.staked > 0 || f.pending > 0);
            if (!hasPosition) continue;

            const lpLabel = token.token0Symbol && token.token1Symbol
              ? `${token.token0Symbol}/${token.token1Symbol}`
              : token.symbol;

            // Compute underlying using best available balance
            let lpUnderlying;
            const balForCalc = rawBal > 0n ? rawBal : stakedRaw;
            if (balForCalc > 0n && token.token0Symbol && token.token1Symbol) {
              try {
                lpUnderlying = await getLPUnderlying(
                  token.address,
                  token.token0Symbol, 18,
                  token.token1Symbol, 18,
                  balForCalc,
                );
              } catch { /* ignore */ }
            }

            const primaryFarm = farms[0];
            positions.push({
              id:              `lp-${token.address}-${rawAddr}`,
              address:         rawAddr,
              type:            'lp',
              label:           `LP ${lpLabel}`,
              token:           lpLabel,
              amount:          walletAmt > 0 ? walletAmt : (primaryFarm?.staked ?? 0),
              rewards:         primaryFarm?.pending ?? 0,
              rewardToken:     primaryFarm?.rewardToken ?? null,
              contractAddress: token.address,
              hasFarmView:     hasFarm,
              walletBalance:   walletAmt,
              farms:           hasFarm ? farms : undefined,
              lpUnderlying,
            });

          } else {
            // ── Token position ────────────────────────────────────────────
            const hasPosition = walletAmt > 0 ||
              farms.some(f => f.staked > 0 || f.pending > 0);
            if (!hasPosition) continue;

            positions.push({
              id:              `token-${token.address}-${rawAddr}`,
              address:         rawAddr,
              type:            'farm',
              label:           token.symbol,
              token:           token.symbol,
              amount:          walletAmt,
              rewards:         0,
              rewardToken:     null,
              contractAddress: token.address,
              hasFarmView:     hasFarm,
              walletBalance:   walletAmt,
              farms:           hasFarm ? farms : undefined,
            });
          }
        }

      } catch {
        // continue with next address silently
      }
    }

    setAllPositions(positions);
    setLoading(false);
    fetchingRef.current = false;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addresses.join(',')]);

  useEffect(() => {
    if (!addresses.length) return;

    const now     = Date.now();
    const isStale = now - positionsLastFetched > CACHE_TTL_MS;
    const isEmpty = allPositions.length === 0;

    if (isEmpty || isStale) {
      fetchAll(/* silent= */ !isEmpty);
    }

    // Background poll every 30s (silent — no loading indicator)
    const interval = setInterval(() => fetchAll(true), CACHE_TTL_MS);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addresses.join(',')]);

  // Manual refresh — clears token list cache to re-fetch from server
  const refresh = useCallback(async () => {
    tokenListRef.current = null;
    setRefreshing(true);
    await fetchAll(allPositions.length > 0);
    setRefreshing(false);
  }, [fetchAll, allPositions.length]);

  return { positions: allPositions, loading, refreshing, error, refresh };
}
