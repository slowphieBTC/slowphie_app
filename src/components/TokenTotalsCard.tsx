import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, BarChart2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Position } from '../types';
import { useAppStore } from '../store';
import { CONTRACTS } from '../api/opnet';
import { BTC_NATIVE } from '../lib/coreTokens';
import { getTokenStyle, getTokenHex, getTokenTailwind } from '../lib/tokenColors';
import { TokenMarketPopup } from './TokenMarketPopup';
const STATIC_TOKEN_ICONS: Record<string, string> = {
  BTC:   'https://raw.githubusercontent.com/btc-vision/contract-logo/main/contracts/bitcoin.png',
  MOTO:  'https://raw.githubusercontent.com/btc-vision/contract-logo/main/contracts/op1sqrxd0p3kd234wc5n2z7pl4hs82y8kpk4fqj9h78a.png',
  PILL:  'https://raw.githubusercontent.com/btc-vision/contract-logo/main/contracts/op1sqz0f729q22dv6trrvhn9msl9enqqaazy5cjy4ej6.png',
  MCHAD: '/tokens/MCHAD.jpg',
  BLUE:  '/tokens/BLUE.jpg',
};

// Address-based order — matches CORE_ORDER in useTokenVisibility. Contract address keys
// are lowercase and match the mapKey used in aggregateTokens, so ordering is collision-safe.
const TOKEN_ADDRESS_ORDER: string[] = [
  BTC_NATIVE,                                                                    // BTC (native)
  CONTRACTS.MOTO_TOKEN.toLowerCase(),                                            // MOTO
  CONTRACTS.PILL_TOKEN.toLowerCase(),                                            // PILL
  CONTRACTS.MCHAD_TOKEN.toLowerCase(),                                           // MCHAD
  CONTRACTS.PEPE_TOKEN.toLowerCase(),                                            // PEPE
  CONTRACTS.UNGA_TOKEN.toLowerCase(),                                            // UNGA
  CONTRACTS.BLUE_TOKEN.toLowerCase(),                                            // BLUE
];

// Discovered (non-core) tokens: custom display order by symbol.
// Tokens not in this list fall back to alphabetical sorting.
const DISCOVERED_SYMBOL_ORDER = ['ICHI', 'SAT', 'SWAP', 'MONEY', 'BIP110', 'TESTICLE', 'PUSSY', 'MOTOD', 'PEPE', 'BITS', 'ANIME'];

/** Resolve full token style from the unified color system */
function cfg(symbol: string, tokenContract?: string) { return getTokenStyle(tokenContract, symbol); }

/** Build selection ring style from hex color */
function getSelectedStyle(hex: string): React.CSSProperties {
  return { boxShadow: `0 0 0 2px ${hex}99, 0 10px 15px -3px ${hex}1a` };
}

/** Build gradient border style if token has a gradient */
function getCardStyle(c: { bg: string; gradient?: string[] }): React.CSSProperties | undefined {
  if (!c.gradient) return undefined;
  const grad = c.gradient.join(', ');
  return { background: `linear-gradient(#1a1a2e, #1a1a2e) padding-box, linear-gradient(135deg, ${grad}) border-box`, border: '1px solid transparent' };
}



function TokenIcon({ symbol, contractAddress, color, size = 'md' }: { symbol: string; contractAddress?: string; color: string; size?: 'sm' | 'md' }) {
  const storeIcons = useAppStore((s) => s.tokenIcons);
  const [err, setErr] = useState(false);
  const key = symbol.toUpperCase();
  const addrKey = contractAddress ? `addr:${contractAddress.toLowerCase()}` : null;
  let url: string | undefined;
  if (addrKey) { url = storeIcons[addrKey] ?? STATIC_TOKEN_ICONS[key]; }
  else { url = storeIcons[key] ?? STATIC_TOKEN_ICONS[key]; }
  const abbr = symbol.replace(/[^A-Z0-9]/gi, '').slice(0, 2).toUpperCase();
  const imgCls = size === 'sm' ? 'w-5 h-5' : 'w-8 h-8';
  if (url && !err) return <img src={url} alt={symbol} className={`${imgCls} object-contain rounded-full`} onError={() => setErr(true)} />;
  return <span className={`text-xs font-bold ${color}`}>{abbr}</span>;
}

export interface TokenBreakdown {
  address: string; label: string; amount: number;
  type: 'wallet' | 'staked' | 'pending' | 'lp';
  tokenContract?: string;
}
export interface TokenTotal {
  symbol: string; tokenContract?: string; total: number; breakdown: TokenBreakdown[];
}

function aggregateTokens(positions: Position[]): TokenTotal[] {
  const totals = new Map<string, { symbol: string; tokenContract?: string; total: number; breakdown: TokenBreakdown[] }>();
  const add = (walletAddr: string, symbol: string, amount: number, label: string, type: TokenBreakdown['type'], tokenContract?: string) => {
    if (!symbol || amount <= 0) return;
    const sym = symbol.toUpperCase();
    const mapKey = sym === 'BTC' ? BTC_NATIVE : (tokenContract ? tokenContract.toLowerCase() : sym);
    const effectiveContract = sym === 'BTC' ? undefined : tokenContract;
    if (!totals.has(mapKey)) totals.set(mapKey, { symbol: sym, tokenContract: effectiveContract, total: 0, breakdown: [] });
    const entry = totals.get(mapKey)!;
    entry.total += amount;
    entry.breakdown.push({ address: walletAddr, label, amount, type, tokenContract: effectiveContract });
  };
  for (const pos of positions) {
    const addr = pos.address;
    const addrShort = addr.slice(0, 8) + '\u2026';
    const cAddr = pos.contractAddress;
    if (pos.type === 'stake') {
      if (pos.mchadStaking) {
        const p = pos.mchadStaking.positions[0];
        if (p) {
          if (parseFloat(p.stakedFormatted) > 0) add(addr, 'MCHAD', parseFloat(p.stakedFormatted), `MCHAD Staked (${addrShort})`, 'staked', CONTRACTS.MCHAD_TOKEN);
          if (parseFloat(p.unclaimedRewardsFormatted) > 0) add(addr, p.rewardSymbol.toUpperCase(), parseFloat(p.unclaimedRewardsFormatted), `MCHAD Pending Harvest (${addrShort})`, 'pending');
        }
      } else {
        if (pos.amount > 0) add(addr, pos.token, pos.amount, `Staked (${addrShort})`, 'staked', cAddr);
        pos.stakingRewards?.forEach(r => { if (r.pending > 0) add(addr, r.symbol, r.pending, `Stake Reward (${addrShort})`, 'pending', r.tokenAddress); });
      }
    } else if (pos.type === 'farm') {
      if (pos.hasFarmView) {
        if ((pos.walletBalance ?? 0) > 0) add(addr, pos.token, pos.walletBalance ?? 0, `Wallet (${addrShort})`, 'wallet', cAddr);
        pos.farms?.forEach(f => {
          if (f.staked > 0)  add(addr, pos.token, f.staked, `${f.farmName} Staked`, 'staked', cAddr);
          if (f.pending > 0) add(addr, f.rewardToken, f.pending, `${f.farmName} Harvest`, 'pending');
        });
      } else {
        const hasActiveFarm = pos.farms?.some(f => f.staked > 0 || f.pending > 0) ?? false;
        const entryType: TokenBreakdown['type'] = hasActiveFarm ? 'staked' : 'wallet';
        if (pos.amount > 0) add(addr, pos.token, pos.amount, pos.label, entryType, cAddr);
        if (pos.rewards > 0 && pos.rewardToken) add(addr, pos.rewardToken, pos.rewards, `${pos.label} Harvest`, 'pending');
      }
    } else if (pos.type === 'lp') {
      if (pos.lpUnderlying) {
        const { token0Symbol, token1Symbol, token0Amount, token1Amount, token0Address, token1Address } = pos.lpUnderlying;
        if (token0Amount > 0) add(addr, token0Symbol, token0Amount, `${pos.label} Wallet LP`, 'lp', token0Address);
        if (token1Amount > 0) add(addr, token1Symbol, token1Amount, `${pos.label} Wallet LP`, 'lp', token1Address);
      }
      if (pos.lpUnderlyingStaked) {
        const { token0Symbol, token1Symbol, token0Amount, token1Amount, token0Address, token1Address } = pos.lpUnderlyingStaked;
        if (token0Amount > 0) add(addr, token0Symbol, token0Amount, `${pos.label} Staked LP`, 'lp', token0Address);
        if (token1Amount > 0) add(addr, token1Symbol, token1Amount, `${pos.label} Staked LP`, 'lp', token1Address);
      }
      pos.farms?.forEach(f => { if (f.pending > 0) add(addr, f.rewardToken, f.pending, `${f.farmName} Harvest`, 'pending'); });
      if (!pos.hasFarmView && pos.rewards > 0 && pos.rewardToken) add(addr, pos.rewardToken, pos.rewards, `${pos.label} Harvest`, 'pending');
      if (pos.mchadLpStaking) {
        const lp = pos.mchadLpStaking;
        if (parseFloat(lp.unclaimedRewardsFormatted) > 0) add(addr, lp.rewardSymbol.toUpperCase(), parseFloat(lp.unclaimedRewardsFormatted), `MCHAD LP Pending Harvest (${addrShort})`, 'pending');
      }
    }
  }
  for (const [mapKey, data] of [...totals.entries()]) {
    if (data.tokenContract) continue;
    const addrEntry = [...totals.values()].find(d => d.tokenContract && d.symbol === data.symbol);
    if (addrEntry) { addrEntry.total += data.total; addrEntry.breakdown.push(...data.breakdown); totals.delete(mapKey); }
  }
  const result: TokenTotal[] = [];
  for (const addrKey of TOKEN_ADDRESS_ORDER) { for (const [mapKey, data] of totals) { if (mapKey === addrKey) result.push({ symbol: data.symbol, tokenContract: data.tokenContract, total: data.total, breakdown: data.breakdown }); } }
  // Discovered tokens: sort by custom order, then alphabetically for unknown symbols
  const discovered = [...totals.entries()]
    .filter(([mapKey]) => !TOKEN_ADDRESS_ORDER.includes(mapKey))
    .sort(([_, a], [__, b]) => {
      const ad = DISCOVERED_SYMBOL_ORDER.indexOf(a.symbol.toUpperCase());
      const bd = DISCOVERED_SYMBOL_ORDER.indexOf(b.symbol.toUpperCase());
      if (ad !== -1 && bd !== -1) return ad - bd;
      if (ad !== -1) return -1;
      if (bd !== -1) return 1;
      return a.symbol.localeCompare(b.symbol);
    });
  for (const [mapKey, data] of discovered) { result.push({ symbol: data.symbol, tokenContract: data.tokenContract, total: data.total, breakdown: data.breakdown }); }
  return result.filter(t => t.total > 0);
}

function groupByType(items: TokenBreakdown[]): { type: TokenBreakdown['type']; total: number }[] {
  const map = new Map<string, number>();
  for (const b of items) map.set(b.type, (map.get(b.type) ?? 0) + b.amount);
  const order: TokenBreakdown['type'][] = ['wallet', 'staked', 'lp', 'pending'];
  return order.filter(t => map.has(t)).map(t => ({ type: t, total: map.get(t)! }));
}

export type TotalsUnit = 'amount' | 'usd' | 'btc';

function fmt(n: number, symbol: string): string {
  const decimals = symbol === 'BTC' ? 8 : 4;
  if (n >= 1_000_000_000_000) return (n / 1_000_000_000_000).toLocaleString(undefined, { maximumFractionDigits: 2 }) + 'T';
  if (n >= 1_000_000_000)     return (n / 1_000_000_000).toLocaleString(undefined, { maximumFractionDigits: 2 }) + 'B';
  if (n >= 1_000_000) return (n / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 2 }) + 'M';
  if (n >= 1_000)     return (n / 1_000).toLocaleString(undefined, { maximumFractionDigits: 2 }) + 'K';
  return n.toLocaleString(undefined, { maximumFractionDigits: decimals });
}

function fmtBtc(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 2 }) + 'M ₿';
  if (n >= 1_000)     return (n / 1_000).toLocaleString(undefined, { maximumFractionDigits: 2 }) + 'K ₿';
  return n.toLocaleString(undefined, { maximumFractionDigits: 8 }) + ' ₿';
}

function fmtUsd(n: number): string {
  if (n >= 1_000_000_000) return '$' + (n / 1_000_000_000).toLocaleString(undefined, { maximumFractionDigits: 2 }) + 'B';
  if (n >= 1_000_000)     return '$' + (n / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 2 }) + 'M';
  if (n >= 1_000)         return '$' + (n / 1_000).toLocaleString(undefined, { maximumFractionDigits: 2 }) + 'K';
  return '$' + n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/** Build a per-token value formatter for the given unit */
function makeUnitFormatter(
  symbol: string,
  tokenContract: string | undefined,
  unit: TotalsUnit,
  marketPrices: Record<string, number>,
  btcPrice: number | null,
): (n: number) => string {
  if (unit === 'amount') return (n) => fmt(n, symbol);
  const key = symbol === 'BTC' ? BTC_NATIVE : (tokenContract?.toLowerCase() ?? '');
  const priceBtc = marketPrices[key] ?? 0;
  if (unit === 'btc') return (n) => fmtBtc(n * priceBtc);
  // usd
  const usdPerBtc = btcPrice ?? 0;
  return (n) => fmtUsd(n * priceBtc * usdPerBtc);
}


function SummaryCardItem({ tok, isSelected, onSelect, onInfoClick, fmtValue }: { tok: TokenTotal; isSelected: boolean; onSelect: () => void; onInfoClick: () => void; fmtValue: (n: number) => string }) {
  const { t } = useTranslation();
  const cfg = getTokenStyle(tok.tokenContract, tok.symbol);
  const [hovered, setHovered] = useState(false);
  const groups = groupByType(tok.breakdown);
  const badgeLabel: Record<string, string> = {
    wallet: t('totals.badges.wallet'),
    staked: t('totals.badges.staked'),
    pending: t('totals.badges.harvest'),
    lp: t('totals.badges.lpPool'),
  };
  const badgeCls: Record<string, string> = {
    wallet: 'bg-gray-500/20 text-gray-400',
    staked: 'bg-brand-500/20 text-brand-400',
    pending: 'bg-green-500/20 text-green-400',
    lp: 'bg-blue-500/20 text-blue-400',
  };
  const baseStyle = isSelected ? getSelectedStyle(cfg.hex) : getCardStyle(cfg);
  const hoverStyle = hovered && !isSelected ? { borderColor: `${cfg.hex}99` } : {};
  return (
    <div onClick={onInfoClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`cursor-pointer rounded-xl border p-4 flex flex-col gap-3 transition-all duration-150 ${
        isSelected
          ? `${cfg.border}`
          : `${cfg.border} ${cfg.bg}`
      }`}
      style={{ ...baseStyle, ...hoverStyle }}
    >
      <div className="flex items-center gap-2">
        <button onClick={(e) => { e.stopPropagation(); onSelect(); }}
          className={`w-9 h-9 rounded-full appearance-none bg-transparent ${cfg.bg} border ${cfg.border} flex items-center justify-center shrink-0 overflow-hidden cursor-pointer hover:scale-110 transition-transform`}
          title={t('market.price', 'Market info')}
          style={isSelected ? getSelectedStyle(cfg.hex) : undefined}>
          <TokenIcon symbol={tok.symbol} contractAddress={tok.tokenContract} color={cfg.color} />
        </button>
        <div>
          <div className={`text-base font-bold ${cfg.color}`}>{fmtValue(tok.total)}</div>
          <div className="text-xs text-dark-400">{tok.symbol}</div>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {groups.map(g => (
          <div key={g.type} className={`flex items-center gap-1 px-2 py-1 rounded-lg ${badgeCls[g.type] ?? 'bg-gray-500/20 text-gray-400'}`}>
            <span className="text-[10px] font-semibold">{badgeLabel[g.type] ?? g.type}</span>
            <span className="text-[10px] font-bold">{fmtValue(g.total)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}


interface Props {
  positions: Position[];
  selectedToken: string | null;
  onSelectToken: (addr: string | null) => void;
  onOpenChart?: () => void;
  unit: TotalsUnit;
  onUnitChange: (u: TotalsUnit) => void;
}
export function TokenTotalsCard({ positions, selectedToken, onSelectToken, onOpenChart, unit, onUnitChange }: Props) {
  const { t } = useTranslation();
  const totals       = aggregateTokens(positions);
  const marketPrices = useAppStore((s) => s.marketPrices);
  const btcPrice     = useAppStore((s) => s.btcPrice);

  // Popup state for market info
  const [popupToken, setPopupToken] = useState<TokenTotal | null>(null);


  // Resolve BTC address for matching with selectedToken (BTC_NATIVE already imported from coreTokens)

  return (
    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
      className="col-span-full bg-dark-800/60 backdrop-blur-sm border border-dark-700/50 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-dark-300 uppercase tracking-wider">
          <span className="sm:hidden">Holdings</span>
          <span className="hidden sm:inline">{t('totals.aggregateHoldings')}</span>
        </h2>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5 bg-dark-900/60 rounded-lg p-0.5">
            {([
              { value: 'amount' as TotalsUnit, label: '# Token' },
              { value: 'usd'    as TotalsUnit, label: '$ USD'   },
              { value: 'btc'    as TotalsUnit, label: '₿ BTC'   },
            ]).map(opt => (
              <button
                key={opt.value}
                onClick={() => onUnitChange(opt.value)}
                className={`relative px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                  unit === opt.value ? 'text-white' : 'text-dark-400 hover:text-dark-200'
                }`}
              >
                {unit === opt.value && (
                  <motion.div
                    layoutId="totals-unit-pill"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                    className="absolute inset-0 bg-dark-700/60 rounded-md -z-10"
                  />
                )}
                {opt.label}
              </button>
            ))}
          </div>

          {onOpenChart && (
            <button onClick={onOpenChart}
              title="Token Evolutions Chart"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all bg-dark-700/40 border-dark-600/40 text-dark-400 hover:bg-dark-700/70 hover:text-dark-200">
              <BarChart2 className="w-3.5 h-3.5" /> Chart
            </button>
          )}
        </div>
      </div>
      <AnimatePresence mode="wait">
        <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }}
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {totals.map(tok => {
            const tokAddr = tok.symbol === 'BTC'
              ? BTC_NATIVE
              : (tok.tokenContract?.toLowerCase() ?? '');
            const isSelected = selectedToken !== null && tokAddr === selectedToken;
            const handleSelect = () => onSelectToken(isSelected ? null : tokAddr);
            const fmtValue = makeUnitFormatter(tok.symbol, tok.tokenContract, unit, marketPrices, btcPrice);
            const handleInfoClick = () => setPopupToken(tok);

            return <SummaryCardItem key={tok.tokenContract || tok.symbol} tok={tok} isSelected={isSelected} onSelect={handleSelect} onInfoClick={handleInfoClick} fmtValue={fmtValue} />;
          })}
        </motion.div>
      </AnimatePresence>

      {/* Market info popup */}
      {popupToken && (
        <TokenMarketPopup
          tokenContract={popupToken.tokenContract}
          symbol={popupToken.symbol}
          tokenTotal={popupToken}
          onClose={() => setPopupToken(null)}
        />
      )}
    </motion.div>
  );
}
