import { useEffect } from 'react';
import { useWalletConnect } from '@btc-vision/walletconnect';
import { useTranslation } from 'react-i18next';
import { TokenConfig } from '../config/tokens';
import { useTokenInfo, TokenInfo } from '../hooks/useTokenInfo';
import { useMintToken } from '../hooks/useMintToken';

interface Props {
  token: TokenConfig;
  onInfoLoaded?: (tokenId: string, info: TokenInfo) => void;
}

function formatAmount(raw: bigint, decimals: number): string {
  const divisor = 10n ** BigInt(decimals);
  const whole = raw / divisor;
  const frac = raw % divisor;
  return `${whole.toLocaleString()}.${frac.toString().padStart(decimals, '0').slice(0, 2)}`;
}

export function TokenCard({ token, onInfoLoaded }: Props) {
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
    <div className="glass rounded-2xl p-6 space-y-4 flex flex-col">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${c.gradient} flex items-center justify-center text-2xl shadow-lg`}>{token.icon}</div>
          <div>
            <h2 className="text-xl font-bold text-white">{info?.name ?? token.name}</h2>
            <p className="text-sm text-gray-400">{info?.symbol ?? token.symbol} \u00b7 OP_NET</p>
          </div>
        </div>
        <button onClick={fetch} disabled={loading} className="p-2 rounded-xl text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors" title={t('common.refresh')}>
          <span className={loading ? 'animate-spin inline-block' : ''}>🔄</span>
        </button>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-xs text-gray-400">
          <span>{t('minter.minted')}</span>
          <span className={`font-semibold ${c.text}`}>{progress < 1 ? progress.toFixed(4) : progress.toFixed(2)}%</span>
        </div>
        <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-700 ${c.bar}`} style={{ width: progress > 0 ? `${Math.max(progress, 4)}%` : '0%' }} />
        </div>
        <div className="flex justify-between text-xs text-gray-500">
          <span>{t('minter.supply')}{' '}<span className={c.text}>{info ? formatAmount(info.totalSupply, info.decimals) : '\u2014'}</span></span>
          <span>{t('minter.max')}{' '}<span className="text-gray-400">{info ? formatAmount(info.maxSupply, info.decimals) : '\u2014'}</span></span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white/5 rounded-xl p-3">
          <p className="text-xs text-gray-500 mb-1">{t('minter.perMint')}</p>
          <p className={`text-sm font-mono ${c.text} truncate`}>{formatAmount(token.mintPerCall, token.decimals)}</p>
        </div>
        <div className="bg-white/5 rounded-xl p-3">
          <p className="text-xs text-gray-500 mb-1">{t('minter.yourBalance')}</p>
          <p className="text-sm font-mono text-yellow-400 truncate">{info && isConnected ? formatAmount(info.balance, info.decimals) : '\u2014'}</p>
        </div>
      </div>

      <div className="bg-white/5 rounded-xl p-3">
        <p className="text-xs text-gray-500 mb-1">{t('minter.contract')}</p>
        <a href={`https://mainnet.opnet.org/contract/${encodeURIComponent(token.address)}`} target="_blank" rel="noopener noreferrer"
          className="text-xs font-mono text-gray-400 break-all hover:text-gray-200 transition-colors">{token.address}</a>
      </div>

      {status === 'success' && result && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-green-400 font-semibold"><span>\u2705</span> {t('minter.mintedSuccess')}</div>
          <p className="text-xs text-gray-400">{t('minter.transactionId')}</p>
          <a href={`https://mempool.space/tx/${result.txId}`} target="_blank" rel="noopener noreferrer"
            className="text-xs font-mono text-blue-400 hover:text-blue-300 underline break-all">{result.txId}</a>
          <p className="text-xs text-gray-500">{t('minter.fees', { fees: result.fees.toString() })}</p>
          <button onClick={reset} className="text-xs text-green-400 hover:text-green-300 underline">{t('minter.mintAgain')}</button>
        </div>
      )}

      {status === 'error' && error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-red-400 font-semibold"><span>\u274C</span> {t('minter.mintFailed')}</div>
          <p className="text-xs text-gray-400 break-words">{error}</p>
          <button onClick={reset} className="text-xs text-red-400 hover:text-red-300 underline">{t('minter.tryAgain')}</button>
        </div>
      )}

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
            ].join(' ')}>
            {!isConnected && t('minter.connectToMint')}
            {isConnected && status === 'idle' && t('minter.mintToken', { icon: token.icon, name: token.name })}
            {status === 'simulating' && <span className="flex items-center justify-center gap-2"><span className="animate-spin">\u2699\uFE0F</span> {t('minter.simulating')}</span>}
            {status === 'signing' && <span className="flex items-center justify-center gap-2"><span className="animate-pulse">🖊️\uFE0F</span> {t('minter.signInWallet')}</span>}
          </button>
        )}
        {!isConnected && <p className="text-center text-xs text-gray-500 mt-2">{t('minter.requiresExtension')}</p>}
      </div>
    </div>
  );
}
