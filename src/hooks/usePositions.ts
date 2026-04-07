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
import { useAppStore } from '../store';
import type { Position, FarmInfo } from '../types';

const PILL_FARM_ADDR = '0x3fb33dc12672aba975babfa8c0b400a3c86461d364861a7de50d20672cb1b80f';
const SAT_FARM_ADDR  = '0x22b1217f899b93db082d0634c167a744809d02b2a9ac46cd965706380350e0b1';
const SWAP_FARM_ADDR = '0x96a7f30400afc8b56650c81b06634c1e7901917e45f16e3c03e6b3b658ce72f9';

/** Cache TTL: 30 seconds */
const CACHE_TTL_MS = 30_000;

function makeFarmInfo(
  farmName: string,
  farmContract: string,
  farmLink: string,
  poolId: number,
  staked: bigint,
  pending: bigint,
  decimals: number,
  rewardToken: string,
): FarmInfo | null {
  const stakedAmt  = formatTokenAmount(staked, decimals);
  const pendingAmt = formatTokenAmount(pending, 18);
  if (stakedAmt === 0 && pendingAmt === 0) return null;
  return { farmName, farmContract, farmLink, poolId, staked: stakedAmt, pending: pendingAmt, rewardToken };
}

export function usePositions(addresses: string[]) {
  const allPositions        = useAppStore((s) => s.allPositions);
  const positionsLastFetched = useAppStore((s) => s.positionsLastFetched);
  const setAllPositions     = useAppStore((s) => s.setAllPositions);

  // loading = true only when no cached data yet
  const [loading, setLoading]       = useState(
    () => allPositions.length === 0 && addresses.length > 0
  );
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const fetchingRef                  = useRef(false);

  const fetchAll = useCallback(async (silent = false) => {
    if (!addresses.length) { setAllPositions([]); return; }
    if (fetchingRef.current) return; // prevent concurrent fetches
    fetchingRef.current = true;

    if (!silent) setLoading(true);
    setError(null);
    const all: Position[] = [];

    for (const rawAddr of addresses) {
      try {
        const opnetAddr = await resolveToOpnetAddress(rawAddr);

        const [
          staking,
          pillFarmPools,
          satFarmPools,
          swapFarmPools,
          pillWallet,
          motoWallet,
          satWallet,
          swapWallet,
          lpSwMotoWallet,
        ] = await Promise.all([
          getStakingInfo(opnetAddr),
          getAllFarmPositions(opnetAddr),
          getAllSatFarmPositions(opnetAddr),
          getAllSwapFarmPositions(opnetAddr),
          getTokenBalance(CONTRACTS.PILL_TOKEN, opnetAddr),
          getTokenBalance(CONTRACTS.MOTO_TOKEN, opnetAddr),
          getTokenBalance(CONTRACTS.SAT_TOKEN, opnetAddr),
          getTokenBalance(CONTRACTS.SWAP_TOKEN, opnetAddr),
          getTokenBalance(CONTRACTS.LP_SWMOTO, opnetAddr),
        ]);

        const SWAP_LINK = `https://motoswap.org/farm/${SWAP_FARM_ADDR}`;
        const SAT_LINK  = `https://motoswap.org/farm/${SAT_FARM_ADDR}`;
        const PILL_LINK = 'https://motoswap.org/farm/pill';

        const hasStakingRewards = staking.rewardTokens.some(rt => rt.pending > 0n);
        if (staking.stakedMoto > 0n || hasStakingRewards) {
          const stakingRewards = staking.rewardTokens.map(rt => ({
            tokenAddress: rt.address,
            symbol:       rt.symbol,
            pending:      formatTokenAmount(rt.pending, 18),
          }));
          const primaryReward = stakingRewards.find(r => r.pending > 0) ?? stakingRewards[0];
          all.push({
            id: `stake-${rawAddr}`, address: rawAddr, type: 'stake',
            label: 'MotoSwap Stake', token: 'MOTO',
            amount: formatTokenAmount(staking.stakedMoto, 18),
            rewards: primaryReward?.pending ?? 0,
            rewardToken: primaryReward?.symbol ?? null,
            contractAddress: CONTRACTS.STAKING, stakingRewards,
          });
        }

        const pillFarmBtc = pillFarmPools.find(f => f.poolId === 0);
        if (pillFarmBtc && (pillFarmBtc.staked > 0n || pillFarmBtc.pendingReward > 0n)) {
          all.push({ id: `pillfarm-0-${rawAddr}`, address: rawAddr, type: 'farm',
            label: 'BTC Farm · PILL Farm', token: 'BTC',
            amount: formatTokenAmount(pillFarmBtc.staked, 8),
            rewards: formatTokenAmount(pillFarmBtc.pendingReward, 18),
            rewardToken: 'PILL', contractAddress: PILL_FARM_ADDR, poolId: 0,
          });
        }

        const pillFarmLp = pillFarmPools.find(f => f.poolId === 2);
        if (pillFarmLp && (pillFarmLp.staked > 0n || pillFarmLp.pendingReward > 0n)) {
          const motoPillUnderlying = await getLPUnderlying(CONTRACTS.MOTO_PILL_LP, 'MOTO', 18, 'PILL', 18, pillFarmLp.staked);
          all.push({ id: `pillfarm-2-${rawAddr}`, address: rawAddr, type: 'lp',
            label: 'MOTO/PILL LP Farm', token: 'MOTO-PILL',
            amount: formatTokenAmount(pillFarmLp.staked, 18),
            rewards: formatTokenAmount(pillFarmLp.pendingReward, 18),
            rewardToken: 'PILL', contractAddress: PILL_FARM_ADDR, poolId: 2, lpUnderlying: motoPillUnderlying,
          });
        }

        const satFarmBtc = satFarmPools.find(f => f.poolId === 0);
        if (satFarmBtc && (satFarmBtc.staked > 0n || satFarmBtc.pendingReward > 0n)) {
          all.push({ id: `satfarm-0-${rawAddr}`, address: rawAddr, type: 'farm',
            label: "Satoshi's Farm · BTC", token: 'BTC',
            amount: formatTokenAmount(satFarmBtc.staked, 8),
            rewards: formatTokenAmount(satFarmBtc.pendingReward, 18),
            rewardToken: 'SAT', contractAddress: SAT_FARM_ADDR, poolId: 0,
          });
        }

        const swapFarmBtc = swapFarmPools.find(f => f.poolId === 0);
        if (swapFarmBtc && (swapFarmBtc.staked > 0n || swapFarmBtc.pendingReward > 0n)) {
          all.push({ id: `swapfarm-0-${rawAddr}`, address: rawAddr, type: 'farm',
            label: 'SWAP Farm · BTC', token: 'BTC',
            amount: formatTokenAmount(swapFarmBtc.staked, 8),
            rewards: formatTokenAmount(swapFarmBtc.pendingReward, 18),
            rewardToken: 'SWAP', contractAddress: SWAP_FARM_ADDR, poolId: 0,
          });
        }

        const pillPF = pillFarmPools.find(f => f.poolId === 1);
        const pillSF = satFarmPools.find(f => f.poolId === 3);
        const pillWF = swapFarmPools.find(f => f.poolId === 3);
        const pillWalletAmt = formatTokenAmount(pillWallet, 18);
        const pillFarms: FarmInfo[] = [
          makeFarmInfo('PILL Farm', PILL_FARM_ADDR, PILL_LINK, 1, pillPF?.staked ?? 0n, pillPF?.pendingReward ?? 0n, 18, 'PILL'),
          makeFarmInfo("Satoshi's Farm", SAT_FARM_ADDR, SAT_LINK, 3, pillSF?.staked ?? 0n, pillSF?.pendingReward ?? 0n, 18, 'SAT'),
          makeFarmInfo('SWAP Farm', SWAP_FARM_ADDR, SWAP_LINK, 3, pillWF?.staked ?? 0n, pillWF?.pendingReward ?? 0n, 18, 'SWAP'),
        ].filter((f): f is FarmInfo => f !== null);
        if (pillWalletAmt > 0 || pillFarms.length > 0) {
          all.push({ id: `pill-${rawAddr}`, address: rawAddr, type: 'farm', label: 'PILL', token: 'PILL',
            amount: pillWalletAmt, rewards: 0, rewardToken: null, contractAddress: CONTRACTS.PILL_TOKEN,
            hasFarmView: true, walletBalance: pillWalletAmt, farms: pillFarms,
          });
        }

        const motoPF = pillFarmPools.find(f => f.poolId === 3);
        const motoSF = satFarmPools.find(f => f.poolId === 2);
        const motoWF = swapFarmPools.find(f => f.poolId === 2);
        const motoWalletAmt = formatTokenAmount(motoWallet, 18);
        const motoFarms: FarmInfo[] = [
          makeFarmInfo('PILL Farm', PILL_FARM_ADDR, PILL_LINK, 3, motoPF?.staked ?? 0n, motoPF?.pendingReward ?? 0n, 18, 'PILL'),
          makeFarmInfo("Satoshi's Farm", SAT_FARM_ADDR, SAT_LINK, 2, motoSF?.staked ?? 0n, motoSF?.pendingReward ?? 0n, 18, 'SAT'),
          makeFarmInfo('SWAP Farm', SWAP_FARM_ADDR, SWAP_LINK, 2, motoWF?.staked ?? 0n, motoWF?.pendingReward ?? 0n, 18, 'SWAP'),
        ].filter((f): f is FarmInfo => f !== null);
        if (motoWalletAmt > 0 || motoFarms.length > 0) {
          all.push({ id: `moto-${rawAddr}`, address: rawAddr, type: 'farm', label: 'MOTO', token: 'MOTO',
            amount: motoWalletAmt, rewards: 0, rewardToken: null, contractAddress: CONTRACTS.MOTO_TOKEN,
            hasFarmView: true, walletBalance: motoWalletAmt, farms: motoFarms,
          });
        }

        const satSF = satFarmPools.find(f => f.poolId === 1);
        const satWalletAmt = formatTokenAmount(satWallet, 18);
        const satFarms: FarmInfo[] = [
          makeFarmInfo("Satoshi's Farm", SAT_FARM_ADDR, SAT_LINK, 1, satSF?.staked ?? 0n, satSF?.pendingReward ?? 0n, 18, 'SAT'),
        ].filter((f): f is FarmInfo => f !== null);
        if (satWalletAmt > 0 || satFarms.length > 0) {
          all.push({ id: `sat-${rawAddr}`, address: rawAddr, type: 'farm', label: 'SAT', token: 'SAT',
            amount: satWalletAmt, rewards: 0, rewardToken: null, contractAddress: CONTRACTS.SAT_TOKEN,
            hasFarmView: true, walletBalance: satWalletAmt, farms: satFarms,
          });
        }

        const swapSF = swapFarmPools.find(f => f.poolId === 1);
        const swapWalletAmt = formatTokenAmount(swapWallet, 18);
        const swapFarms: FarmInfo[] = [
          makeFarmInfo('SWAP Farm', SWAP_FARM_ADDR, SWAP_LINK, 1, swapSF?.staked ?? 0n, swapSF?.pendingReward ?? 0n, 18, 'SWAP'),
        ].filter((f): f is FarmInfo => f !== null);
        if (swapWalletAmt > 0 || swapFarms.length > 0) {
          all.push({ id: `swap-${rawAddr}`, address: rawAddr, type: 'farm', label: 'SWAP', token: 'SWAP',
            amount: swapWalletAmt, rewards: 0, rewardToken: null, contractAddress: CONTRACTS.SWAP_TOKEN,
            hasFarmView: true, walletBalance: swapWalletAmt, farms: swapFarms,
          });
        }

        const lpSF = swapFarmPools.find(f => f.poolId === 4);
        const lpWalletAmt = formatTokenAmount(lpSwMotoWallet, 18);
        const lpFarms: FarmInfo[] = [
          makeFarmInfo('SWAP Farm', SWAP_FARM_ADDR, SWAP_LINK, 4, lpSF?.staked ?? 0n, lpSF?.pendingReward ?? 0n, 18, 'SWAP'),
        ].filter((f): f is FarmInfo => f !== null);
        if (lpWalletAmt > 0 || lpFarms.length > 0) {
          const lpSwMotoBalance = lpSF && lpSF.staked > 0n ? lpSF.staked : lpSwMotoWallet;
          const swMotoUnderlying = await getLPUnderlying(CONTRACTS.LP_SWMOTO, 'SWAP', 18, 'MOTO', 18, lpSwMotoBalance);
          all.push({ id: `lpswmoto-${rawAddr}`, address: rawAddr, type: 'lp', label: 'LP SWAP/MOTO', token: 'LP SWAP/MOTO',
            amount: lpWalletAmt, rewards: 0, rewardToken: null, contractAddress: CONTRACTS.LP_SWMOTO,
            hasFarmView: true, walletBalance: lpWalletAmt, farms: lpFarms, lpUnderlying: swMotoUnderlying,
          });
        }

      } catch {
        // continue next address
      }
    }

    setAllPositions(all);
    setLoading(false);
    fetchingRef.current = false;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addresses.join(',')]);

  useEffect(() => {
    if (!addresses.length) return;

    const now = Date.now();
    const isStale = now - positionsLastFetched > CACHE_TTL_MS;
    const isEmpty = allPositions.length === 0;

    // Fetch immediately if cache is empty or stale
    if (isEmpty || isStale) {
      fetchAll(/* silent= */ !isEmpty);
    }

    // Poll every 30s in background (silent — won't show loading)
    const interval = setInterval(() => fetchAll(true), CACHE_TTL_MS);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addresses.join(',')]);

  // Manual refresh (shows loading only if cache is empty)
  // Manual refresh — always shows spin via refreshing state
  const refresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAll(allPositions.length > 0);
    setRefreshing(false);
  }, [fetchAll, allPositions.length]);

  return { positions: allPositions, loading, refreshing, error, refresh };
}
