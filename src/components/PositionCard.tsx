import { motion } from 'framer-motion';
import { TrendingUp, Droplets, Wheat, ExternalLink, Copy, CheckCheck, Wallet, Tractor } from 'lucide-react';
import { useState } from 'react';
import type { Position, FarmInfo, LPUnderlying } from '../types';

// Token logo URLs
const TOKEN_ICONS: Record<string, string> = {
  PILL: 'https://raw.githubusercontent.com/btc-vision/contract-logo/main/contracts/op1sqz0f729q22dv6trrvhn9msl9enqqaazy5cjy4ej6.png',
  MOTO: 'https://raw.githubusercontent.com/btc-vision/contract-logo/main/contracts/op1sqrxd0p3kd234wc5n2z7pl4hs82y8kpk4fqj9h78a.png',
  BTC:  'https://raw.githubusercontent.com/btc-vision/contract-logo/main/contracts/bitcoin.png',
};

// Fallback badge colors for tokens without logo images
const TOKEN_COLORS: Record<string, string> = {
  SWAP:          'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30',
  'LP SWAP/MOTO':'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30',
  SAT:           'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30',
  BTC:           'bg-orange-500/20 text-orange-300 border border-orange-500/30',
};

const STAKING_ADDRESS = '0xab99e31ebb30b8e596d5be1bd1e501ee8e7b7e5ec9dc7ee880f4937b0c929dcb';

interface Props {
  position: Position;
  index?: number;
}

function truncate(addr: string) {
  if (addr.startsWith('0x')) return addr.slice(0, 8) + '...' + addr.slice(-6);
  if (addr.startsWith('bc1')) return addr.slice(0, 8) + '...' + addr.slice(-6);
  return addr.slice(0, 10) + '...';
}

function fmt(n: number): string {
  if (n === 0) return '\u2014';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000)    return (n / 1_000).toFixed(2) + 'K';
  return n.toFixed(4);
}

// ── Split LP Token Icon: two tokens, each showing half ────────────────
function SplitTokenIcon({ 
  leftUrl, leftAlt, rightUrl, rightAlt, size = 36 
}: { leftUrl: string; leftAlt: string; rightUrl: string; rightAlt: string; size?: number }) {
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <img
        src={leftUrl}
        alt={leftAlt}
        style={{
          position: 'absolute', top: 0, left: 0,
          width: size, height: size,
          borderRadius: 8,
          clipPath: 'inset(0 50% 0 0)',
          objectFit: 'cover',
        }}
      />
      <img
        src={rightUrl}
        alt={rightAlt}
        style={{
          position: 'absolute', top: 0, left: 0,
          width: size, height: size,
          borderRadius: 8,
          clipPath: 'inset(0 0 0 50%)',
          objectFit: 'cover',
        }}
      />
    </div>
  );
}

function copyToClipboard(text: string): void {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text: string): void {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    copyToClipboard(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="p-1 hover:text-brand-400 transition-colors"
      title="Copy full address"
    >
      {copied ? <CheckCheck className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

// Address row with copy
function AddressRow({ addr }: { addr: string }) {
  return (
    <div className="flex items-center gap-1 text-gray-600 text-xs">
      <button
        onClick={() => copyToClipboard(addr)}
        className="font-mono hover:text-brand-400 transition-colors cursor-pointer"
        title={addr}
      >{truncate(addr)}</button>
      <CopyButton text={addr} />
    </div>
  );
}

// ── Multi-view tab selector: Wallet + N farm tabs ─────────────────────
type ViewId = 'wallet' | number; // number = index into farms[]

function ViewTabs({ active, farms, onChange }: {
  active: ViewId;
  farms: FarmInfo[];
  onChange: (v: ViewId) => void;
}) {
  return (
    <div className="flex items-center bg-dark-800/60 rounded-lg p-0.5 gap-0.5">
      <button
        onClick={() => onChange('wallet')}
        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
          active === 'wallet'
            ? 'bg-yellow-500/20 text-yellow-300 shadow-sm'
            : 'text-gray-500 hover:text-gray-300'
        }`}
      >
        <Wallet className="w-3 h-3" />
        Wallet
      </button>
      {farms.map((farm, i) => (
        <button
          key={i}
          onClick={() => onChange(i)}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
            active === i
              ? 'bg-green-500/20 text-green-300 shadow-sm'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          <Tractor className="w-3 h-3" />
          {farm.farmName.length > 12 ? farm.farmName.slice(0, 10) + '...' : farm.farmName}
        </button>
      ))}
    </div>
  );
}

// ── Stake Card: MOTO staked in Staking contract -> BTC rewards ────────
function StakeCard({ pos }: { pos: Position }) {
  const rewards = pos.stakingRewards ?? [];
  const hasRewards = rewards.some(r => r.pending > 0);

  // Color per reward token
  const rewardColor: Record<string, string> = {
    MOTO: 'text-orange-400', PILL: 'text-purple-400',
    SAT: 'text-yellow-400', SWAP: 'text-cyan-400',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {TOKEN_ICONS.MOTO ? (
          <img src={TOKEN_ICONS.MOTO} alt="MOTO" className="w-8 h-8 rounded-lg" />
        ) : (
          <div className="w-8 h-8 bg-brand-500/20 rounded-lg flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-brand-400" />
          </div>
        )}
        <div>
          <div className="text-sm font-semibold text-white">{pos.label}</div>
          <div className="text-xs text-gray-500">MotoSwap Stake</div>
        </div>
        <span className="ml-auto badge bg-brand-500/20 text-brand-300 border border-brand-500/30 text-xs px-2 py-0.5 rounded-full">STAKE</span>
      </div>

      {/* Staked amount */}
      <div className="bg-dark-700/50 rounded-xl p-3">
        <div className="text-xs text-gray-500">Staked</div>
        <div className="mt-1 text-white font-semibold text-lg">{fmt(pos.amount)}</div>
        <div className="text-xs text-gray-600 mt-0.5">{pos.token}</div>
      </div>

      {/* Multi-token rewards */}
      {rewards.length > 0 && (
        <div>
          <div className="text-xs text-gray-500 mb-2">Pending Rewards</div>
          <div className="grid grid-cols-2 gap-2">
            {rewards.map((r) => (
              <div key={r.tokenAddress} className="bg-dark-700/50 rounded-xl p-3">
                <div className="flex items-center gap-1.5">
                  {TOKEN_ICONS[r.symbol] ? (
                    <img src={TOKEN_ICONS[r.symbol]} alt={r.symbol} className="w-4 h-4 rounded" />
                  ) : null}
                  <span className="text-xs text-gray-400">{r.symbol}</span>
                </div>
                <div className={`mt-1 font-semibold ${r.pending > 0 ? (rewardColor[r.symbol] ?? 'text-green-400') : 'text-gray-600'}`}>
                  {r.pending > 0 ? fmt(r.pending) : '—'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!hasRewards && rewards.length === 0 && (
        <div className="bg-dark-700/50 rounded-xl p-3 text-center text-xs text-gray-600">
          No pending rewards
        </div>
      )}

      <AddressRow addr={STAKING_ADDRESS} />
    </div>
  );
}

// ── Multi-Farm Card: Wallet + multiple farm views with tabs ───────────
function MultiViewCard({ pos }: { pos: Position }) {
  const farms = pos.farms ?? [];
  // Default to first farm with staked balance, else wallet
  const defaultView: ViewId = farms.findIndex(f => f.staked > 0) >= 0
    ? farms.findIndex(f => f.staked > 0)
    : 'wallet';
  const [view, setView] = useState<ViewId>(defaultView);

  const walletBal = pos.walletBalance ?? 0;
  const token     = pos.token;
  const iconUrl      = TOKEN_ICONS[token];
  const tokenBadgeCls = TOKEN_COLORS[token] ?? 'bg-gray-500/20 text-gray-300 border border-gray-500/30';

  // Current farm (if viewing a farm tab)
  const activeFarm: FarmInfo | null = typeof view === 'number' ? (farms[view] ?? null) : null;
  // Current contract to show
  const displayAddr = activeFarm ? activeFarm.farmContract : pos.contractAddress;
  // Current link
  const link = activeFarm ? activeFarm.farmLink
    : pos.type === 'stake' ? 'https://motoswap.org/stake'
    : 'https://motoswap.org';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        {iconUrl ? (
          <img src={iconUrl} alt={token} className="w-8 h-8 rounded-lg" />
        ) : token === 'SAT' ? (
          <div className="w-8 h-8 bg-yellow-500/20 rounded-lg flex items-center justify-center border border-yellow-500/30">
            <span className="text-yellow-300 font-bold text-sm">S</span>
          </div>
        ) : token === 'SWAP' ? (
          <div className="w-8 h-8 bg-cyan-500/20 rounded-lg flex items-center justify-center border border-cyan-500/30">
            <span className="text-cyan-300 font-bold text-xs">SW</span>
          </div>
        ) : token === 'LP SWAP/MOTO' ? (
          <div className="w-8 h-8 bg-indigo-500/20 rounded-lg flex items-center justify-center border border-indigo-500/30">
            <Droplets className="w-4 h-4 text-indigo-300" />
          </div>
        ) : (
          <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center">
            <Wheat className="w-4 h-4 text-green-400" />
          </div>
        )}
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white">{token}</div>
          <div className="text-xs text-gray-500 truncate">
            {activeFarm ? `${activeFarm.farmName} · Pool #${activeFarm.poolId}` : 'Wallet Balance'}
          </div>
        </div>
      </div>

      {/* Tabs */}
      {farms.length > 0 && (
        <ViewTabs active={view} farms={farms} onChange={setView} />
      )}

      {/* Wallet view */}
      {view === 'wallet' && (
        <motion.div
          key="wallet"
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-3"
        >
          <div className="bg-dark-700/50 rounded-xl p-4">
            <div className="text-xs text-gray-500 mb-1">Wallet Balance</div>
            <div className="text-2xl font-bold text-white">{fmt(walletBal)}</div>
            <div className="text-xs text-gray-600 mt-0.5">{token}</div>
          </div>
          {pos.lpUnderlying && (pos.lpUnderlying.token0Amount > 0 || pos.lpUnderlying.token1Amount > 0) && (
            <LPUnderlyingGrid und={pos.lpUnderlying} />
          )}
          {farms.length === 0 && (
            <div className="text-xs text-gray-600 italic text-center">
              No farm positions detected
            </div>
          )}
          {farms.length > 0 && farms.every(f => f.staked === 0) && (
            <div className="text-xs text-gray-600 italic text-center">
              Not staked in any farm — switch tabs to see details
            </div>
          )}
        </motion.div>
      )}

      {/* Farm view */}
      {activeFarm && (
        <motion.div
          key={`farm-${view}`}
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-3"
        >
          {activeFarm.staked > 0 || activeFarm.pending > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-dark-700/50 rounded-xl p-3">
                <div className="text-xs text-gray-500">Already Staked</div>
                <div className="text-white font-semibold mt-1">{fmt(activeFarm.staked)}</div>
                <div className="text-xs text-gray-600 mt-0.5">{token}</div>
              </div>
              <div className="bg-dark-700/50 rounded-xl p-3">
                <div className="text-xs text-gray-500">Pending Harvest</div>
                <div className="text-green-400 font-semibold mt-1">{fmt(activeFarm.pending)}</div>
                <div className="text-xs text-gray-600 mt-0.5">{activeFarm.rewardToken}</div>
              </div>
            </div>
          ) : (
            <div className="bg-dark-700/30 rounded-xl p-4 text-center">
              <Tractor className="w-8 h-8 text-gray-600 mx-auto mb-2" />
              <div className="text-sm text-gray-500">No {token} staked</div>
              <div className="text-xs text-gray-600 mt-1">
                Deposit {token} to earn {activeFarm.rewardToken} rewards
              </div>
            </div>
          )}
          <div className="text-xs text-gray-600 text-center">
            {activeFarm.farmName} · Pool #{activeFarm.poolId}
          </div>
        </motion.div>
      )}

      <AddressRow addr={displayAddr} />

      {/* Bottom link */}
      <div className="pt-2 border-t border-dark-600/50">
        <a
          href={link}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 text-xs text-gray-600 hover:text-brand-400 transition-colors"
        >
          View on MotoSwap <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}

// ── Generic Farm Card (standalone farm pools) ─────────────────────────
function FarmCard({ pos }: { pos: Position }) {
  // If no poolId, this is a wallet-only token position (not a staked farm)
  const isWalletOnly = pos.poolId === undefined;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {TOKEN_ICONS[pos.token] ? (
          <img src={TOKEN_ICONS[pos.token]} alt={pos.token} className="w-8 h-8 rounded-lg" />
        ) : (
          <div className={`w-8 h-8 ${isWalletOnly ? 'bg-yellow-500/20' : 'bg-green-500/20'} rounded-lg flex items-center justify-center`}>
            {isWalletOnly
              ? <Wallet className="w-4 h-4 text-yellow-400" />
              : <Wheat  className="w-4 h-4 text-green-400" />}
          </div>
        )}
        <div>
          <div className="text-sm font-semibold text-white">{pos.label}</div>
          <div className="text-xs text-gray-500">
            {pos.poolId !== undefined ? `Pool #${pos.poolId}` : 'Wallet Balance'}
          </div>
        </div>
        <span className={`ml-auto badge text-xs px-2 py-0.5 rounded-full ${
          isWalletOnly
            ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
            : 'bg-green-500/20 text-green-300 border border-green-500/30'
        }`}>
          {isWalletOnly ? 'TOKEN' : 'FARM'}
        </span>
      </div>
      {isWalletOnly ? (
        <div className="bg-dark-700/50 rounded-xl p-3">
          <div className="text-xs text-gray-500">Wallet Balance</div>
          <div className="mt-1 text-white font-semibold text-lg">{fmt(pos.amount)}</div>
          <div className="text-xs text-gray-600 mt-0.5">{pos.token}</div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-dark-700/50 rounded-xl p-3">
            <div className="text-xs text-gray-500">Already Staked</div>
            <div className="mt-1 text-white font-semibold">{fmt(pos.amount)}</div>
            <div className="text-xs text-gray-600 mt-0.5">{pos.token}</div>
          </div>
          <div className="bg-dark-700/50 rounded-xl p-3">
            <div className="text-xs text-gray-500">Pending Harvest</div>
            <div className="mt-1 text-green-400 font-semibold">{fmt(pos.rewards)}</div>
            <div className="text-xs text-gray-600 mt-0.5">{pos.rewardToken ?? '\u2014'}</div>
          </div>
        </div>
      )}
      <AddressRow addr={pos.contractAddress} />
    </div>
  );
}



// ── LP Underlying breakdown (like staking rewards grid) ──────────────
function LPUnderlyingGrid({ und }: { und: LPUnderlying }) {
  const ICONS: Record<string, string> = {
    MOTO: 'https://raw.githubusercontent.com/btc-vision/contract-logo/main/contracts/op1sqrxd0p3kd234wc5n2z7pl4hs82y8kpk4fqj9h78a.png',
    PILL: 'https://raw.githubusercontent.com/btc-vision/contract-logo/main/contracts/op1sqz0f729q22dv6trrvhn9msl9enqqaazy5cjy4ej6.png',
    BTC:  'https://raw.githubusercontent.com/btc-vision/contract-logo/main/contracts/bitcoin.png',
  };
  const COLORS: Record<string, string> = {
    SWAP: 'text-cyan-300',
    MOTO: 'text-orange-400',
    PILL: 'text-purple-400',
    BTC:  'text-orange-400',
  };
  const tokens = [
    { symbol: und.token0Symbol, amount: und.token0Amount },
    { symbol: und.token1Symbol, amount: und.token1Amount },
  ];
  return (
    <div>
      <div className="text-xs text-gray-500 mb-2">Pool Composition</div>
      <div className="grid grid-cols-2 gap-2">
        {tokens.map((t) => (
          <div key={t.symbol} className="bg-dark-700/50 rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-1">
              {ICONS[t.symbol] ? (
                <img src={ICONS[t.symbol]} alt={t.symbol} className="w-4 h-4 rounded" />
              ) : null}
              <span className="text-xs text-gray-400">{t.symbol}</span>
            </div>
            <div className={`font-semibold text-sm ${t.amount > 0 ? (COLORS[t.symbol] ?? 'text-blue-400') : 'text-gray-600'}`}>
              {t.amount > 0 ? fmt(t.amount) : '—'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── LP Card ───────────────────────────────────────────────────────────
function LPCard({ pos }: { pos: Position }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {TOKEN_ICONS.MOTO && TOKEN_ICONS.PILL ? (
          <SplitTokenIcon
            leftUrl={TOKEN_ICONS.MOTO} leftAlt="MOTO"
            rightUrl={TOKEN_ICONS.PILL} rightAlt="PILL"
            size={36}
          />
        ) : (
          <div className="w-9 h-9 bg-blue-500/20 rounded-lg flex items-center justify-center">
            <Droplets className="w-4 h-4 text-blue-400" />
          </div>
        )}
        <div>
          <div className="text-sm font-semibold text-white">{pos.label}</div>
          <div className="text-xs text-gray-500">Liquidity Position</div>
        </div>
        <span className="ml-auto badge bg-blue-500/20 text-blue-300 border border-blue-500/30 text-xs px-2 py-0.5 rounded-full">LP</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-dark-700/50 rounded-xl p-3">
          <div className="text-xs text-gray-500">LP Tokens (Staked)</div>
          <div className="mt-1 text-white font-semibold">{fmt(pos.amount)}</div>
          <div className="text-xs text-gray-600 mt-0.5">{pos.token}</div>
        </div>
        <div className="bg-dark-700/50 rounded-xl p-3">
          <div className="text-xs text-gray-500">Pending Harvest</div>
          <div className="mt-1 text-blue-400 font-semibold">{fmt(pos.rewards)}</div>
          <div className="text-xs text-gray-600 mt-0.5">{pos.rewardToken ?? '\u2014'}</div>
        </div>
      </div>
      {pos.lpUnderlying && (pos.lpUnderlying.token0Amount > 0 || pos.lpUnderlying.token1Amount > 0) && (
        <LPUnderlyingGrid und={pos.lpUnderlying} />
      )}
      <AddressRow addr={pos.contractAddress} />
    </div>
  );
}

// ── Main Card Selector ────────────────────────────────────────────────
export function PositionCard({ position, index = 0 }: Props) {
  const isMulti  = position.hasFarmView === true;
  const isStake  = position.type === 'stake';
  const isLP     = position.type === 'lp';

  // Border color classes
  const borderClass = isMulti && position.token === 'PILL'
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

  // Get link for non-multi cards
  const simpleLink = isStake ? 'https://motoswap.org/stake'
    : isLP ? 'https://motoswap.org/pool'
    : 'https://motoswap.org';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
      className={`glass rounded-2xl p-5 bg-gradient-to-br ${borderClass} border transition-all duration-300 hover:-translate-y-0.5`}
    >
      {isMulti  ? <MultiViewCard pos={position} /> :
       isStake  ? <StakeCard     pos={position} /> :
       isLP     ? <LPCard        pos={position} /> :
                  <FarmCard      pos={position} />}

      {/* Non-multi cards get their own link footer */}
      {!isMulti && (
        <div className="mt-3 pt-3 border-t border-dark-600/50">
          <a
            href={simpleLink}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-xs text-gray-600 hover:text-brand-400 transition-colors"
          >
            View on MotoSwap <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}
    </motion.div>
  );
}
