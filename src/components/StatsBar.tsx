import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../store';
import { Activity, Blocks, Wifi, WifiOff } from 'lucide-react';
import { useBlockFeedConnected, useBlockFeedStream } from '../hooks/useWebSocket';
import type { StreamEvent } from '../hooks/useWebSocket';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

export function StatsBar() {
  const btcPrice    = useAppStore((s) => s.btcPrice);
  const latestBlock = useAppStore((s) => s.latestBlock);
  const connected   = useBlockFeedConnected();
  const { t } = useTranslation();

  useBlockFeedStream(useCallback((_event: StreamEvent) => {}, []));

  const connectionEl = (
    <div className="flex items-center gap-1.5">
      {connected ? (
        <>
          <motion.span initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_4px_rgba(74,222,128,0.8)] flex-shrink-0" />
          <Wifi className="w-3 h-3 text-green-400 flex-shrink-0" />
          <span className="text-xs text-green-400 font-medium">{t('statsbar.live')}</span>
        </>
      ) : (
        <>
          <span className="w-1.5 h-1.5 rounded-full bg-gray-600 animate-pulse flex-shrink-0" />
          <WifiOff className="w-3 h-3 text-gray-600 flex-shrink-0" />
          <span className="text-xs text-gray-500">{t('statsbar.connecting')}</span>
        </>
      )}
    </div>
  );

  const btcEl = (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-gray-500">{t('statsbar.btcLabel')}</span>
      {btcPrice ? (
        <AnimatePresence mode="wait">
          <motion.span key={btcPrice} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }} className="text-xs font-semibold text-brand-400">
            ${btcPrice.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </motion.span>
        </AnimatePresence>
      ) : (
        <span className="text-xs text-gray-600">{t('common.noData')}</span>
      )}
    </div>
  );

  const blockEl = (
    <div className="flex items-center gap-1.5">
      <Blocks className="w-3 h-3 text-gray-500 flex-shrink-0" />
      {latestBlock ? (
        <span className="text-xs text-gray-400">
          {t('statsbar.block')} <span className="text-white font-medium">#{latestBlock.height.toLocaleString()}</span>
        </span>
      ) : (
        <span className="text-xs text-gray-600">{t('statsbar.block')} {t('common.noData')}</span>
      )}
    </div>
  );

  const networkEl = (
    <div className="flex items-center gap-1.5">
      <Activity className="w-3 h-3 text-gray-600 flex-shrink-0" />
      <span className="text-xs text-gray-600">{t('statsbar.network')}</span>
    </div>
  );

  const sep = <div className="h-3 w-px bg-dark-600 flex-shrink-0" />;

  return (
    <div className="border-b border-dark-600/30 bg-dark-900/50 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="hidden sm:flex items-center gap-6 h-9">
          {connectionEl}{sep}{btcEl}{sep}{blockEl}{sep}{networkEl}
        </div>
        <div className="sm:hidden grid grid-cols-2 gap-x-4 gap-y-2 py-2.5">
          {connectionEl}{btcEl}{blockEl}{networkEl}
        </div>
      </div>
    </div>
  );
}
