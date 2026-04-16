/**
 * MCHAD Client-Side Staking Reader
 *
 * Privacy-preserving replacement for:
 *   GET https://api.slowphie.com/custom/mchad/wallet/:address
 *
 * Flow:
 *   1. Fetch /custom/mchad/meta  (no wallet — static contract/selector data)
 *   2. Resolve btcAddress → mldsaHashedPublicKey via OPNet RPC (mainnet.opnet.org)
 *   3. Query MCHAD contracts directly via btc_call   (mainnet.opnet.org)
 *
 * The wallet address is NEVER sent to api.slowphie.com.
 */

import axios from 'axios';
import type { MchadWalletResponse } from './slowphie';

const OPNET_RPC  = 'https://mainnet.opnet.org/api/v1/json-rpc';
const SLOWPHIE_BASE_URL: string =
  (import.meta.env.VITE_SLOWPHIE_API_URL as string | undefined) ?? 'http://localhost:3001';
const META_URL   = `${SLOWPHIE_BASE_URL}/custom/mchad/meta`;
const TIMEOUT_MS = 10_000;

let _rpcId = 900_000; // high start — no clash with opnet.ts counter

// ── Meta cache (static contract/selector data — session-lived) ───────────────

interface MchadMeta {
  contracts: Record<string, string>;
  selectors: {
    perUser: Record<string, { selector: string; description?: string }>;
    global:  Record<string, { selector: string }>;
    op20:    Record<string, { selector: string }>;
  };
  decimals: Record<string, number>;
}

let _metaCache: MchadMeta | null = null;

async function fetchMeta(): Promise<MchadMeta> {
  if (_metaCache) return _metaCache;
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(META_URL, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`MCHAD meta HTTP ${res.status}`);
    _metaCache = (await res.json()) as MchadMeta;
    return _metaCache;
  } finally {
    clearTimeout(timer);
  }
}

// ── Binary / RPC helpers ─────────────────────────────────────────────────────

function b64ToBytes(b64: string): Uint8Array {
  try {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch { return new Uint8Array(0); }
}

function decodeBigInt(bytes: Uint8Array | null, offset = 0): bigint {
  if (!bytes || bytes.length < offset + 32) return 0n;
  let hex = '';
  for (let i = offset; i < offset + 32; i++)
    hex += bytes[i].toString(16).padStart(2, '0');
  return hex ? BigInt('0x' + hex) : 0n;
}

function fmtAmt(raw: bigint, decimals: number, precision = 6): string {
  if (raw === 0n) return '0';
  const d   = 10n ** BigInt(decimals);
  const int = raw / d;
  const frc = (raw % d).toString().padStart(decimals, '0').slice(0, precision);
  return `${int}.${frc}`.replace(/\.?0+$/, '') || '0';
}

/**
 * Low-level btc_call → raw response bytes.
 * Uses the same params format as the existing opnet.ts contractCall.
 */
async function rpcCall(to: string, calldata: string): Promise<Uint8Array | null> {
  try {
    const res = await axios.post(
      OPNET_RPC,
      { jsonrpc: '2.0', id: _rpcId++, method: 'btc_call', params: { to, calldata } },
      { timeout: TIMEOUT_MS },
    );
    const result = res.data?.result;
    if (!result || result.revert) return null;
    const raw: string = result.result;
    if (!raw) return null;
    return b64ToBytes(raw);
  } catch { return null; }
}

// ── Wallet key resolution ────────────────────────────────────────────────────

/**
 * Resolve a BTC address to its OPNet mldsaHashedPublicKey.
 * Request goes to mainnet.opnet.org — NOT to api.slowphie.com.
 */
async function resolveMldsaKey(btcAddress: string): Promise<{
  mldsaKey: string;
  p2op:     string | null;
} | null> {
  try {
    const res = await axios.post(
      OPNET_RPC,
      { jsonrpc: '2.0', id: _rpcId++, method: 'btc_publicKeyInfo', params: [[btcAddress]] },
      { timeout: TIMEOUT_MS },
    );
    const entry = res.data?.result?.[btcAddress];
    if (!entry?.mldsaHashedPublicKey) return null;
    return {
      mldsaKey: entry.mldsaHashedPublicKey as string,
      p2op:     (entry.p2op as string | undefined) ?? null,
    };
  } catch { return null; }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Privacy-preserving equivalent of fetchMchadPosition().
 *
 * Replaces: GET https://api.slowphie.com/custom/mchad/wallet/:address
 * With:     client-side btc_call queries to mainnet.opnet.org
 *
 * The returned shape is identical to MchadWalletResponse so callers
 * (usePositions.ts) need zero changes beyond the function name.
 */
export async function fetchMchadPositionClientSide(
  btcAddress: string,
): Promise<MchadWalletResponse | null> {
  try {
    // 1. Fetch static meta (no wallet sent to slowphie)
    const meta = await fetchMeta();
    const C = meta.contracts;
    const S = meta.selectors;
    const D = meta.decimals;

    const perUser = (name: string) => S.perUser[name]?.selector ?? '';
    const op20    = (name: string) => S.op20[name]?.selector ?? '';

    // Calldata builder: 0x + selector + optional key suffix
    const cd = (sel: string, key = '') => '0x' + sel + key;

    // 2. Resolve mldsaKey (sends address to mainnet.opnet.org ONLY)
    const keyInfo = await resolveMldsaKey(btcAddress);
    if (!keyInfo) return null;
    const { mldsaKey, p2op } = keyInfo;

    const mDec  = D['MCHAD']    ?? 8;
    const lpDec = D['MCHAD_LP'] ?? 18;

    // 3. Parallel fetch all per-user data (11 RPC calls, all to mainnet.opnet.org)
    const [
      mchadRaw,      mchadWeighted, mchadUnclaimed, mchadInfo,
      lpRaw,         lpWeighted,    lpUnclaimed,    lpInfo,
      mchadBalBytes, motoLpBalBytes, pillLpBalBytes,
    ] = await Promise.all([
      // MCHAD_STAKING per-user
      rpcCall(C['MCHAD_STAKING'], cd(perUser('STAKED_RAW'),      mldsaKey)),
      rpcCall(C['MCHAD_STAKING'], cd(perUser('STAKED_WEIGHTED'), mldsaKey)),
      rpcCall(C['MCHAD_STAKING'], cd(perUser('UNCLAIMED'),       mldsaKey)),
      rpcCall(C['MCHAD_STAKING'], cd(perUser('STAKE_INFO'),      mldsaKey)),
      // LP_STAKING per-user
      rpcCall(C['LP_STAKING'],    cd(perUser('STAKED_RAW'),      mldsaKey)),
      rpcCall(C['LP_STAKING'],    cd(perUser('STAKED_WEIGHTED'), mldsaKey)),
      rpcCall(C['LP_STAKING'],    cd(perUser('UNCLAIMED'),       mldsaKey)),
      rpcCall(C['LP_STAKING'],    cd(perUser('STAKE_INFO'),      mldsaKey)),
      // Token balances (OP-20 balanceOf)
      rpcCall(C['MCHAD_TOKEN'],   cd(op20('BALANCE_OF'), mldsaKey)),
      rpcCall(C['MCHAD_MOTO_LP'], cd(op20('BALANCE_OF'), mldsaKey)),
      rpcCall(C['MCHAD_PILL_LP'], cd(op20('BALANCE_OF'), mldsaKey)),
    ]);

    // 4. Decode MCHAD staking
    const mStakedRaw = decodeBigInt(mchadRaw);
    const mStakedW   = decodeBigInt(mchadWeighted);
    const mUnclaimed = decodeBigInt(mchadUnclaimed);
    // STAKE_INFO = [unlockTimestamp(32b), lockDuration(32b), multiplierBps(32b)]
    const mUnlock    = Number(decodeBigInt(mchadInfo,  0));
    const mLockDur   = Number(decodeBigInt(mchadInfo, 32));
    const mMultBps   = Number(decodeBigInt(mchadInfo, 64));

    // 5. Decode LP staking
    const lStakedRaw = decodeBigInt(lpRaw);
    const lStakedW   = decodeBigInt(lpWeighted);
    const lUnclaimed = decodeBigInt(lpUnclaimed);
    const lUnlock    = Number(decodeBigInt(lpInfo,  0));
    const lLockDur   = Number(decodeBigInt(lpInfo, 32));
    const lMultBps   = Number(decodeBigInt(lpInfo, 64));

    // 6. Decode balances
    const mchadBal  = decodeBigInt(mchadBalBytes);
    const motoLpBal = decodeBigInt(motoLpBalBytes);
    const pillLpBal = decodeBigInt(pillLpBalBytes);

    const fmtMult = (bps: number) =>
      bps > 0 ? (bps / 100).toFixed(2) + '×' : '1.00×';

    // 7. Return identical shape to MchadWalletResponse
    return {
      wallet: {
        btcAddress,
        mldsaHashedPublicKey: mldsaKey,
        p2op: p2op ?? '',
      },
      positions: [
        {
          contract:                  'MCHAD_STAKING',
          contractAddress:           C['MCHAD_STAKING'] ?? '',
          stakedSymbol:              'MCHAD',
          stakedFormatted:           fmtAmt(mStakedRaw, mDec),
          stakedWeightedFormatted:   fmtAmt(mStakedW,   mDec),
          unclaimedRewardsFormatted: fmtAmt(mUnclaimed, mDec),
          rewardSymbol:              'MCHAD',
          multiplierFormatted:       fmtMult(mMultBps),
          lockDuration:              mLockDur,
          unlockTimestamp:           mUnlock,
        },
        {
          contract:                  'LP_STAKING',
          contractAddress:           C['LP_STAKING'] ?? '',
          stakedSymbol:              'MCHAD/MOTO LP',
          stakedFormatted:           fmtAmt(lStakedRaw, lpDec),
          stakedWeightedFormatted:   fmtAmt(lStakedW,   lpDec),
          unclaimedRewardsFormatted: fmtAmt(lUnclaimed, mDec),
          rewardSymbol:              'MCHAD',
          multiplierFormatted:       fmtMult(lMultBps),
          lockDuration:              lLockDur,
          unlockTimestamp:           lUnlock,
        },
      ],
      balances: {
        mchadFormatted:       fmtAmt(mchadBal,  mDec),
        mchadMotoLpFormatted: fmtAmt(motoLpBal, lpDec),
        mchadPillLpFormatted: fmtAmt(pillLpBal, lpDec),
      },
    };
  } catch {
    return null;
  }
}
