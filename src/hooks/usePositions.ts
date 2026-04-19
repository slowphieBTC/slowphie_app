import { useState, useEffect, useCallback, useRef } from 'react';
import {
  resolveToOpnetAddress,
  getStakingInfo,
  getAllDynamicFarmPositions,
  getTokenBalance,
  getLPUnderlying,
  getBTCNativeBalance,
  formatTokenAmount,
  CONTRACTS,
} from '../api/opnet';
import { fetchTrackedTokens, fetchFarms } from '../api/slowphie';
import { fetchMchadPositionClientSide } from '../api/mchadClient';
import type { Farm } from '../api/slowphie';
import { useAppStore } from '../store';
import type { Position, FarmInfo } from '../types';

/** Fallback interval: 10 minutes */
const FALLBACK_TTL_MS = 600_000;

/** Farm/staking contracts — excluded from wallet balance scan */
const EXCLUDED_ADDRESSES = new Set([
  CONTRACTS.PILL_FARM,
  CONTRACTS.SAT_FARM,
  CONTRACTS.SWAP_FARM,
  CONTRACTS.STAKING,
].map(a => a.toLowerCase()));

/** Core ecosystem tokens — always fetched in Phase 1.
 *  Includes major tokens + LP pool contracts + MCHAD/MOTO custom staking LP. */
const CORE_ECOSYSTEM_TOKENS = new Set([
  CONTRACTS.MOTO_TOKEN,
  CONTRACTS.PILL_TOKEN,
  CONTRACTS.SAT_TOKEN,
  CONTRACTS.SWAP_TOKEN,
  CONTRACTS.MCHAD_TOKEN,
  CONTRACTS.BLUE_TOKEN,
  CONTRACTS.MOTO_PILL_LP,
  CONTRACTS.LP_SWMOTO,
  CONTRACTS.LP_BLUEPILL,
  CONTRACTS.LP_BLUEMOTO,
  // MCHAD/MOTO custom staking LP
  '0xb0c47bdfabfc15772dc40b4e65e4ca3c3440229a580a4a792a2f01c32d6ec944',
].map(a => a.toLowerCase()));

const DISCOVERY_BATCH_SIZE = 8;

// ── Minimal token shape used for detection ────────────────────────────────
interface TokenEntry {
  address:       string;
  symbol:        string;
  decimals:      number;
  isPool:        boolean;
  token0Symbol:  string | null;
  token1Symbol:  string | null;
  token0Address: string | null;  // contract address of token0 (LP pools only)
  token1Address: string | null;  // contract address of token1 (LP pools only)
}

/**
 * Static fallback — used when Slowphie server is unreachable.
 * Covers all known MotoSwap ecosystem tokens + LP pairs.
 */
const FALLBACK_TOKENS: TokenEntry[] = [
  { address: CONTRACTS.MOTO_TOKEN,  symbol: 'MOTO',      decimals: 18, isPool: false, token0Symbol: null,   token1Symbol: null,   token0Address: null, token1Address: null },
  { address: CONTRACTS.PILL_TOKEN,  symbol: 'PILL',      decimals: 18, isPool: false, token0Symbol: null,   token1Symbol: null,   token0Address: null, token1Address: null },
  { address: CONTRACTS.SAT_TOKEN,   symbol: 'SAT',       decimals: 18, isPool: false, token0Symbol: null,   token1Symbol: null,   token0Address: null, token1Address: null },
  { address: CONTRACTS.SWAP_TOKEN,  symbol: 'SWAP',      decimals: 18, isPool: false, token0Symbol: null,   token1Symbol: null,   token0Address: null, token1Address: null },
  { address: CONTRACTS.MOTO_PILL_LP,symbol: 'MOTO/PILL', decimals: 18, isPool: true,  token0Symbol: 'MOTO', token1Symbol: 'PILL', token0Address: CONTRACTS.MOTO_TOKEN, token1Address: CONTRACTS.PILL_TOKEN },
  { address: CONTRACTS.LP_SWMOTO,   symbol: 'SWAP/MOTO', decimals: 18, isPool: true,  token0Symbol: 'SWAP', token1Symbol: 'MOTO', token0Address: CONTRACTS.SWAP_TOKEN, token1Address: CONTRACTS.MOTO_TOKEN },
];
/** Static fallback farms — when /farms endpoint is unreachable */
const FALLBACK_FARMS: Farm[] = [
  {
    id: 'pill_farm', name: 'PILL Farm',
    address: CONTRACTS.PILL_FARM,
    rewardToken: CONTRACTS.PILL_TOKEN, rewardSymbol: 'PILL',
    pools: [
      { poolId: 0, tokenContract: null,                   symbol: 'BTC',       name: 'Bitcoin (Native)', decimals: 8,  isLP: false, token0: null, token0Symbol: null, token1: null, token1Symbol: null },
      { poolId: 1, tokenContract: CONTRACTS.PILL_TOKEN,   symbol: 'PILL',      name: 'Orange Pill',      decimals: 18, isLP: false, token0: null, token0Symbol: null, token1: null, token1Symbol: null },
      { poolId: 2, tokenContract: CONTRACTS.MOTO_PILL_LP, symbol: 'MOTOSWAP',  name: 'MOTO/PILL LP',     decimals: 18, isLP: true,  token0: null, token0Symbol: 'MOTO', token1: null, token1Symbol: 'PILL' },
      { poolId: 3, tokenContract: CONTRACTS.MOTO_TOKEN,   symbol: 'MOTO',      name: 'Motoswap',         decimals: 18, isLP: false, token0: null, token0Symbol: null, token1: null, token1Symbol: null },
      { poolId: 8, tokenContract: CONTRACTS.LP_BLUEPILL,  symbol: 'LP-BLUEPILL',name: 'BLUE/PILL LP',    decimals: 18, isLP: true,  token0: null, token0Symbol: 'BLUE', token1: null, token1Symbol: 'PILL' },
      { poolId: 9, tokenContract: CONTRACTS.LP_BLUEMOTO,  symbol: 'LP-BLUEMOTO',name: 'BLUE/MOTO LP',    decimals: 18, isLP: true,  token0: null, token0Symbol: 'BLUE', token1: null, token1Symbol: 'MOTO' },
    ],
  },
  {
    id: 'sat_farm', name: "Satoshi's Farm",
    address: CONTRACTS.SAT_FARM,
    rewardToken: CONTRACTS.SAT_TOKEN, rewardSymbol: 'SAT',
    pools: [
      { poolId: 0, tokenContract: null,                 symbol: 'BTC',  name: 'Bitcoin (Native)', decimals: 8,  isLP: false, token0: null, token0Symbol: null, token1: null, token1Symbol: null },
      { poolId: 1, tokenContract: CONTRACTS.SAT_TOKEN,  symbol: 'SAT',  name: 'SAT',             decimals: 18, isLP: false, token0: null, token0Symbol: null, token1: null, token1Symbol: null },
      { poolId: 2, tokenContract: CONTRACTS.MOTO_TOKEN, symbol: 'MOTO', name: 'Motoswap',        decimals: 18, isLP: false, token0: null, token0Symbol: null, token1: null, token1Symbol: null },
      { poolId: 3, tokenContract: CONTRACTS.PILL_TOKEN, symbol: 'PILL', name: 'Orange Pill',     decimals: 18, isLP: false, token0: null, token0Symbol: null, token1: null, token1Symbol: null },
    ],
  },
  {
    id: 'swap_farm', name: 'SWAP Farm',
    address: CONTRACTS.SWAP_FARM,
    rewardToken: CONTRACTS.SWAP_TOKEN, rewardSymbol: 'SWAP',
    pools: [
      { poolId: 0, tokenContract: null,                 symbol: 'BTC',          name: 'Bitcoin (Native)', decimals: 8,  isLP: false, token0: null, token0Symbol: null, token1: null, token1Symbol: null },
      { poolId: 1, tokenContract: CONTRACTS.SWAP_TOKEN, symbol: 'SWAP',         name: 'SWAP',            decimals: 18, isLP: false, token0: null, token0Symbol: null, token1: null, token1Symbol: null },
      { poolId: 2, tokenContract: CONTRACTS.MOTO_TOKEN, symbol: 'MOTO',         name: 'Motoswap',        decimals: 18, isLP: false, token0: null, token0Symbol: null, token1: null, token1Symbol: null },
      { poolId: 3, tokenContract: CONTRACTS.PILL_TOKEN, symbol: 'PILL',         name: 'Orange Pill',     decimals: 18, isLP: false, token0: null, token0Symbol: null, token1: null, token1Symbol: null },
      { poolId: 4, tokenContract: CONTRACTS.LP_SWMOTO,  symbol: 'LP SWAP/MOTO', name: 'SWAP/MOTO LP',    decimals: 18, isLP: true,  token0: null, token0Symbol: 'SWAP', token1: null, token1Symbol: 'MOTO' },
    ],
  },
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

function farmLink(farm: Farm): string {
  if (farm.id === 'pill_farm')  return 'https://motoswap.org/farm/pill';
  if (farm.id === 'sat_farm')   return `https://motoswap.org/farm/${farm.address}`;
  if (farm.id === 'swap_farm')  return `https://motoswap.org/farm/${farm.address}`;
  return `https://motoswap.org/farm/${farm.address}`;
}

const norm = (a: string) => a.toLowerCase();

export function usePositions(addresses: string[]) {
  const allPositions   = useAppStore((s) => s.allPositions);
  const latestBlock    = useAppStore((s) => s.latestBlock);
  const setAllPositions = useAppStore((s) => s.setAllPositions);
  const mergeTokenIcons = useAppStore((s) => s.mergeTokenIcons);

  const [loading,    setLoading]    = useState(() => allPositions.length === 0 && addresses.length > 0);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const fetchingRef                 = useRef(false);
  const phase2IdRef                 = useRef(0);

  /** Token list cache — loaded once per session from /tracks */
  const tokenListRef  = useRef<TokenEntry[] | null>(null);
  /** Farm list cache — loaded once per session from /farms */
  const farmListRef   = useRef<Farm[] | null>(null);
  /** Full address→{symbol,icon} lookup for staking reward resolution */
  const addrLookupRef = useRef<Map<string, { symbol: string; icon?: string }> | null>(null);

  const fetchAll = useCallback(async (silent = false) => {
    if (!addresses.length) { setAllPositions([]); return; }
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    if (!silent) setLoading(true);
    setError(null);
    const currentPhase2Id = ++phase2IdRef.current;

    // ── 1. Load token list + farm list from server (or fallback) ─────────
    if (!tokenListRef.current || !farmListRef.current) {
      const [tracksResult, farmsResult] = await Promise.allSettled([
        fetchTrackedTokens(),
        fetchFarms(),
      ]);

      // Process tracks
      if (tracksResult.status === 'fulfilled') {
        const resp = tracksResult.value;
        const list: TokenEntry[] = [];

        for (const t of resp.tokens) {
          if (t.isPool || EXCLUDED_ADDRESSES.has(norm(t.address))) continue;
          list.push({ address: t.address, symbol: t.symbol, decimals: t.decimals,
            isPool: false, token0Symbol: null, token1Symbol: null, token0Address: null, token1Address: null });
        }
        for (const p of resp.pools) {
          if (EXCLUDED_ADDRESSES.has(norm(p.address))) continue;
          list.push({ address: p.address, symbol: p.symbol, decimals: p.decimals,
            isPool: true, token0Symbol: p.token0Symbol, token1Symbol: p.token1Symbol,
            token0Address: (p as any).token0 ?? null,
            token1Address: (p as any).token1 ?? null });
        }

        // Count how many tokens WITH icons share each symbol — detect true icon collisions.
        const symbolIconCount: Record<string, number> = {};
        for (const t of [...resp.tokens, ...resp.pools]) {
          if (t.icon && t.icon.startsWith('http')) {
            const sym = t.symbol.toUpperCase();
            symbolIconCount[sym] = (symbolIconCount[sym] ?? 0) + 1;
          }
        }

        const icons: Record<string, string> = {};
        const lookup = new Map<string, { symbol: string; icon?: string }>();
        for (const t of [...resp.tokens, ...resp.pools]) {
          if (t.icon && t.icon.startsWith('http')) {
            const sym = t.symbol.toUpperCase();
            if ((symbolIconCount[sym] ?? 0) <= 1) {
              icons[sym] = t.icon;
            }
            if (t.address) icons[`addr:${t.address.toLowerCase()}`] = t.icon;
          }
          lookup.set(norm(t.address), {
            symbol: t.symbol,
            icon:   t.icon && t.icon.startsWith('http') ? t.icon : undefined,
          });
        }
        if (Object.keys(icons).length > 0) mergeTokenIcons(icons);
        addrLookupRef.current = lookup;
        tokenListRef.current  = list;
      } else {
        tokenListRef.current = FALLBACK_TOKENS;
      }

      // Process farms
      if (farmsResult.status === 'fulfilled') {
        farmListRef.current = farmsResult.value.farms;
      } else {
        farmListRef.current = FALLBACK_FARMS;
      }
    }

    const tokenList = tokenListRef.current!;
    const farms     = farmListRef.current!;
    // Build address→decimals lookup from non-pool tokens (e.g. MCHAD=8, MOTO=18)
    const tokenDecimalsMap = new Map<string, number>();
    for (const t of tokenList) {
      if (!t.isPool) tokenDecimalsMap.set(norm(t.address), t.decimals);
    }
    // Known overrides not always in tokenList
    tokenDecimalsMap.set(norm(CONTRACTS.MCHAD_TOKEN), 8);

    const positions: Position[] = [];

    // ── Build coreTokenSet from ecosystem tokens + farm pools + LP pairs ───
    // This is address-independent, built once before the loop.
    const coreTokenSet = new Set<string>();
    for (const addr of CORE_ECOSYSTEM_TOKENS) coreTokenSet.add(addr);
    for (const farm of farms) {
      for (const pool of farm.pools) {
        if (pool.tokenContract) coreTokenSet.add(norm(pool.tokenContract));
      }
      coreTokenSet.add(norm(farm.rewardToken));
    }
    for (const t of tokenList) {
      if (t.isPool) {
        if (t.token0Address) coreTokenSet.add(norm(t.token0Address));
        if (t.token1Address) coreTokenSet.add(norm(t.token1Address));
      }
    }
    coreTokenSet.add(norm(CONTRACTS.MCHAD_TOKEN));

    // Split tokenList into core and discovery
    const coreTokens = tokenList.filter(t => coreTokenSet.has(norm(t.address)));
    const discoveryTokens = tokenList.filter(t => !coreTokenSet.has(norm(t.address)));

    // Accumulate discovery tokens per address for Phase 2
    const discoveryTokensByAddr: {
      rawAddr: string;
      opnetAddr: string;
      token: TokenEntry;
    }[] = [];
    // ── 2. Per-address detection ───────────────────────────────────────────
    for (const rawAddr of addresses) {
      try {
        const opnetAddr = await resolveToOpnetAddress(rawAddr);

        // ── 2a. Fetch staking + all farm positions in parallel ────────────
        const [staking, btcWalletBalance, mchadData, ...farmResults] = await Promise.all([
          getStakingInfo(opnetAddr),
          getBTCNativeBalance(rawAddr),
          fetchMchadPositionClientSide(rawAddr),
          ...farms.map(farm => getAllDynamicFarmPositions(farm.address, farm.pools, opnetAddr)),
        ]);

        // farmResults[i] corresponds to farms[i]
        const farmPoolResults = farmResults as Awaited<ReturnType<typeof getAllDynamicFarmPositions>>[];

        // ── 2b. MOTO Staking position ─────────────────────────────────────
        const hasStakingRewards = staking.rewardTokens.some(rt => rt.pending > 0n);
        if (staking.stakedMoto > 0n || hasStakingRewards) {
          const stakingRewards = staking.rewardTokens.map(rt => {
            let symbol = rt.symbol;
            if (symbol === 'UNKNOWN' && addrLookupRef.current) {
              const found = addrLookupRef.current.get(norm(rt.address));
              if (found) {
                symbol = found.symbol;
                if (found.icon) {
                  const addrIcons: Record<string, string> = {
                    [`addr:${norm(rt.address)}`]: found.icon,
                  };
                  addrIcons[symbol.toUpperCase()] = found.icon;
                  mergeTokenIcons(addrIcons);
                }
              }
            }
            const rewardDecimals = tokenDecimalsMap.get(norm(rt.address)) ?? 18;
            return { tokenAddress: rt.address, symbol, pending: formatTokenAmount(rt.pending, rewardDecimals) };
          });
          const primaryReward = stakingRewards.find(r => r.pending > 0) ?? stakingRewards[0];
          positions.push({
            id: `stake-${rawAddr}`, address: rawAddr, type: 'stake',
            label: 'MotoSwap Stake', token: 'MOTO',
            amount:          formatTokenAmount(staking.stakedMoto, 18),
            rewards:         primaryReward?.pending ?? 0,
            rewardToken:     primaryReward?.symbol ?? null,
            contractAddress: CONTRACTS.MOTO_TOKEN,
            stakingRewards,
          });
        }

        // ── 2c. BTC self-custody farm positions (pool 0 in each farm) ──────
        const btcFarms: FarmInfo[] = [];
        for (let fi = 0; fi < farms.length; fi++) {
          const farm   = farms[fi];
          const poolResults = farmPoolResults[fi];
          const btcPool = poolResults.find(p => p.poolId === 0);
          if (btcPool && (btcPool.staked > 0n || btcPool.pendingReward > 0n)) {
            btcFarms.push({
              farmName:     farm.name,
              farmContract: farm.address,
              farmLink:     farmLink(farm),
              poolId:       0,
              staked:       formatTokenAmount(btcPool.staked, 8),
              pending:      formatTokenAmount(btcPool.pendingReward, 18),
              rewardToken:  farm.rewardSymbol,
            });
          }
        }
        if (btcWalletBalance > 0 || btcFarms.length > 0) {
          const primaryFarm = btcFarms[0];
          const firstFarm   = farms[0];
          positions.push({
            id:              `btc-${rawAddr}`,
            address:         rawAddr,
            type:            'farm',
            label:           'Bitcoin',
            token:           'BTC',
            amount:          btcWalletBalance,
            rewards:         primaryFarm?.pending ?? 0,
            rewardToken:     primaryFarm?.rewardToken ?? null,
            contractAddress: firstFarm?.address ?? CONTRACTS.PILL_FARM,
            hasFarmView:     btcFarms.length > 0,
            walletBalance:   btcWalletBalance,
            farms:           btcFarms.length > 0 ? btcFarms : undefined,
          });
        }

        // ── 2d. Build farmsByToken map from all farms ─────────────────────
        const farmsByToken = new Map<string, FarmInfo[]>();
        const addFarm = (contractAddr: string, info: FarmInfo | null) => {
          if (!info) return;
          const key = norm(contractAddr);
          const arr = farmsByToken.get(key) ?? [];
          arr.push(info);
          farmsByToken.set(key, arr);
        };

        for (let fi = 0; fi < farms.length; fi++) {
          const farm        = farms[fi];
          const poolResults = farmPoolResults[fi];
          const link        = farmLink(farm);

          for (const pool of poolResults) {
            if (pool.poolId === 0 || !pool.tokenContract) continue;
            addFarm(pool.tokenContract, makeFarmInfo(
              farm.name, farm.address, link,
              pool.poolId, pool.staked, pool.pendingReward,
              pool.decimals, farm.rewardSymbol,
            ));
          }
        }

        // ── 2d-2. Build lpStakedRaw from all farms ────────────────────────
        const lpStakedRaw = new Map<string, bigint>();
        for (let fi = 0; fi < farms.length; fi++) {
          const poolResults = farmPoolResults[fi];
          for (const pool of poolResults) {
            if (pool.poolId === 0 || !pool.tokenContract) continue;
            const key = norm(pool.tokenContract);
            lpStakedRaw.set(key, (lpStakedRaw.get(key) ?? 0n) + pool.staked);
          }
        }

        // ── 2e. Core/Discovery tokens already split outside loop ───────────

        // ── 2e-1. Phase 1: fetch core token balances only ──────────────────
        const coreRawBalances = await Promise.all(
          coreTokens.map(t => getTokenBalance(t.address, opnetAddr).catch(() => 0n))
        );

        // ── 2e-2. Build rawBalMap from core tokens; filter false-positive farms ──
        const rawBalMap = new Map<string, bigint>();
        for (let i = 0; i < coreTokens.length; i++) {
          rawBalMap.set(norm(coreTokens[i].address), coreRawBalances[i]);
        }
        for (const [tokenAddr, farmInfos] of farmsByToken) {
          const rawBal = rawBalMap.get(tokenAddr) ?? 0n;
          const walBal = formatTokenAmount(rawBal, 18);
          const filtered = farmInfos.filter(f => {
            if (f.pending > 0) return true;
            if (walBal > 0 && Math.abs(f.staked - walBal) < 0.0001) return false;
            return true;
          });
          if (filtered.length === 0) farmsByToken.delete(tokenAddr);
          else farmsByToken.set(tokenAddr, filtered);
        }

        // Pre-build MCHAD LP staking lookup for use in token loop below
        const MCHAD_MOTO_LP_ADDR_NORM = norm('0xb0c47bdfabfc15772dc40b4e65e4ca3c3440229a580a4a792a2f01c32d6ec944');
        const mchadLpPos2 = mchadData?.positions.find(p => p.contract === 'LP_STAKING');
        const mchadLpStakingForToken: Record<string, typeof mchadLpPos2> = {};
        if (mchadLpPos2 && (
          parseFloat(mchadLpPos2.stakedFormatted) > 0 ||
          parseFloat(mchadLpPos2.unclaimedRewardsFormatted) > 0
        )) {
          mchadLpStakingForToken[MCHAD_MOTO_LP_ADDR_NORM] = mchadLpPos2;
        }

        // ── 2f. Build core token + LP positions (Phase 1) ────────────────────
        for (let i = 0; i < coreTokens.length; i++) {
          const token     = coreTokens[i];
          const rawBal    = coreRawBalances[i];
          const walletAmt = formatTokenAmount(rawBal, token.decimals);
          const fms       = farmsByToken.get(norm(token.address)) ?? [];
          const hasFarm   = fms.length > 0;

          if (token.isPool) {
            const stakedRaw   = lpStakedRaw.get(norm(token.address)) ?? 0n;
            const hasPosition = rawBal > 0n || stakedRaw > 0n ||
              fms.some(f => f.staked > 0 || f.pending > 0);
            if (!hasPosition) continue;

            const lpLabel = token.token0Symbol && token.token1Symbol
              ? `${token.token0Symbol}/${token.token1Symbol}`
              : token.symbol;

            let lpUnderlying;
            let lpUnderlyingStaked;
            if (rawBal > 0n && token.token0Symbol && token.token1Symbol) {
              const t0Dec = (token.token0Address ? tokenDecimalsMap.get(norm(token.token0Address)) : undefined) ?? 18;
              const t1Dec = (token.token1Address ? tokenDecimalsMap.get(norm(token.token1Address)) : undefined) ?? 18;
              try { lpUnderlying = await getLPUnderlying(token.address, token.token0Symbol, t0Dec, token.token1Symbol, t1Dec, rawBal, token.token0Address ?? undefined, token.token1Address ?? undefined); } catch { /* ignore */ }
            }
            if (stakedRaw > 0n && token.token0Symbol && token.token1Symbol) {
              const t0Dec = (token.token0Address ? tokenDecimalsMap.get(norm(token.token0Address)) : undefined) ?? 18;
              const t1Dec = (token.token1Address ? tokenDecimalsMap.get(norm(token.token1Address)) : undefined) ?? 18;
              try { lpUnderlyingStaked = await getLPUnderlying(token.address, token.token0Symbol, t0Dec, token.token1Symbol, t1Dec, stakedRaw, token.token0Address ?? undefined, token.token1Address ?? undefined); } catch { /* ignore */ }
            }
            // MCHAD LP staking: staked amount is NOT in lpStakedRaw — derive lpUnderlyingStaked from mchadLpStaking
            const mchadLpEntryForUnderlying = mchadLpStakingForToken[norm(token.address)];
            if (!lpUnderlyingStaked && mchadLpEntryForUnderlying && token.token0Symbol && token.token1Symbol) {
              const stakedNum = parseFloat(mchadLpEntryForUnderlying.stakedFormatted);
              if (stakedNum > 0) {
                const t0Dec = (token.token0Address ? tokenDecimalsMap.get(norm(token.token0Address)) : undefined) ?? 18;
                const t1Dec = (token.token1Address ? tokenDecimalsMap.get(norm(token.token1Address)) : undefined) ?? 18;
                try {
                  const stakedBigInt = BigInt(Math.round(stakedNum * 1e9)) * BigInt(1_000_000_000);
                  lpUnderlyingStaked = await getLPUnderlying(
                    token.address,
                    token.token0Symbol, t0Dec,
                    token.token1Symbol, t1Dec,
                    stakedBigInt,
                    token.token0Address ?? undefined,
                    token.token1Address ?? undefined,
                  );
                } catch { /* ignore */ }
              }
            }
            const primaryFarm = fms[0];
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
              farms:           hasFarm ? fms : undefined,
              lpUnderlying,
              lpUnderlyingStaked,
              mchadLpStaking: mchadLpStakingForToken[norm(token.address)],
            });

          } else {
            const hasPosition = walletAmt > 0 || fms.some(f => f.staked > 0 || f.pending > 0);
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
              farms:           hasFarm ? fms : undefined,
            });
          }
        }
        // ── 2g. MCHAD custom staking — MCHAD_STAKING standalone card ─────
        const mchadStakingPos = mchadData?.positions.find(p => p.contract === 'MCHAD_STAKING');
        if (mchadStakingPos && (
          parseFloat(mchadStakingPos.stakedFormatted) > 0 ||
          parseFloat(mchadStakingPos.unclaimedRewardsFormatted) > 0
        )) {
          positions.push({
            id:              `mchad-stake-${rawAddr}`,
            address:         rawAddr,
            type:            'stake',
            label:           'MCHAD Staking',
            token:           'MCHAD',
            amount:          parseFloat(mchadStakingPos.stakedFormatted),
            rewards:         parseFloat(mchadStakingPos.unclaimedRewardsFormatted),
            rewardToken:     'MCHAD',
            contractAddress: CONTRACTS.MCHAD_TOKEN,
            mchadStaking: {
              positions:    [mchadStakingPos],
              mchadBal:     mchadData!.balances.mchadFormatted,
              mchadMotoBal: mchadData!.balances.mchadMotoLpFormatted,
              mchadPillBal: mchadData!.balances.mchadPillLpFormatted,
            },
          });
        }

        // ── Queue discovery tokens for Phase 2 ─────────────────────────────
        for (const dt of discoveryTokens) {
          discoveryTokensByAddr.push({ rawAddr, opnetAddr, token: dt });
        }

      } catch {
        // continue with next address silently
      }
    }

    // ── Phase 1 complete: push core positions (discovery tokens will be added by Phase 2) ──
    setAllPositions(positions);
    setLoading(false);
    fetchingRef.current = false;

    // ── Phase 2: discovery scan — batch-fetch non-core tokens ──────────────
    for (let batchStart = 0; batchStart < discoveryTokensByAddr.length; batchStart += DISCOVERY_BATCH_SIZE) {
      if (phase2IdRef.current !== currentPhase2Id) break; // abort stale scan

      const batch = discoveryTokensByAddr.slice(batchStart, batchStart + DISCOVERY_BATCH_SIZE);
      const balResults = await Promise.all(
        batch.map(entry => getTokenBalance(entry.token.address, entry.opnetAddr).catch(() => 0n))
      );

      const newPositions: Position[] = [];
      for (let i = 0; i < batch.length; i++) {
        const entry   = batch[i];
        const token   = entry.token;
        const rawBal  = balResults[i];
        const walletAmt = formatTokenAmount(rawBal, token.decimals);

        let hasPosition = walletAmt > 0;

        if (token.isPool) {
          const stakedRaw = 0n; // discovery tokens have no farm entries
          if (stakedRaw > 0n) hasPosition = true;
          // Only call getLPUnderlying if balance is significant (skip dust)
          let lpUnderlying;
          if (rawBal > 10n && token.token0Symbol && token.token1Symbol) {
            const t0Dec = (token.token0Address ? tokenDecimalsMap.get(norm(token.token0Address)) : undefined) ?? 18;
            const t1Dec = (token.token1Address ? tokenDecimalsMap.get(norm(token.token1Address)) : undefined) ?? 18;
            try { lpUnderlying = await getLPUnderlying(token.address, token.token0Symbol, t0Dec, token.token1Symbol, t1Dec, rawBal, token.token0Address ?? undefined, token.token1Address ?? undefined); } catch { /* ignore */ }
          }
          if (hasPosition) {
            const lpLabel = token.token0Symbol && token.token1Symbol
              ? `${token.token0Symbol}/${token.token1Symbol}`
              : token.symbol;
            newPositions.push({
              id:              `lp-${token.address}-${entry.rawAddr}`,
              address:         entry.rawAddr,
              type:            'lp',
              label:           `LP ${lpLabel}`,
              token:           lpLabel,
              amount:          walletAmt,
              rewards:         0,
              rewardToken:     null,
              contractAddress: token.address,
              hasFarmView:     false,
              walletBalance:   walletAmt,
              farms:           undefined,
              lpUnderlying,
            });
          }
        } else {
          if (hasPosition) {
            newPositions.push({
              id:              `token-${token.address}-${entry.rawAddr}`,
              address:         entry.rawAddr,
              type:            'farm',
              label:           token.symbol,
              token:           token.symbol,
              amount:          walletAmt,
              rewards:         0,
              rewardToken:     null,
              contractAddress: token.address,
              hasFarmView:     false,
              walletBalance:   walletAmt,
              farms:           undefined,
            });
          }
        }
      }

      // Merge discovery positions into live state — fresh data replaces stale by ID
      if (newPositions.length > 0 && phase2IdRef.current === currentPhase2Id) {
        const existing = useAppStore.getState().allPositions;
        const merged = new Map<string, Position>();
        for (const p of existing) merged.set(p.id, p);
        for (const p of newPositions) merged.set(p.id, p); // fresh overwrites stale
        setAllPositions([...merged.values()]);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addresses.join(',')]);
  const lastBlockRef = useRef<number>(0);

  useEffect(() => {
    if (!addresses.length) return;
    const blockHeight = latestBlock?.height ?? 0;
    const isNewBlock = blockHeight > 0 && blockHeight > lastBlockRef.current;
    const isEmpty = allPositions.length === 0;
    if (isEmpty || isNewBlock) {
      lastBlockRef.current = blockHeight;
      fetchAll(!isEmpty);
    }
  }, [addresses.join(','), latestBlock?.height]);

  useEffect(() => {
    if (!addresses.length) return;
    const interval = setInterval(() => fetchAll(true), FALLBACK_TTL_MS);
    return () => clearInterval(interval);
  }, [addresses.join(',')]);

  // Manual refresh — clears all caches to re-fetch from server
  const refresh = useCallback(async () => {
    tokenListRef.current  = null;
    farmListRef.current   = null;
    addrLookupRef.current = null;
    setRefreshing(true);
    await fetchAll(allPositions.length > 0);
    setRefreshing(false);
  }, [fetchAll, allPositions.length]);

  return { positions: allPositions, loading, refreshing, error, refresh };
}
