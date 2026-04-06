import { Address } from '@btc-vision/transaction';
import { useState, useCallback, useRef } from 'react';
import { useWalletConnect } from '@btc-vision/walletconnect';
import { getContract } from 'opnet';
import type { BaseContractProperties } from 'opnet';
import { TokenConfig } from '../config/tokens';

export type MintStatus = 'idle' | 'simulating' | 'signing' | 'success' | 'error';

type DynamicContract = BaseContractProperties & Record<string, (...args: (bigint | Address)[]) => Promise<any>>;

export interface MintResult {
  txId: string;
  fees: bigint;
}

/** Platform fee: 1000 sats charged on every mint */
const PLATFORM_FEE_SATS = 1000;
const PLATFORM_FEE_ADDRESS = 'bc1pgqxdtkscyq89jnh44p9e9gkqd34yq5qhxckcjvac27zv0v2yre3qj924qg';

export function useMintToken(token: TokenConfig) {
  const { provider, address, walletAddress, network } = useWalletConnect();
  const [status, setStatus] = useState<MintStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MintResult | null>(null);
  const contractRef = useRef<DynamicContract | null>(null);

  const getContractInstance = useCallback((): DynamicContract | null => {
    if (!provider || !network) return null;
    if (!contractRef.current) {
      contractRef.current = getContract<DynamicContract>(
        token.address,
        token.abi,
        provider,
        network,
        address ?? undefined,
      ) as DynamicContract;
    }
    return contractRef.current;
  }, [provider, network, address, token]);

  const mint = useCallback(async () => {
    if (!walletAddress || !address || !provider || !network) {
      setError('Please connect your wallet first.');
      return;
    }

    setError(null);
    setResult(null);

    try {
      const contract = getContractInstance();
      if (!contract) throw new Error('Failed to initialise contract.');

      const fn = contract[token.mintFunctionName];
      if (typeof fn !== 'function') throw new Error(`Function ${token.mintFunctionName} not found on contract.`);

      const resolvedArgs = token.mintArgsFactory
        ? token.mintArgsFactory(address)
        : token.mintArgs;

      setStatus('simulating');
      const sim = await fn.call(contract, ...resolvedArgs);
      if (sim.revert) throw new Error(`Simulation reverted: ${sim.revert}`);

      setStatus('signing');
      const receipt = await sim.sendTransaction({
        signer: null,
        mldsaSigner: null,
        refundTo: walletAddress,
        maximumAllowedSatToSpend: 60_000n,
        feeRate: 0,
        network,
        // ── Platform fee: 1000 sats per mint ────────────────────────
        extraOutputs: [
          { address: PLATFORM_FEE_ADDRESS, value: PLATFORM_FEE_SATS },
        ],
      });

      setResult({
        txId: (receipt as any).txid ?? (receipt as any).transactionId ?? '',
        fees: (receipt as any).fees ?? (receipt as any).estimatedFees ?? 0n,
      });
      setStatus('success');
      contractRef.current = null;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus('error');
    }
  }, [walletAddress, address, provider, network, getContractInstance, token]);

  const reset = useCallback(() => {
    setStatus('idle');
    setError(null);
    setResult(null);
  }, []);

  return { mint, status, error, result, reset };
}
