import { motion } from 'framer-motion';
import { TrendingUp, Droplets, Wheat, ExternalLink, Copy, CheckCheck, Wallet, Tractor } from 'lucide-react';
import { useState } from 'react';
import { useAppStore } from '../store';
import { useTranslation } from 'react-i18next';
import type { Position, FarmInfo, LPUnderlying } from '../types';
import type { TotalsUnit } from './TokenTotalsCard';
import { CONTRACTS } from '../api/opnet';
import { BTC_NATIVE } from '../lib/coreTokens';

const STATIC_TOKEN_ICONS: Record<string, string> = {
  PILL:  'https://raw.githubusercontent.com/btc-vision/contract-logo/main/contracts/op1sqz0f729q22dv6trrvhn9msl9enqqaazy5cjy4ej6.png',
  MOTO:  'https://raw.githubusercontent.com/btc-vision/contract-logo/main/contracts/op1sqrxd0p3kd234wc5n2z7pl4hs82y8kpk4fqj9h78a.png',
  BTC:   'https://raw.githubusercontent.com/btc-vision/contract-logo/main/contracts/bitcoin.png',
  BLUE:  '/tokens/BLUE.jpg',
  MCHAD: '/tokens/MCHAD.jpg',
};

/** Symbol → lowercase contract address, used for price lookup in marketPrices */
const SYMBOL_TO_CONTRACT: Record<string, string> = {
  MOTO:  CONTRACTS.MOTO_TOKEN.toLowerCase(),
  PILL:  CONTRACTS.PILL_TOKEN.toLowerCase(),
  SAT:   CONTRACTS.SAT_TOKEN.toLowerCase(),
  SWAP:  CONTRACTS.SWAP_TOKEN.toLowerCase(),
  BLUE:  CONTRACTS.BLUE_TOKEN.toLowerCase(),
  PEPE:  CONTRACTS.PEPE_TOKEN.toLowerCase(),
  UNGA:  CONTRACTS.UNGA_TOKEN.toLowerCase(),
  ICHI:  CONTRACTS.ICHI_TOKEN.toLowerCase(),
  MCHAD: CONTRACTS.MCHAD_TOKEN.toLowerCase(),
  BTC:   BTC_NATIVE,
};

function symbolAbbr(symbol: string): string {
  const clean = symbol.replace(/[^A-Z0-9]/gi, '');
  return clean.slice(0, 2).toUpperCase();
}

// Icon resolution: always prefer address-based store key over symbol-based.
// Symbol fallback in the store would cause icon collisions between tokens sharing the same symbol (e.g. two PEPE contracts).
// STATIC_TOKEN_ICONS is safe — it only holds unique core tokens (BTC, MOTO, PILL, MCHAD, BLUE).
function resolveIcon(symbol: string, storeIcons: Record<string, string>, contractAddress?: string): string | undefined {
  const key = symbol.toUpperCase();
  if (contractAddress) {
    const addrKey = `addr:${contractAddress.toLowerCase()}`;
    return storeIcons[addrKey] ?? STATIC_TOKEN_ICONS[key];
  }
  return STATIC_TOKEN_ICONS[key];
}

function LetterAvatar({ abbr, sizeClass }: { abbr: string; sizeClass: string }) {
  return (
    <div className={`${sizeClass} rounded-lg bg-dark-700/80 border border-dark-600/50 flex items-center justify-center shrink-0`}>
      <span className="text-xs font-bold text-gray-300">{abbr}</span>
    </div>
  );
}

function TokenAvatar({ symbol, contractAddress, size = 8 }: { symbol: string; contractAddress?: string; size?: number }) {
  const storeIcons = useAppStore((s) => s.tokenIcons);
  const px = size * 4;
  const sizeClass = `w-${size} h-${size}`;
  const [leftErr,  setLeftErr]  = useState(false);
  const [rightErr, setRightErr] = useState(false);
  const [imgErr,   setImgErr]   = useState(false);

  if (symbol.includes('/')) {
    const [left, right] = symbol.split('/');
    const leftUrl   = resolveIcon(left  ?? '', storeIcons);
    const rightUrl  = resolveIcon(right ?? '', storeIcons);
    const leftAbbr  = symbolAbbr(left  ?? '');
    const rightAbbr = symbolAbbr(right ?? '');
    if (leftUrl && rightUrl && !leftErr && !rightErr) {
      return <SplitTokenIcon leftUrl={leftUrl} leftAlt={left ?? ''} rightUrl={rightUrl} rightAlt={right ?? ''} size={px} onLeftError={() => setLeftErr(true)} onRightError={() => setRightErr(true)} />;
    }
    return (
      <div style={{ position: 'relative', width: px, height: px, flexShrink: 0 }}>
        <div style={{ position: 'absolute', top: 0, left: 0, width: px, height: px, borderRadius: 8, background: 'rgba(99,102,241,0.25)', border: '1px solid rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', clipPath: 'inset(0 50% 0 0)' }}>
          {leftUrl && !leftErr ? <img src={leftUrl} alt={left ?? ''} style={{ width: px, height: px, objectFit: 'cover', borderRadius: 8 }} onError={() => setLeftErr(true)} /> : <span style={{ fontSize: 9, fontWeight: 700, color: '#a5b4fc', paddingRight: 4 }}>{leftAbbr}</span>}
        </div>
        <div style={{ position: 'absolute', top: 0, left: 0, width: px, height: px, borderRadius: 8, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', clipPath: 'inset(0 0 0 50%)' }}>
          {rightUrl && !rightErr ? <img src={rightUrl} alt={right ?? ''} style={{ width: px, height: px, objectFit: 'cover', borderRadius: 8 }} onError={() => setRightErr(true)} /> : <span style={{ fontSize: 9, fontWeight: 700, color: '#a5b4fc', paddingLeft: 4 }}>{rightAbbr}</span>}
        </div>
        <div style={{ position: 'absolute', top: '15%', left: '50%', width: 1.5, height: '70%', background: 'rgba(99,102,241,0.5)', transform: 'translateX(-50%)' }} />
      </div>
    );
  }

  const url  = resolveIcon(symbol, storeIcons, contractAddress);
  const abbr = symbolAbbr(symbol);
  if (url && !imgErr) {
    return <img src={url} alt={symbol} className={`${sizeClass} rounded-full object-cover`} onError={() => setImgErr(true)} />;
  }
  return <LetterAvatar abbr={abbr} sizeClass={sizeClass} />;
}

const STAKING_ADDRESS = '0xab99e31ebb30b8e596d5be1bd1e501ee8e7b7e5ec9dc7ee880f4937b0c929dcb';

interface Props { position: Position; index?: number; unit?: TotalsUnit; }

function truncate(addr: string) {
  if (addr.startsWith('0x')) return addr.slice(0, 8) + '...' + addr.slice(-6);
  if (addr.startsWith('bc1')) return addr.slice(0, 8) + '...' + addr.slice(-6);
  return addr.slice(0, 10) + '...';
}

function fmt(n: number): string {
  if (n === 0) return '\u2014';
  if (n >= 1_000_000_000_000) return (n / 1_000_000_000_000).toFixed(2) + 'T';
  if (n >= 1_000_000_000)    return (n / 1_000_000_000).toFixed(2) + 'B';
  if (n >= 1_000_000)        return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000)            return (n / 1_000).toFixed(2) + 'K';
  return n.toFixed(4);
}

function fmtLp(n: number): string {
  if (n === 0) return '\u2014';
  if (n >= 1_000_000_000_000) return (n / 1_000_000_000_000).toFixed(4) + 'T';
  if (n >= 1_000_000_000)    return (n / 1_000_000_000).toFixed(4) + 'B';
  if (n >= 1_000_000)        return (n / 1_000_000).toFixed(4) + 'M';
  if (n >= 1_000)            return (n / 1_000).toFixed(6) + 'K';
  return n.toFixed(6);
}

/** Formatter signature used by all sub-cards */
type CardFmt = (n: number, symbol: string, contractAddr?: string) => string;

/**
 * Hook that returns unit-aware formatters for position card values.
 * fmtV  – for regular token amounts
 * fmtLpV – same but falls back to fmtLp (more decimals) in 'amount' mode
 */
function useCardFmt(unit: TotalsUnit = 'amount'): { fmtV: CardFmt; fmtLpV: CardFmt } {
  const marketPrices = useAppStore((s) => s.marketPrices);
  const btcPrice     = useAppStore((s) => s.btcPrice);

  function fmtV(n: number, symbol: string, contractAddr?: string): string {
    if (n === 0) return '\u2014';
    if (unit === 'amount') return fmt(n);
    const key = symbol === 'BTC'
      ? BTC_NATIVE
      : (contractAddr?.toLowerCase() ?? SYMBOL_TO_CONTRACT[symbol.toUpperCase()] ?? '');
    const priceBtc = marketPrices[key] ?? 0;
    if (priceBtc === 0) return fmt(n); // no price → fall back to token amount
    if (unit === 'btc') return (n * priceBtc).toFixed(8) + ' \u20bf';
    // usd
    const usdPerBtc = btcPrice ?? 0;
    if (usdPerBtc === 0) return fmt(n);
    const usd = n * priceBtc * usdPerBtc;
    if (usd >= 1_000_000_000) return '$' + (usd / 1_000_000_000).toFixed(2) + 'B';
    if (usd >= 1_000_000)     return '$' + (usd / 1_000_000).toFixed(2) + 'M';
    if (usd >= 1_000)         return '$' + (usd / 1_000).toFixed(2) + 'K';
    return '$' + usd.toFixed(2);
  }

  function fmtLpV(n: number, symbol: string, contractAddr?: string): string {
    if (n === 0) return '\u2014';
    if (unit === 'amount') return fmtLp(n);
    return fmtV(n, symbol, contractAddr);
  }

  return { fmtV, fmtLpV };
}

function SplitTokenIcon({ leftUrl, leftAlt, rightUrl, rightAlt, size = 36, onLeftError, onRightError }: {
  leftUrl: string; leftAlt: string; rightUrl: string; rightAlt: string; size?: number;
  onLeftError?: () => void; onRightError?: () => void;
}) {
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <img src={leftUrl} alt={leftAlt} onError={onLeftError} style={{ position: 'absolute', top: 0, left: 0, width: size, height: size, borderRadius: '50%', clipPath: 'inset(0 50% 0 0)', objectFit: 'cover' }} />
      <img src={rightUrl} alt={rightAlt} onError={onRightError} style={{ position: 'absolute', top: 0, left: 0, width: size, height: size, borderRadius: '50%', clipPath: 'inset(0 0 0 50%)', objectFit: 'cover' }} />
    </div>
  );
}

function copyToClipboard(text: string): void {
  if (navigator.clipboard?.writeText) { navigator.clipboard.writeText(text).catch(() => fallbackCopy(text)); }
  else { fallbackCopy(text); }
}
function fallbackCopy(text: string): void {
  const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.left = '-9999px';
  document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
}

function CopyButton({ text }: { text: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const handleCopy = () => { copyToClipboard(text); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <button onClick={handleCopy} className="p-1 hover:text-brand-400 transition-colors" title={t('common.copy')}>
      {copied ? <CheckCheck className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

function AddressRow({ addr }: { addr: string }) {
  return (
    <div className="flex items-center gap-1 text-gray-600 text-xs">
      <button onClick={() => copyToClipboard(addr)} className="font-mono hover:text-brand-400 transition-colors cursor-pointer" title={addr}>{truncate(addr)}</button>
      <CopyButton text={addr} />
    </div>
  );
}

type ViewId = 'wallet' | number;

function ViewTabs({ active, farms, onChange }: { active: ViewId; farms: FarmInfo[]; onChange: (v: ViewId) => void; }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center bg-dark-800/60 rounded-lg p-0.5 gap-0.5">
      <button onClick={() => onChange('wallet')} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${active === 'wallet' ? 'bg-yellow-500/20 text-yellow-300 shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}>
        <Wallet className="w-3 h-3" />{t('positions.wallet')}
      </button>
      {farms.map((farm, i) => (
        <button key={i} onClick={() => onChange(i)} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${active === i ? 'bg-green-500/20 text-green-300 shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}>
          <Tractor className="w-3 h-3" />{farm.farmName.length > 12 ? farm.farmName.slice(0, 10) + '...' : farm.farmName}
        </button>
      ))}
    </div>
  );
}

function StakeCard({ pos, fmtV, unit = 'amount' }: { pos: Position; fmtV: CardFmt; unit?: TotalsUnit }) {
  const { t } = useTranslation();
  const marketPrices = useAppStore((s) => s.marketPrices);
  const btcPrice     = useAppStore((s) => s.btcPrice);
  const rewards = pos.stakingRewards ?? [];
  const hasRewards = rewards.some(r => r.pending > 0);
  const rewardColor: Record<string, string> = { MOTO: 'text-orange-400', PILL: 'text-purple-400', SAT: 'text-yellow-400', SWAP: 'text-cyan-400' };

  // Aggregate BTC value of all pending rewards (always shown in BTC regardless of unit)
  const totalRewardsBtc = rewards.reduce((sum, r) => {
    if (r.pending <= 0) return sum;
    const price = marketPrices[r.tokenAddress.toLowerCase()] ?? 0;
    return sum + r.pending * price;
  }, 0);

  function fmtRewardsTotal(btcVal: number): string {
    if (btcVal <= 0) return '';
    if (unit === 'usd') {
      const usd = btcVal * (btcPrice ?? 0);
      if (usd <= 0) return '\u2248\u00a0' + btcVal.toFixed(8) + '\u00a0\u20bf';
      if (usd >= 1_000_000) return '\u2248\u00a0$' + (usd / 1_000_000).toFixed(2) + 'M';
      if (usd >= 1_000)     return '\u2248\u00a0$' + (usd / 1_000).toFixed(2) + 'K';
      return '\u2248\u00a0$' + usd.toFixed(2);
    }
    return '\u2248\u00a0' + btcVal.toFixed(8) + '\u00a0\u20bf';
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <TokenAvatar symbol="MOTO" />
        <div>
          <div className="text-sm font-semibold text-white">{pos.label}</div>
          <div className="text-xs text-gray-500">{t('positions.motoswapStake')}</div>
        </div>
        <span className="ml-auto badge bg-brand-500/20 text-brand-300 border border-brand-500/30 text-xs px-2 py-0.5 rounded-full">{t('positions.badge.stake')}</span>
      </div>
      <div className="bg-dark-700/50 rounded-xl p-3">
        <div className="text-xs text-gray-500">{t('positions.staked')}</div>
        <div className="mt-1 text-white font-semibold text-lg">{fmtV(pos.amount, 'MOTO', CONTRACTS.MOTO_TOKEN)}</div>
        <div className="text-xs text-gray-600 mt-0.5">{pos.token}</div>
      </div>
      {rewards.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs text-gray-500">{t('positions.pendingRewards')}</div>
            {totalRewardsBtc > 0 && (
              <div className="text-xs font-semibold text-yellow-400 font-mono">{fmtRewardsTotal(totalRewardsBtc)}</div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {rewards.map((r) => (
              <div key={r.tokenAddress} className="bg-dark-700/50 rounded-xl p-3">
                <div className="flex items-center gap-1.5"><TokenAvatar symbol={r.symbol} contractAddress={r.tokenAddress} size={4} /><span className="text-xs text-gray-400">{r.symbol}</span></div>
                <div className={`mt-1 font-semibold ${r.pending > 0 ? (rewardColor[r.symbol] ?? 'text-green-400') : 'text-gray-600'}`}>
                  {r.pending > 0 ? fmtV(r.pending, r.symbol, r.tokenAddress) : '\u2014'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {!hasRewards && rewards.length === 0 && (
        <div className="bg-dark-700/50 rounded-xl p-3 text-center text-xs text-gray-600">{t('positions.noPendingRewards')}</div>
      )}
      <AddressRow addr={STAKING_ADDRESS} />
    </div>
  );
}

function MultiViewCard({ pos, fmtV, fmtLpV }: { pos: Position; fmtV: CardFmt; fmtLpV: CardFmt }) {
  const { t } = useTranslation();
  const farms = pos.farms ?? [];
  const defaultView: ViewId = farms.findIndex(f => f.staked > 0) >= 0 ? farms.findIndex(f => f.staked > 0) : 'wallet';
  const [view, setView] = useState<ViewId>(defaultView);
  const walletBal = pos.walletBalance ?? 0;
  const token     = pos.token;
  const activeFarm: FarmInfo | null = typeof view === 'number' ? (farms[view] ?? null) : null;
  const displayAddr = activeFarm ? activeFarm.farmContract : pos.contractAddress;
  const link = activeFarm ? activeFarm.farmLink : pos.type === 'stake' ? 'https://motoswap.org/stake' : view === 'wallet' ? `https://motoswap.org/token/${pos.contractAddress}` : 'https://motoswap.org';
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <TokenAvatar symbol={token} contractAddress={pos.contractAddress} />
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white">{token}</div>
          <div className="text-xs text-gray-500 truncate">{activeFarm ? t('positions.farmPoolInfo', { farmName: activeFarm.farmName, poolId: activeFarm.poolId }) : t('positions.walletBalance')}</div>
        </div>
      </div>
      {farms.length > 0 && <ViewTabs active={view} farms={farms} onChange={setView} />}
      {view === 'wallet' && (
        <motion.div key="wallet" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className="space-y-3">
          <div className="bg-dark-700/50 rounded-xl p-4">
            <div className="text-xs text-gray-500 mb-1">{t('positions.walletBalance')}</div>
            <div className="text-2xl font-bold text-white">{fmtV(walletBal, token, pos.contractAddress)}</div>
            <div className="text-xs text-gray-600 mt-0.5">{token}</div>
          </div>
          {pos.lpUnderlying && (pos.lpUnderlying.token0Amount > 0 || pos.lpUnderlying.token1Amount > 0) && <LPUnderlyingGrid und={pos.lpUnderlying} fmtV={fmtV} />}
          {farms.length === 0 && <div className="text-xs text-gray-600 italic text-center">{t('positions.noFarmPositions')}</div>}
          {farms.length > 0 && farms.every(f => f.staked === 0) && <div className="text-xs text-gray-600 italic text-center">{t('positions.notStakedAnyFarm')}</div>}
        </motion.div>
      )}
      {activeFarm && (
        <motion.div key={`farm-${view}`} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} className="space-y-3">
          {activeFarm.staked > 0 || activeFarm.pending > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-dark-700/50 rounded-xl p-3">
                <div className="text-xs text-gray-500">{t('positions.alreadyStaked')}</div>
                <div className="text-white font-semibold mt-1">{fmtV(activeFarm.staked, token, pos.contractAddress)}</div>
                <div className="text-xs text-gray-600 mt-0.5">{token}</div>
              </div>
              <div className="bg-dark-700/50 rounded-xl p-3">
                <div className="text-xs text-gray-500">{t('positions.pendingHarvest')}</div>
                <div className="text-green-400 font-semibold mt-1">{fmtV(activeFarm.pending, activeFarm.rewardToken, SYMBOL_TO_CONTRACT[activeFarm.rewardToken.toUpperCase()])}</div>
                <div className="text-xs text-gray-600 mt-0.5">{activeFarm.rewardToken}</div>
              </div>
            </div>
          ) : (
            <div className="bg-dark-700/30 rounded-xl p-4 text-center">
              <Tractor className="w-8 h-8 text-gray-600 mx-auto mb-2" />
              <div className="text-sm text-gray-500">{t('positions.noTokenStaked', { token })}</div>
              <div className="text-xs text-gray-600 mt-1">{t('positions.depositToEarn', { token, rewardToken: activeFarm.rewardToken })}</div>
            </div>
          )}
          {pos.lpUnderlyingStaked && (pos.lpUnderlyingStaked.token0Amount > 0 || pos.lpUnderlyingStaked.token1Amount > 0) && <LPUnderlyingGrid und={pos.lpUnderlyingStaked} fmtV={fmtV} />}
          <div className="text-xs text-gray-600 text-center">{t('positions.farmPoolInfo', { farmName: activeFarm.farmName, poolId: activeFarm.poolId })}</div>
        </motion.div>
      )}
      <AddressRow addr={displayAddr} />
      <div className="pt-2 border-t border-dark-600/50">
        <a href={link} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-gray-600 hover:text-brand-400 transition-colors">
          {t('positions.viewOnMotoSwap')} <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}

function FarmCard({ pos, fmtV }: { pos: Position; fmtV: CardFmt }) {
  const { t } = useTranslation();
  const isWalletOnly = pos.poolId === undefined;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <TokenAvatar symbol={pos.token} contractAddress={pos.contractAddress} />
        <div>
          <div className="text-sm font-semibold text-white">{pos.label}</div>
          <div className="text-xs text-gray-500">{pos.poolId !== undefined ? t('positions.poolId', { id: pos.poolId }) : t('positions.walletBalance')}</div>
        </div>
        <span className={`ml-auto badge text-xs px-2 py-0.5 rounded-full ${isWalletOnly ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30' : 'bg-green-500/20 text-green-300 border border-green-500/30'}`}>
          {isWalletOnly ? t('positions.badge.token') : t('positions.badge.farm')}
        </span>
      </div>
      {isWalletOnly ? (
        <div className="bg-dark-700/50 rounded-xl p-3">
          <div className="text-xs text-gray-500">{t('positions.walletBalance')}</div>
          <div className="mt-1 text-white font-semibold text-lg">{fmtV(pos.amount, pos.token, pos.contractAddress)}</div>
          <div className="text-xs text-gray-600 mt-0.5">{pos.token}</div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-dark-700/50 rounded-xl p-3">
            <div className="text-xs text-gray-500">{t('positions.alreadyStaked')}</div>
            <div className="mt-1 text-white font-semibold">{fmtV(pos.amount, pos.token, pos.contractAddress)}</div>
            <div className="text-xs text-gray-600 mt-0.5">{pos.token}</div>
          </div>
          <div className="bg-dark-700/50 rounded-xl p-3">
            <div className="text-xs text-gray-500">{t('positions.pendingHarvest')}</div>
            <div className="mt-1 text-green-400 font-semibold">{fmtV(pos.rewards, pos.rewardToken ?? '', SYMBOL_TO_CONTRACT[(pos.rewardToken ?? '').toUpperCase()])}</div>
            <div className="text-xs text-gray-600 mt-0.5">{pos.rewardToken ?? '\u2014'}</div>
          </div>
        </div>
      )}
      <AddressRow addr={pos.contractAddress} />
    </div>
  );
}

function LPUnderlyingGrid({ und, fmtV }: { und: LPUnderlying; fmtV: CardFmt }) {
  const { t } = useTranslation();
  const ICONS: Record<string, string> = {
    MOTO: 'https://raw.githubusercontent.com/btc-vision/contract-logo/main/contracts/op1sqrxd0p3kd234wc5n2z7pl4hs82y8kpk4fqj9h78a.png',
    PILL: 'https://raw.githubusercontent.com/btc-vision/contract-logo/main/contracts/op1sqz0f729q22dv6trrvhn9msl9enqqaazy5cjy4ej6.png',
    BTC:  'https://raw.githubusercontent.com/btc-vision/contract-logo/main/contracts/bitcoin.png',
  };
  const COLORS: Record<string, string> = { SWAP: 'text-cyan-300', MOTO: 'text-orange-400', PILL: 'text-purple-400', BTC: 'text-orange-400' };
  const tokens = [
    { symbol: und.token0Symbol, amount: und.token0Amount, address: und.token0Address },
    { symbol: und.token1Symbol, amount: und.token1Amount, address: und.token1Address },
  ];
  return (
    <div>
      <div className="text-xs text-gray-500 mb-2">{t('positions.poolComposition')}</div>
      <div className="grid grid-cols-2 gap-2">
        {tokens.map((tk) => (
          <div key={tk.address || tk.symbol} className="bg-dark-700/50 rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-1">
              {ICONS[tk.symbol] ? <img src={ICONS[tk.symbol]} alt={tk.symbol} className="w-4 h-4 rounded" /> : null}
              <span className="text-xs text-gray-400">{tk.symbol}</span>
            </div>
            <div className={`font-semibold text-sm ${tk.amount > 0 ? (COLORS[tk.symbol] ?? 'text-blue-400') : 'text-gray-600'}`}>
              {tk.amount > 0 ? fmtV(tk.amount, tk.symbol, tk.address) : '\u2014'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MchadCard({ pos, fmtV }: { pos: Position; fmtV: CardFmt }) {
  const { t } = useTranslation();
  const p = pos.mchadStaking!.positions[0]!;
  const lockDays = Math.round(p.lockDuration / 86400);
  const unlockDate = new Date(p.unlockTimestamp * 1000).toLocaleDateString();
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <TokenAvatar symbol="MCHAD" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-white">{t('positions.mchadStakingTitle')}</div>
          <div className="text-xs text-gray-500">{t('positions.motochadCom')}</div>
        </div>
        <span className="badge bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs px-2 py-0.5 rounded-full">{t('positions.badge.custom')}</span>
      </div>
      <div className="bg-dark-700/50 rounded-xl p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs text-gray-500">{t('positions.staked')}</div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-purple-400 font-medium">{p.multiplierFormatted}</span>
            <span className="text-xs text-gray-600">{t('positions.lockDays', { days: lockDays })}</span>
          </div>
        </div>
        <div className="text-white font-semibold text-lg">{fmtV(parseFloat(p.stakedFormatted), 'MCHAD', CONTRACTS.MCHAD_TOKEN)}</div>
        <div className="text-xs text-gray-500 mt-0.5">{t('positions.weighted', { amount: fmtV(parseFloat(p.stakedWeightedFormatted), 'MCHAD', CONTRACTS.MCHAD_TOKEN) })}</div>
      </div>
      <div className="bg-dark-700/50 rounded-xl p-3">
        <div className="text-xs text-gray-500 mb-1">{t('positions.pendingHarvest')}</div>
        <div className="text-[#75bbdf] font-semibold text-lg">{fmtV(parseFloat(p.unclaimedRewardsFormatted), p.rewardSymbol, SYMBOL_TO_CONTRACT[p.rewardSymbol.toUpperCase()])}</div>
        <div className="text-xs text-gray-600 mt-0.5">{p.rewardSymbol}</div>
      </div>
      <div className="text-xs text-gray-600 text-center">{t('positions.unlocks', { date: unlockDate })}</div>
      <AddressRow addr={pos.contractAddress} />
    </div>
  );
}

function LPCard({ pos, fmtV, fmtLpV }: { pos: Position; fmtV: CardFmt; fmtLpV: CardFmt }) {
  const { t } = useTranslation();
  const hasMchadTab = !!pos.mchadLpStaking;
  const [view, setView] = useState<'wallet' | 'mchad'>('wallet');
  const mchad = pos.mchadLpStaking;
  const lockDays = mchad ? Math.round(mchad.lockDuration / 86400) : 0;
  const unlockDate = mchad ? new Date(mchad.unlockTimestamp * 1000).toLocaleDateString() : null;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <TokenAvatar symbol={pos.token} size={9} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-white">{pos.label}</div>
          <div className="text-xs text-gray-500">{hasMchadTab ? t('positions.motochadCom') : t('positions.liquidityPosition')}</div>
        </div>
        <span className="ml-auto badge bg-blue-500/20 text-blue-300 border border-blue-500/30 text-xs px-2 py-0.5 rounded-full">{t('positions.badge.lp')}</span>
        {hasMchadTab && <span className="badge bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs px-2 py-0.5 rounded-full">{t('positions.badge.custom')}</span>}
      </div>
      {hasMchadTab && (
        <div className="flex items-center bg-dark-800/60 rounded-lg p-0.5 gap-0.5">
          <button onClick={() => setView('wallet')} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${view === 'wallet' ? 'bg-yellow-500/20 text-yellow-300 shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}>
            <Wallet className="w-3 h-3" /> {t('positions.wallet')}
          </button>
          <button onClick={() => setView('mchad')} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${view === 'mchad' ? 'bg-purple-500/20 text-purple-300 shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}>
            <Tractor className="w-3 h-3" /> {t('positions.mchadLp')}
          </button>
        </div>
      )}
      {view === 'wallet' && (
        <motion.div key="wallet" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className="space-y-3">
          <div className="bg-dark-700/50 rounded-xl p-4">
            <div className="text-xs text-gray-500 mb-1">{t('positions.lpTokens')}</div>
            <div className="text-2xl font-bold text-white">{fmtLpV(pos.walletBalance ?? pos.amount, pos.token, pos.contractAddress)}</div>
            <div className="text-xs text-gray-600 mt-0.5">{pos.token}</div>
          </div>
          {pos.rewards > 0 && (
            <div className="bg-dark-700/50 rounded-xl p-3">
              <div className="text-xs text-gray-500">{t('positions.pendingHarvest')}</div>
              <div className="mt-1 text-blue-400 font-semibold">{fmtV(pos.rewards, pos.rewardToken ?? '', SYMBOL_TO_CONTRACT[(pos.rewardToken ?? '').toUpperCase()])}</div>
              <div className="text-xs text-gray-600 mt-0.5">{pos.rewardToken ?? '\u2014'}</div>
            </div>
          )}
          {pos.lpUnderlying && (pos.lpUnderlying.token0Amount > 0 || pos.lpUnderlying.token1Amount > 0) && <LPUnderlyingGrid und={pos.lpUnderlying} fmtV={fmtV} />}
        </motion.div>
      )}
      {view === 'mchad' && mchad && (
        <motion.div key="mchad" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-dark-700/50 rounded-xl p-3">
              <div className="flex items-center justify-between mb-1">
                <div className="text-xs text-gray-500">{t('positions.alreadyStaked')}</div>
                <span className="text-xs text-purple-400 font-medium">{mchad.multiplierFormatted}</span>
              </div>
              <div className="text-white font-semibold">{fmtLpV(parseFloat(mchad.stakedFormatted), pos.token, pos.contractAddress)}</div>
              <div className="text-xs text-gray-600 mt-0.5">{t('positions.lockDays', { days: lockDays })}</div>
            </div>
            <div className="bg-dark-700/50 rounded-xl p-3">
              <div className="text-xs text-gray-500 mb-1">{t('positions.pendingHarvest')}</div>
              <div className="text-[#75bbdf] font-semibold">{fmtV(parseFloat(mchad.unclaimedRewardsFormatted), mchad.rewardSymbol, SYMBOL_TO_CONTRACT[mchad.rewardSymbol.toUpperCase()])}</div>
              <div className="text-xs text-gray-600 mt-0.5">{mchad.rewardSymbol}</div>
            </div>
          </div>
          {pos.lpUnderlyingStaked && (pos.lpUnderlyingStaked.token0Amount > 0 || pos.lpUnderlyingStaked.token1Amount > 0) && <LPUnderlyingGrid und={pos.lpUnderlyingStaked} fmtV={fmtV} />}
          {unlockDate && <div className="text-xs text-gray-600 text-center">{t('positions.unlocks', { date: unlockDate })}</div>}
        </motion.div>
      )}
      <AddressRow addr={pos.contractAddress} />
      <div className="pt-2 border-t border-dark-600/50">
        <a href={view === 'mchad' ? 'https://motochad.com' : 'https://motoswap.org/pool'} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-gray-600 hover:text-brand-400 transition-colors">
          {view === 'mchad' ? t('positions.viewOnMotoCHAD') : t('positions.viewOnMotoSwap')} <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}

export function PositionCard({ position, index = 0, unit = 'amount' }: Props) {
  const { t } = useTranslation();
  const { fmtV, fmtLpV } = useCardFmt(unit);
  const isMulti  = position.hasFarmView === true;
  const isMchad  = !!position.mchadStaking;
  const isStake  = position.type === 'stake' && !isMchad;
  const isLP     = position.type === 'lp';

  const borderClass = isMchad
    ? 'from-[#75bbdf]/5 to-[#a260f9]/5 border-[#75bbdf]/30 hover:border-[#75bbdf]/50'
    : isMulti && position.token === 'PILL'
    ? 'from-green-500/5 to-yellow-500/5 border-green-500/20 hover:border-green-400/40'
    : isMulti && position.token === 'MOTO'
      ? 'from-brand-500/5 to-yellow-500/5 border-brand-500/20 hover:border-brand-400/40'
      : isMulti && position.token === 'SAT'
        ? 'from-orange-500/5 to-yellow-500/5 border-orange-500/20 hover:border-orange-400/40'
        : isStake
          ? 'from-brand-500/5 to-brand-500/0 border-brand-500/20 hover:border-brand-500/40'
          : isLP
            ? 'from-blue-500/5 to-blue-500/0 border-blue-500/20 hover:border-blue-500/40'
            : 'from-green-500/5 to-green-500/0 border-green-500/20 hover:border-green-500/40';

  const simpleLink = isMchad ? 'https://motochad.com' : isStake ? 'https://motoswap.org/stake' : isLP ? 'https://motoswap.org/pool' : `https://motoswap.org/token/${position.contractAddress}`;
  const simpleLinkLabel = isMchad ? t('positions.viewOnMotoCHAD') : t('positions.viewOnMotoSwap');

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.08 }}
      className={`glass rounded-2xl p-5 bg-gradient-to-br ${borderClass} border transition-all duration-300 hover:-translate-y-0.5`}>
      {isMchad   ? <MchadCard     pos={position} fmtV={fmtV} /> :
       isMulti   ? <MultiViewCard pos={position} fmtV={fmtV} fmtLpV={fmtLpV} /> :
       isStake   ? <StakeCard     pos={position} fmtV={fmtV} unit={unit} /> :
       isLP      ? <LPCard        pos={position} fmtV={fmtV} fmtLpV={fmtLpV} /> :
                   <FarmCard      pos={position} fmtV={fmtV} />}
      {!isMulti && !isLP && (
        <div className="mt-3 pt-3 border-t border-dark-600/50">
          <a href={simpleLink} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-gray-600 hover:text-brand-400 transition-colors">
            {simpleLinkLabel} <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}
    </motion.div>
  );
}
