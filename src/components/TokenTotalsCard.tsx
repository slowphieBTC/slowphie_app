import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutList, LayoutGrid, Wallet } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Position } from '../types';
import { useAppStore } from '../store';
import { CONTRACTS } from '../api/opnet';

const STATIC_TOKEN_ICONS: Record<string, string> = {
  BTC:   'https://raw.githubusercontent.com/btc-vision/contract-logo/main/contracts/bitcoin.png',
  MOTO:  'https://raw.githubusercontent.com/btc-vision/contract-logo/main/contracts/op1sqrxd0p3kd234wc5n2z7pl4hs82y8kpk4fqj9h78a.png',
  PILL:  'https://raw.githubusercontent.com/btc-vision/contract-logo/main/contracts/op1sqz0f729q22dv6trrvhn9msl9enqqaazy5cjy4ej6.png',
  MCHAD: '/tokens/MCHAD.jpg',
  BLUE:  '/tokens/BLUE.jpg',
};

const TOKEN_ORDER = ['BTC', 'MOTO', 'PILL', 'SAT', 'SWAP', 'BLUE', 'PEPE', 'UNGA', 'MCHAD'];

const TOKEN_CONFIG: Record<string, { color: string; bg: string; border: string; gradient?: string[] }> = {
  BTC:  { color: 'text-orange-400',  bg: 'bg-orange-500/10',   border: 'border-orange-500/20'   },
  MOTO: { color: 'text-white',        bg: 'bg-white/5',          border: 'border-white/20'          },
  PILL: { color: 'text-[#e64900]',   bg: 'bg-[#e64900]/10',    border: 'border-[#e64900]/20'    },
  SAT:  { color: 'text-yellow-400',  bg: 'bg-yellow-500/10',   border: 'border-yellow-500/20'   },
  SWAP: { color: 'text-blue-400',    bg: 'bg-blue-500/10',     border: 'border-blue-500/20'     },
  BLUE: { color: 'text-[#0577c0]',   bg: 'bg-[#0577c0]/10',    border: 'border-[#0577c0]/20'    },
  PEPE: { color: 'text-[#4c9641]',   bg: 'bg-[#4c9641]/10',    border: 'border-[#4c9641]/20'    },
  UNGA: { color: 'text-[#b85c1b]',   bg: 'bg-[#b85c1b]/10',    border: 'border-[#b85c1b]/20'    },
  MCHAD: { color: 'text-[#75bbdf]', bg: 'bg-white/5', border: 'border-transparent',
    gradient: ['#75bbdf80','#a260f980','#d15ba480','#e7595380','#e9764780','#e8ad5580','#e9d56880'] },
};

const TOKEN_CONFIG_BY_ADDRESS: Record<string, { color: string; bg: string; border: string; gradient?: string[] }> = {
  '0x6e48cb5d68ecf9802f7d3b4d44e51db1d513190960dc3b2b1d6d24196d1c9005': { color: 'text-[#4c9641]', bg: 'bg-[#4c9641]/10', border: 'border-[#4c9641]/20' },
  '0xe709ccf7532424262bcb200e9aae6908871bae2b91888215cdc1e02c5a626b2a': { color: 'text-gray-400', bg: 'bg-white/5', border: 'border-white/10' },
};

function getTokenConfig(symbol: string, tokenContract?: string) {
  if (tokenContract) {
    const byAddr = TOKEN_CONFIG_BY_ADDRESS[tokenContract.toLowerCase()];
    if (byAddr) return byAddr;
  }
  return TOKEN_CONFIG[symbol] ?? { color: 'text-dark-300', bg: 'bg-dark-700/30', border: 'border-dark-600/30' };
}

function getCardStyle(cfg: { bg: string; gradient?: string[] }): React.CSSProperties | undefined {
  if (!cfg.gradient) return undefined;
  const grad = cfg.gradient.join(', ');
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

interface TokenBreakdown {
  address: string; label: string; amount: number;
  type: 'wallet' | 'staked' | 'pending' | 'lp';
  tokenContract?: string;
}
interface TokenTotal {
  symbol: string; tokenContract?: string; total: number; breakdown: TokenBreakdown[];
}

function aggregateTokens(positions: Position[]): TokenTotal[] {
  const totals = new Map<string, { symbol: string; tokenContract?: string; total: number; breakdown: TokenBreakdown[] }>();
  const add = (walletAddr: string, symbol: string, amount: number, label: string, type: TokenBreakdown['type'], tokenContract?: string) => {
    if (!symbol || amount <= 0) return;
    const sym = symbol.toUpperCase();
    const mapKey = tokenContract ? tokenContract.toLowerCase() : sym;
    if (!totals.has(mapKey)) totals.set(mapKey, { symbol: sym, tokenContract, total: 0, breakdown: [] });
    const entry = totals.get(mapKey)!;
    entry.total += amount;
    entry.breakdown.push({ address: walletAddr, label, amount, type, tokenContract });
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
  for (const sym of TOKEN_ORDER) { for (const [, data] of totals) { if (data.symbol === sym) result.push({ symbol: sym, tokenContract: data.tokenContract, total: data.total, breakdown: data.breakdown }); } }
  for (const [, data] of totals) { if (!TOKEN_ORDER.includes(data.symbol)) result.push({ symbol: data.symbol, tokenContract: data.tokenContract, total: data.total, breakdown: data.breakdown }); }
  return result.filter(t => t.total > 0);
}

function groupByType(items: TokenBreakdown[]): { type: TokenBreakdown['type']; total: number }[] {
  const map = new Map<string, number>();
  for (const b of items) map.set(b.type, (map.get(b.type) ?? 0) + b.amount);
  const order: TokenBreakdown['type'][] = ['wallet', 'staked', 'lp', 'pending'];
  return order.filter(t => map.has(t)).map(t => ({ type: t, total: map.get(t)! }));
}

function fmt(n: number, symbol: string): string {
  const decimals = symbol === 'BTC' ? 8 : 4;
  if (n >= 1_000_000) return (n / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 2 }) + 'M';
  if (n >= 1_000)     return (n / 1_000).toLocaleString(undefined, { maximumFractionDigits: 2 }) + 'K';
  return n.toLocaleString(undefined, { maximumFractionDigits: decimals });
}

function SummaryCard({ t: tFn, cfg, t: _t, ...rest }: { t: ReturnType<typeof useTranslation>['t'] } & { cfg: ReturnType<typeof getTokenConfig> } & { tok: TokenTotal }) { return null; }

// Separate component to call hook properly
function SummaryCardItem({ tok }: { tok: TokenTotal }) {
  const { t } = useTranslation();
  const cfg = getTokenConfig(tok.symbol, tok.tokenContract);
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
  return (
    <div className={`rounded-xl border ${cfg.border} ${cfg.bg} p-4 flex flex-col gap-3`} style={getCardStyle(cfg)}>
      <div className="flex items-center gap-2">
        <div className={`w-9 h-9 rounded-full ${cfg.bg} border ${cfg.border} flex items-center justify-center shrink-0 overflow-hidden`}>
          <TokenIcon symbol={tok.symbol} contractAddress={tok.tokenContract} color={cfg.color} />
        </div>
        <div>
          <div className={`text-base font-bold ${cfg.color}`}>{fmt(tok.total, tok.symbol)}</div>
          <div className="text-xs text-dark-400">{tok.symbol}</div>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {groups.map(g => (
          <div key={g.type} className={`flex items-center gap-1 px-2 py-1 rounded-lg ${badgeCls[g.type] ?? 'bg-gray-500/20 text-gray-400'}`}>
            <span className="text-[10px] font-semibold">{badgeLabel[g.type] ?? g.type}</span>
            <span className="text-[10px] font-bold">{fmt(g.total, tok.symbol)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DetailCardItem({ tok, walletLabel }: { tok: TokenTotal; walletLabel: Map<string, string> }) {
  const { t } = useTranslation();
  const cfg = getTokenConfig(tok.symbol, tok.tokenContract);
  const walletMap = new Map<string, TokenBreakdown[]>();
  for (const b of tok.breakdown) {
    const key = b.address.toLowerCase();
    if (!walletMap.has(key)) walletMap.set(key, []);
    walletMap.get(key)!.push(b);
  }
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
  return (
    <div className={`rounded-xl border ${cfg.border} ${cfg.bg} flex flex-col gap-0 overflow-hidden`} style={getCardStyle(cfg)}>
      <div className={`flex items-center gap-2 px-4 py-3 border-b ${cfg.border}`}>
        <div className={`w-9 h-9 rounded-full ${cfg.bg} border ${cfg.border} flex items-center justify-center shrink-0 overflow-hidden`}>
          <TokenIcon symbol={tok.symbol} contractAddress={tok.tokenContract} color={cfg.color} />
        </div>
        <div className="flex-1">
          <div className={`text-base font-bold ${cfg.color}`}>{fmt(tok.total, tok.symbol)}</div>
          <div className="text-xs text-dark-400">
            {tok.symbol} {'·'} {walletMap.size === 1 ? t('totals.walletCount_one', { count: 1 }) : t('totals.walletCount_other', { count: walletMap.size })}
          </div>
        </div>
      </div>
      <div className="flex flex-col divide-y divide-dark-700/30">
        {Array.from(walletMap.entries()).map(([addrLow, items]) => {
          const label = walletLabel.get(addrLow) ?? (addrLow.slice(0, 8) + '\u2026');
          const groups = groupByType(items);
          const walletTotal = items.reduce((s, b) => s + b.amount, 0);
          return (
            <div key={addrLow} className="flex flex-col gap-1.5 px-3 py-2.5">
              <div className="flex items-center gap-1.5 mb-0.5">
                <Wallet className="w-3 h-3 text-brand-400 shrink-0" />
                <span className="text-[11px] font-semibold text-dark-200 truncate">{label}</span>
                <span className={`ml-auto text-[11px] font-bold ${cfg.color}`}>{fmt(walletTotal, tok.symbol)}</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {groups.map(g => (
                  <div key={g.type} className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md ${badgeCls[g.type] ?? 'bg-gray-500/20 text-gray-400'}`}>
                    <span className="text-[10px] font-semibold">{badgeLabel[g.type] ?? g.type}</span>
                    <span className="text-[10px] font-bold">{fmt(g.total, tok.symbol)}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface Props { positions: Position[] }

export function TokenTotalsCard({ positions }: Props) {
  const { t } = useTranslation();
  const totals     = aggregateTokens(positions);
  const savedAddrs = useAppStore((s) => s.addresses);
  const [detailMode, setDetailMode] = useState(false);

  if (totals.length === 0) return null;

  const walletLabel = new Map<string, string>();
  for (const a of savedAddrs) { walletLabel.set(a.address.toLowerCase(), a.label || a.address.slice(0, 8) + '\u2026'); }

  return (
    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
      className="col-span-full bg-dark-800/60 backdrop-blur-sm border border-dark-700/50 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-dark-300 uppercase tracking-wider">{t('totals.aggregateHoldings')}</h2>
        <button onClick={() => setDetailMode(v => !v)}
          title={detailMode ? t('totals.switchToSummary') : t('totals.switchToDetail')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
            detailMode ? 'bg-brand-500/20 border-brand-500/40 text-brand-400 hover:bg-brand-500/30' : 'bg-dark-700/40 border-dark-600/40 text-dark-400 hover:bg-dark-700/70 hover:text-dark-200'
          }`}>
          {detailMode ? <><LayoutGrid className="w-3.5 h-3.5" /> {t('totals.summary')}</> : <><LayoutList className="w-3.5 h-3.5" /> {t('totals.detail')}</>}
        </button>
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={detailMode ? 'detail' : 'summary'} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }}
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {totals.map(tok =>
            detailMode
              ? <DetailCardItem key={tok.tokenContract || tok.symbol} tok={tok} walletLabel={walletLabel} />
              : <SummaryCardItem key={tok.tokenContract || tok.symbol} tok={tok} />
          )}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
