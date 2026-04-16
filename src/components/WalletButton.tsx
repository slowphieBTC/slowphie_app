import { useWalletConnect } from '@btc-vision/walletconnect';
import { useTranslation } from 'react-i18next';

export function WalletButton() {
  const { walletAddress, walletBalance, network, connecting, openConnectModal, disconnect } = useWalletConnect();
  const { t } = useTranslation();

  const shortAddr = walletAddress ? walletAddress.slice(0, 8) + '...' + walletAddress.slice(-6) : null;
  const balanceBTC = walletBalance ? (walletBalance.confirmed / 1e8).toFixed(6) : null;

  if (connecting) {
    return (
      <button disabled className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gray-700 text-gray-400 cursor-not-allowed text-sm font-medium">
        <span className="animate-spin text-base">&#x23F3;</span>
        {t('wallet.connecting')}
      </button>
    );
  }

  if (walletAddress) {
    return (
      <div className="flex items-center gap-3">
        <div className="glass rounded-xl px-4 py-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse-slow"></span>
            <span className="text-gray-300 font-mono">{shortAddr}</span>
          </div>
          {balanceBTC && (
            <div className="text-xs text-gray-500 mt-0.5">
              {balanceBTC} BTC
              {network && <span className="ml-2 text-orange-400 capitalize">{network.network}</span>}
            </div>
          )}
        </div>
        <button onClick={disconnect} className="px-3 py-2 rounded-xl text-sm text-gray-400 hover:text-red-400 hover:bg-red-400/10 transition-colors">
          {t('wallet.disconnect')}
        </button>
      </div>
    );
  }

  return (
    <button onClick={openConnectModal} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-white font-semibold text-sm transition-all hover:scale-105 active:scale-95 glow-orange">
      <span>&#x1F517;</span>
      {t('wallet.connectWallet')}
    </button>
  );
}
