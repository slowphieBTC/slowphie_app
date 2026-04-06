import { useState, useCallback } from 'react';
import { useWalletConnect } from '@btc-vision/walletconnect';
import { getContract } from 'opnet';
import type { BaseContractProperties, CallResult } from 'opnet';
import { Address } from '@btc-vision/transaction';
import { TokenConfig } from '../config/tokens';

interface ITokenRead extends BaseContractProperties {
  name(): Promise<CallResult<{ name: string }>>;
  symbol(): Promise<CallResult<{ symbol: string }>>;
  decimals(): Promise<CallResult<{ decimals: number }>>;
  totalSupply(): Promise<CallResult<{ totalSupply: bigint }>>;
  maximumSupply(): Promise<CallResult<{ maximumSupply: bigint }>>;
  balanceOf(account: Address): Promise<CallResult<{ balance: bigint }>>;
}

export interface TokenInfo {
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: bigint;
  maxSupply: bigint;
  balance: bigint;
  progress: number;
}

export function useTokenInfo(token: TokenConfig) {
  const { address, provider, network } = useWalletConnect();
  const [info, setInfo] = useState<TokenInfo | null>(null);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!provider || !network) return;
    setLoading(true);
    try {
      const contract = getContract<ITokenRead>(
        token.address,
        token.abi,
        provider,
        network,
        address ?? undefined,
      ) as ITokenRead;

      const [nameR, symbolR, decimalsR, supplyR, maxR] = await Promise.all([
        contract.name(),
        contract.symbol(),
        contract.decimals(),
        contract.totalSupply(),
        contract.maximumSupply().catch(() => ({ properties: { maximumSupply: token.maxSupply } })),
      ]);

      let balance = 0n;
      if (address) {
        const balR = await contract.balanceOf(address).catch(() => ({ properties: { balance: 0n } }));
        balance = balR.properties?.balance ?? 0n;
      }

      const totalSupply = supplyR.properties?.totalSupply ?? 0n;
      const maxSupply = maxR.properties?.maximumSupply ?? token.maxSupply;

      // Use high precision: multiply by 10_000_000n to get 5 decimal places in percent
      const progress = maxSupply > 0n
        ? Math.min(100, Number((totalSupply * 10_000_000n) / maxSupply) / 100_000)
        : 0;

      setInfo({
        name: nameR.properties?.name ?? token.name,
        symbol: symbolR.properties?.symbol ?? token.symbol,
        decimals: decimalsR.properties?.decimals ?? token.decimals,
        totalSupply,
        maxSupply,
        balance,
        progress,
      });
    } catch {
      // keep previous info on error
    } finally {
      setLoading(false);
    }
  }, [provider, network, address, token]);

  return { info, loading, fetch };
}
