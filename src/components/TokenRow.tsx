import { useEffect } from 'react';
import { useWalletConnect } from '@btc-vision/walletconnect';
import { useTranslation } from 'react-i18next';
import { TokenConfig } from '../config/tokens';
import { useTokenInfo, TokenInfo } from '../hooks/useTokenInfo';
import { useMintToken } from '../hooks/useMintToken';

type SortField = 'date' | 'mintsLeft';

interface Props {
  token: TokenConfig;
  sortField: SortField;
  mintsLeft: bigint | null;
  onInfoLoaded?: (tokenId: string, info: TokenInfo) => void;
}

function formatAmount(raw: bigint, decimals: number): string {
  const divisor = 10n ** BigInt(decimals);
  const whole = raw / divisor;
  const frac = raw % divisor;
  return `${whole.toLocaleString()}.${frac.toString().padStart(decimals, '0').slice(0, 2)}`;
}

export function TokenRow({ token, sortField, mintsLeft, onInfoLoaded }: Props) {
  const { walletAddress } = useWalletConnect();
  const { info, loading, fetch } = useTokenInfo(token);
  const { mint, status, error, result, reset } = useMintToken(token);
  const { t } = useTranslation();
  const c = token.colorClasses;

  useEffect(() => { fetch(); }, [fetch]);
  useEffect(() => { if (info && onInfoLoaded) onInfoLoaded(token.id, info); }, [info, onInfoLoaded, token.id]);
  useEffect(() => {
    if (status === 'success') { const ti = setTimeout(() => fetch(), 3000); return () => clearTimeout(ti); }
    return undefined;
  }, [status, fetch]);

  const isConnected = !!walletAddress;
  const isBusy = status === 'simulating' || status === 'signing';
  const progress = info?.progress ?? 0;

  return (
    <tr className={`border-b border-white/5 hover:bg-white/[0.02] transition-colors`}>
      {/* Icon + Name */}
      <td className="py-3 px-4">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${c.gradient} flex items-center justify-center text-lg shadow-md flex-shrink-0`}>{token.icon}</div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{info?.name ?? token.name}</p>
            <p className="text-xs text-gray-400">{info?.symbol ?? token.symbol}</p>
          </div>
        </div>
      </td>

      {/* Sort context column */}
      {sortField === 'date' && (
        <td className="py-3 px-4 text-xs text-gray-500 whitespace-nowrap">
          {new Date(token.deployedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
        </td>
      )}
      {sortField === 'mintsLeft' && (
        <td className="py-3 px-4 text-xs font-mono whitespace-nowrap">
          {mintsLeft !== null ? <span className={c.text}>{mintsLeft.toLocaleString()}</span> : <span className="text-gray-600">—</span>}
        </td>
      )}

      {/* Progress */}
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          <div className="w-20 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-700 ${c.bar}`} style={{ width: progress > 0 ? `${Math.max(progress, 4)}%` : '0%' }} />
          </div>
          <span className={`text-xs font-mono ${c.text}`}>{progress < 1 ? progress.toFixed(4) : progress.toFixed(2)}%</span>
        </div>
      </td>

      {/* Per Mint */}
      <td className="py-3 px-4 text-xs font-mono text-gray-400 hidden md:table-cell">
        {formatAmount(token.mintPerCall, token.decimals)}
      </td>

      {/* Balance */}
      <td className="py-3 px-4 text-xs font-mono text-yellow-400 hidden lg:table-cell">
        {info && isConnected ? formatAmount(info.balance, info.decimals) : '—'}
      </td>

      {/* Mint Button */}
      <td className="py-3 px-4 text-right">
        {status === 'success' && result ? (
          <a href={`https://mempool.space/tx/${result.txId}`} target="_blank" rel="noopener noreferrer"
            className="text-xs text-green-400 hover:text-green-300">✅ Tx</a>
        ) : status === 'error' && error ? (
          <button onClick={reset} className="text-xs text-red-400 hover:text-red-300">{t('minter.tryAgain')}</button>
        ) : (
          <button
            onClick={isConnected ? mint : undefined}
            disabled={!isConnected || isBusy}
            className={[
              'px-4 py-1.5 rounded-lg text-xs font-bold transition-all',
              isConnected && !isBusy
                ? `bg-gradient-to-r ${c.gradient} text-white hover:opacity-90 ${c.glow}`
                : 'bg-gray-700 text-gray-500 cursor-not-allowed',
            ].join(' ')}
          >
            {!isConnected ? t('minter.connectToMint').replace('🔗 ', '')
              : isBusy ? (status === 'simulating' ? '⚙️' : '🖊️')
              : t('minter.mintToken', { icon: '', name: '' }).trim() || 'Mint'}
          </button>
        )}
      </td>
    </tr>
  );
}
