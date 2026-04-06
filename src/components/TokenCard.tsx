import { useEffect } from 'react';
import { useWalletConnect } from '@btc-vision/walletconnect';
import { TokenConfig } from '../config/tokens';
import { useTokenInfo } from '../hooks/useTokenInfo';
import { useMintToken } from '../hooks/useMintToken';

interface Props {
  token: TokenConfig;
}

function formatAmount(raw: bigint, decimals: number): string {
  const divisor = 10n ** BigInt(decimals);
  const whole = raw / divisor;
  const frac = raw % divisor;
  return `${whole.toLocaleString()}.${frac.toString().padStart(decimals, '0').slice(0, 2)}`;
}

export function TokenCard({ token }: Props) {
  const { walletAddress } = useWalletConnect();
  const { info, loading, fetch } = useTokenInfo(token);
  const { mint, status, error, result, reset } = useMintToken(token);
  const c = token.colorClasses;

  useEffect(() => {
    fetch();
  }, [fetch]);

  useEffect(() => {
    if (status === 'success') {
      const t = setTimeout(() => fetch(), 3000);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [status, fetch]);

  const isConnected = !!walletAddress;
  const isBusy = status === 'simulating' || status === 'signing';
  const progress = info?.progress ?? 0;

  return (
    <div className="glass rounded-2xl p-6 space-y-4 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${c.gradient} flex items-center justify-center text-2xl shadow-lg`}>
            {token.icon}
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">{info?.name ?? token.name}</h2>
            <p className="text-sm text-gray-400">{info?.symbol ?? token.symbol} · OP_NET</p>
          </div>
        </div>
        <button
          onClick={fetch}
          disabled={loading}
          className="p-2 rounded-xl text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors"
          title="Refresh"
        >
          <span className={loading ? 'animate-spin inline-block' : ''}>🔄</span>
        </button>
      </div>

      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-gray-400">
          <span>Minted</span>
          <span className={`font-semibold ${c.text}`}>{progress < 1 ? progress.toFixed(4) : progress.toFixed(2)}%</span>
        </div>
        <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${c.bar}`}
            style={{ width: progress > 0 ? `${Math.max(progress, 4)}%` : "0%" }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-500">
          <span>
            Supply:{' '}
            <span className={c.text}>
              {info ? formatAmount(info.totalSupply, info.decimals) : '—'}
            </span>
          </span>
          <span>
            Max:{' '}
            <span className="text-gray-400">
              {info ? formatAmount(info.maxSupply, info.decimals) : '—'}
            </span>
          </span>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white/5 rounded-xl p-3">
          <p className="text-xs text-gray-500 mb-1">Per Mint</p>
          <p className={`text-sm font-mono ${c.text} truncate`}>
            {formatAmount(token.mintPerCall, token.decimals)}
          </p>
        </div>
        <div className="bg-white/5 rounded-xl p-3">
          <p className="text-xs text-gray-500 mb-1">Your Balance</p>
          <p className="text-sm font-mono text-yellow-400 truncate">
            {info && isConnected ? formatAmount(info.balance, info.decimals) : '—'}
          </p>
        </div>
      </div>

      {/* Contract address */}
      <div className="bg-white/5 rounded-xl p-3">
        <p className="text-xs text-gray-500 mb-1">Contract</p>
        <a
          href={`https://mainnet.opnet.org/contract/${encodeURIComponent(token.address)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-mono text-gray-400 break-all hover:text-gray-200 transition-colors"
        >
          {token.address}
        </a>
      </div>

      {/* Status messages */}
      {status === 'success' && result && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-green-400 font-semibold">
            <span>✅</span> Minted Successfully!
          </div>
          <p className="text-xs text-gray-400">Transaction ID:</p>
          <a
            href={`https://mempool.space/tx/${result.txId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-mono text-blue-400 hover:text-blue-300 underline break-all"
          >
            {result.txId}
          </a>
          <p className="text-xs text-gray-500">Fees: {result.fees.toString()} sats</p>
          <button onClick={reset} className="text-xs text-green-400 hover:text-green-300 underline">
            Mint again
          </button>
        </div>
      )}

      {status === 'error' && error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-red-400 font-semibold">
            <span>❌</span> Mint Failed
          </div>
          <p className="text-xs text-gray-400 break-words">{error}</p>
          <button onClick={reset} className="text-xs text-red-400 hover:text-red-300 underline">
            Try again
          </button>
        </div>
      )}

      {/* Mint button — pushed to bottom */}
      <div className="mt-auto pt-2">
        {status !== 'success' && status !== 'error' && (
          <button
            onClick={isConnected ? mint : undefined}
            disabled={!isConnected || isBusy}
            className={[
              'w-full py-4 rounded-xl font-bold text-base transition-all',
              isConnected && !isBusy
                ? `bg-gradient-to-r ${c.gradient} hover:opacity-90 text-white hover:scale-[1.02] active:scale-[0.98] ${c.glow} shadow-lg`
                : 'bg-gray-700 text-gray-500 cursor-not-allowed',
            ].join(' ')}
          >
            {!isConnected && '🔗 Connect Wallet to Mint'}
            {isConnected && status === 'idle' && `${token.icon} Mint ${token.name}`}
            {status === 'simulating' && (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin">⚙️</span> Simulating…
              </span>
            )}
            {status === 'signing' && (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-pulse">🖊️</span> Sign in Wallet…
              </span>
            )}
          </button>
        )}
        {!isConnected && (
          <p className="text-center text-xs text-gray-500 mt-2">
            Requires OP_WALLET browser extension
          </p>
        )}
      </div>
    </div>
  );
}
