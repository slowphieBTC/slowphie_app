import axios from 'axios';

const OPNET_RPC = 'https://mainnet.opnet.org/api/v1/json-rpc';

// ── Contract addresses ────────────────────────────────────────────────
export const CONTRACTS = {
  STAKING:      '0xab99e31ebb30b8e596d5be1bd1e501ee8e7b7e5ec9dc7ee880f4937b0c929dcb',
  PILL_FARM:    '0x3fb33dc12672aba975babfa8c0b400a3c86461d364861a7de50d20672cb1b80f',
  MOTO_TOKEN:   '0xc3d18f9d7db3f26ed107a9f4a4c65eef14c1ca73db5684ef9789fdd4fbb3ea9a',
  PILL_TOKEN:   '0xc6c3674b1c6c4ca3d4b3652d1d6fc2b197f45c4ad1eda90d37952472719d1c05',
  MOTO_PILL_LP: '0xf8bf27905acd0d440048d78c1512b468d3139495f6e72c14733813a065302031',
  SAT_TOKEN:    '0xb2d6af9d8e923ad794edaaf04bf0d3a4ac11b4302e009801f75ea7cd86de7035',
  SAT_FARM:     '0x22b1217f899b93db082d0634c167a744809d02b2a9ac46cd965706380350e0b1',
  SWAP_TOKEN:   '0xb4be035ad7e09d72b57ba5e1a28b70ec281991dab106833bd1a9e7642bb1f599',
  SWAP_FARM:    '0x96a7f30400afc8b56650c81b06634c1e7901917e45f16e3c03e6b3b658ce72f9',
  LP_SWMOTO:    '0x3146a9a820c3fc9b4df2ce52314e39ce39fa8bd3a1bb02ee747c20b642d5bf13',
} as const;

// ── Farm pool definitions (from getAllPools() WASM probe) ─────────────
// Pool 0 = BTC native, Pool 1 = PILL, Pool 2 = MOTO/PILL LP, Pool 3 = MOTO
export const FARM_POOLS = [
  { id: 0, name: 'BTC Farm (Native Stake)', symbol: 'BTC',      tokenContract: null,                   decimals: 8  },
  { id: 1, name: 'PILL Farm',               symbol: 'PILL',     tokenContract: CONTRACTS.PILL_TOKEN,   decimals: 18 },
  { id: 2, name: 'MOTO/PILL LP Farm',       symbol: 'MOTO-PILL',tokenContract: CONTRACTS.MOTO_PILL_LP, decimals: 18 },
  { id: 3, name: 'MOTO Farm',               symbol: 'MOTO',     tokenContract: CONTRACTS.MOTO_TOKEN,   decimals: 18 },
] as const;

// ── SAT Farm (Satoshi's Farm) pool definitions ────────────────────────
// Pool 0 = BTC native, Pool 1 = SAT, Pool 2 = MOTO, Pool 3 = PILL
// Reward token: SAT
export const SAT_FARM_POOLS = [
  { id: 0, name: 'BTC Farm',  symbol: 'BTC',  tokenContract: null,                   decimals: 8  },
  { id: 1, name: 'SAT Farm',  symbol: 'SAT',  tokenContract: CONTRACTS.SAT_TOKEN,    decimals: 18 },
  { id: 2, name: 'MOTO Farm', symbol: 'MOTO', tokenContract: CONTRACTS.MOTO_TOKEN,   decimals: 18 },
  { id: 3, name: 'PILL Farm', symbol: 'PILL', tokenContract: CONTRACTS.PILL_TOKEN,   decimals: 18 },
] as const;

// ── SWAP Farm pool definitions ────────────────────────────────────────
// Pool 0 = BTC, Pool 1 = SWAP, Pool 2 = MOTO, Pool 3 = PILL, Pool 4 = LP SWAP/MOTO
// Reward token: SWAP
export const SWAP_FARM_POOLS = [
  { id: 0, name: 'BTC Farm',          symbol: 'BTC',          tokenContract: null,                  decimals: 8  },
  { id: 1, name: 'SWAP Farm',         symbol: 'SWAP',         tokenContract: CONTRACTS.SWAP_TOKEN,  decimals: 18 },
  { id: 2, name: 'MOTO Farm',         symbol: 'MOTO',         tokenContract: CONTRACTS.MOTO_TOKEN,  decimals: 18 },
  { id: 3, name: 'PILL Farm',         symbol: 'PILL',         tokenContract: CONTRACTS.PILL_TOKEN,  decimals: 18 },
  { id: 4, name: 'LP SWAP/MOTO Farm', symbol: 'LP SWAP/MOTO', tokenContract: CONTRACTS.LP_SWMOTO,  decimals: 18 },
] as const;

// ── Hardcoded method selectors (verified via WASM bytecode analysis) ──
const SEL = {
  // OP20 token standard
  BALANCE_OF:           '5b46f8f6', // balanceOf(address) -> uint256

  // MotoStakingPool (STAKING)
  STAKING_BALANCE:      '5b46f8f6', // balanceOf(address) -> staked MOTO (uint256)
  STAKING_ENABLED_REWARDS: '2b2a5bb2', // enabledRewardTokens() -> address[]
  STAKING_PENDING:      '69c33076', // pendingReward(address,address) -> uint256 (user, rewardToken)

  // MotoSwap Pool (LP)
  GET_RESERVES:  '06374bfc', // getReserves() -> (uint256 reserve0, uint256 reserve1, uint64 ts)
  TOTAL_SUPPLY:  'a368022e', // totalSupply() -> uint256

  // MotoChef (PILL_FARM) — multi-pool farm
  // IMPORTANT: OPNet WASM uses COMPACT encoding:
  //   poolId = u32 (4 bytes big-endian), NOT u256 (32 bytes)
  //   address = raw 32 bytes (no padding)
  CHEF_USER_INFO:       '660c8839', // userInfo(u32 poolId, address) -> 48 bytes
  CHEF_PENDING_REWARD:  '120ca5c2', // pendingReward(u32 poolId, address) -> uint256

  // MotoChef BTC self-custody staking getters (only address arg)
  CHEF_STAKING_TXID:    'd19c8eca', // getStakingTxId(address) -> uint256 (BTC tx hash)
  CHEF_STAKING_INDEX:   '1b186438', // getStakingIndex(address) -> uint256 (UTXO output index)
};

let rpcId = 1;

// ── Encoding helpers ──────────────────────────────────────────────────
function encodeAddress(addr: string): string {
  const clean = addr.startsWith('0x') ? addr.slice(2) : addr;
  return clean.toLowerCase().padStart(64, '0');
}

/**
 * Encode a number as big-endian u32 (4 bytes / 8 hex chars).
 * OPNet WASM contracts use COMPACT encoding for integers — NOT u256.
 * Using u256 (32 bytes) for a u32 field shifts subsequent args by 28 bytes,
 * causing the contract to read garbage data and return 0.
 */
function encodeUint32(n: number): string {
  return n.toString(16).padStart(8, '0');
}

function base64ToBigInt(b64: string): bigint {
  try {
    const bin = atob(b64);
    let hex = '';
    for (let i = 0; i < bin.length; i++) hex += bin.charCodeAt(i).toString(16).padStart(2, '0');
    return hex ? BigInt('0x' + hex) : 0n;
  } catch { return 0n; }
}

function base64ToBytes(b64: string): Uint8Array {
  try {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch { return new Uint8Array(0); }
}

function bytesToBigInt(bytes: Uint8Array, offset = 0, length = 32): bigint {
  let hex = '';
  for (let i = offset; i < Math.min(offset + length, bytes.length); i++)
    hex += bytes[i].toString(16).padStart(2, '0');
  return hex ? BigInt('0x' + hex) : 0n;
}

// ── Low-level RPC call ────────────────────────────────────────────────
async function contractCall(to: string, selector: string, argsHex = ''): Promise<string | null> {
  const calldata = '0x' + selector + argsHex;
  try {
    const res = await axios.post(OPNET_RPC, {
      jsonrpc: '2.0', id: rpcId++,
      method: 'btc_call',
      params: { to, calldata },
    });
    const result = res.data?.result;
    if (!result) { return null; }
    if (result.revert) {
      try {
        const bin = atob(result.revert);
        const chars: string[] = [];
        for (let i = 0; i < bin.length - 1; i += 2) {
          const code = bin.charCodeAt(i) | (bin.charCodeAt(i+1) << 8);
          if (code >= 32 && code < 127) chars.push(String.fromCharCode(code));
        }
      } catch { }
      return null;
    }
    return result.result ?? null;
  } catch (e) {
    return null;
  }
}

async function contractCallUint256(to: string, selector: string, argsHex = ''): Promise<bigint> {
  const raw = await contractCall(to, selector, argsHex);
  if (!raw) return 0n;
  try { return base64ToBigInt(raw); } catch { return 0n; }
}

// ── Address resolution (bc1p → 0x OPNet address) ─────────────────────
export async function resolveToOpnetAddress(address: string): Promise<string> {
  if (address.startsWith('0x')) return address;
  try {
    const res = await axios.post(OPNET_RPC, {
      jsonrpc: '2.0', id: rpcId++,
      method: 'btc_publicKeyInfo',
      params: [[address]],
    });
    // Result is a dict keyed by address: { "bc1p...": { mldsaHashedPublicKey: "...", ... } }
    const result = res.data?.result;
    if (result && typeof result === 'object') {
      // Get entry for this address (or first value if dict)
      const entry = result[address] ?? Object.values(result)[0];
      if (entry && typeof entry === 'object') {
        const mldsa = (entry as Record<string, string>).mldsaHashedPublicKey ?? '';
        if (mldsa && mldsa.length === 64) {
          const resolved = '0x' + mldsa;
          return resolved;
        }
      }
    }
  } catch (err) {
  }
  // If resolution fails, return original - won't work for contract calls but won't crash
  return address;
}

// ── Token wallet balance ──────────────────────────────────────────────

// ── BTC self-custody stake lookup ─────────────────────────────────────
// When a user stakes BTC in Pool #0, the BTC moves to a self-custody UTXO.
// MotoChef stores txId + outputIndex pointing to that UTXO.
// We must fetch the UTXO value via btc_getTransaction.
async function getBTCStakedAmount(farmContract: string, userAddress: string): Promise<bigint> {
  const addrHex = encodeAddress(userAddress);
  const farmShort = farmContract.slice(0, 14);

  try {
    // Step 1: Get staking txId and index from MotoChef
    const [txIdRaw, indexRaw] = await Promise.all([
      contractCall(farmContract, SEL.CHEF_STAKING_TXID, addrHex),
      contractCall(farmContract, SEL.CHEF_STAKING_INDEX, addrHex),
    ]);


    if (!txIdRaw) {
      return 0n;
    }

    // Step 2: Decode txId bytes
    const txIdBytes = base64ToBytes(txIdRaw);

    if (txIdBytes.length === 0) return 0n;

    // Convert to hex (big-endian as stored)
    const txIdHexBE = Array.from(txIdBytes).map(b => b.toString(16).padStart(2, '0')).join('');
    // Bitcoin internally stores txids in little-endian; reverse for display/lookup
    const txIdHexLE = Array.from(txIdBytes).reverse().map(b => b.toString(16).padStart(2, '0')).join('');

    const txIdBig = txIdHexBE ? BigInt('0x' + txIdHexBE) : 0n;
    if (txIdBig === 0n) {
      return 0n;
    }

    // Decode index
    const indexBytes = base64ToBytes(indexRaw ?? '');
    const outputIndex = indexBytes.length > 0 ? Number(bytesToBigInt(indexBytes, 0, indexBytes.length)) : 0;


    // Step 3: Try fetching the transaction - try both endianness formats
    const hashesToTry = [
      '0x' + txIdHexLE.padStart(64, '0'),  // little-endian reversed (standard Bitcoin display)
      '0x' + txIdHexBE.padStart(64, '0'),  // big-endian as stored
    ];

    for (const txHash of hashesToTry) {
      try {
        const res = await axios.post(OPNET_RPC, {
          jsonrpc: '2.0', id: rpcId++,
          method: 'btc_getTransactionByHash',
          params: [txHash],
        });

        const tx = res.data?.result;
        if (!tx) continue;


        // Try outputs array (OPNet format)
        if (tx.outputs && Array.isArray(tx.outputs) && tx.outputs[outputIndex] !== undefined) {
          const val = tx.outputs[outputIndex];
          const satoshis = BigInt(val.value ?? val.amount ?? val.satoshis ?? 0);
          return satoshis;
        }

        // Try vout array (standard Bitcoin RPC format)
        if (tx.vout && Array.isArray(tx.vout) && tx.vout[outputIndex] !== undefined) {
          const vout = tx.vout[outputIndex];
          const btcVal = vout.value ?? vout.amount ?? 0;
          const satoshis = BigInt(Math.round(Number(btcVal) * 1e8));
          return satoshis;
        }

      } catch (e) {
      }
    }

    // Step 4: Fallback - try getUserInfo(0, user).amount directly as satoshis
    const compactArgs = encodeUint32(0) + addrHex;
    const rawInfo = await contractCall(farmContract, SEL.CHEF_USER_INFO, compactArgs);
    if (rawInfo) {
      const bytes = base64ToBytes(rawInfo);
      const amount = bytesToBigInt(bytes, 0, 32);
      if (amount > 0n) return amount;
    }

  } catch (e) {
  }
  return 0n;
}

export async function getTokenBalance(tokenContract: string, userAddress: string): Promise<bigint> {
  return contractCallUint256(tokenContract, SEL.BALANCE_OF, encodeAddress(userAddress));
}

// ── Main Staking: stake MOTO, earn multiple OP-20 rewards ─────────────
export interface StakingRewardToken {
  address: string;
  symbol:  string;
  pending: bigint;
}

export interface StakingInfo {
  stakedMoto:   bigint;
  rewardTokens: StakingRewardToken[];
}

// Known reward token names for display
const REWARD_TOKEN_NAMES: Record<string, string> = {
  [CONTRACTS.MOTO_TOKEN]:  'MOTO',
  [CONTRACTS.PILL_TOKEN]:  'PILL',
  [CONTRACTS.SAT_TOKEN]:   'SAT',
  [CONTRACTS.SWAP_TOKEN]:  'SWAP',
};

/** Decode enabledRewardTokens() response: 2-byte count + N*32-byte addresses */
function decodeAddressArray(b64: string): string[] {
  const raw = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  if (raw.length < 2) return [];
  const count = (raw[0] << 8) | raw[1];
  const addrs: string[] = [];
  for (let i = 0; i < count; i++) {
    const start = 2 + i * 32;
    if (start + 32 > raw.length) break;
    const hex = Array.from(raw.slice(start, start + 32))
      .map(b => b.toString(16).padStart(2, '0')).join('');
    addrs.push('0x' + hex);
  }
  return addrs;
}

export async function getStakingInfo(userAddress: string): Promise<StakingInfo> {
  const addr = encodeAddress(userAddress);

  // 1) Get staked MOTO balance
  const stakedMoto = await contractCallUint256(CONTRACTS.STAKING, SEL.STAKING_BALANCE, addr);

  // 2) Get enabled reward token addresses
  let rewardAddresses: string[] = [];
  try {
    const b64 = await contractCall(CONTRACTS.STAKING, SEL.STAKING_ENABLED_REWARDS);
    if (b64 && b64 !== 'AA==') {
      rewardAddresses = decodeAddressArray(b64);
    }
  } catch (e) {
  }

  // 3) For each reward token, get pending reward
  const rewardTokens: StakingRewardToken[] = await Promise.all(
    rewardAddresses.map(async (tokenAddr) => {
      const tokenHex = encodeAddress(tokenAddr);
      const pending = await contractCallUint256(
        CONTRACTS.STAKING,
        SEL.STAKING_PENDING,
        addr + tokenHex
      );
      const symbol = REWARD_TOKEN_NAMES[tokenAddr.toLowerCase()] ||
                     REWARD_TOKEN_NAMES[tokenAddr] || 'UNKNOWN';
      return { address: tokenAddr, symbol, pending };
    })
  );

  return { stakedMoto, rewardTokens };
}

// ── Farm pool positions ───────────────────────────────────────────────
export interface FarmUserInfo {
  poolId:        number;
  poolName:      string;
  symbol:        string;
  decimals:      number;
  tokenContract: string | null;
  staked:        bigint;
  pendingReward: bigint;
}

export async function getFarmUserInfo(poolId: number, userAddress: string): Promise<FarmUserInfo> {
  const pool = FARM_POOLS[poolId];

  // CRITICAL: OPNet WASM uses COMPACT encoding:
  //   poolId = u32 big-endian (4 bytes), NOT u256 (32 bytes)
  //   address = raw 32 bytes
  // Total args = 36 bytes (not 64!)
  const compactArgs = encodeUint32(poolId) + encodeAddress(userAddress);

  const [rawInfo, pending] = await Promise.all([
    contractCall(CONTRACTS.PILL_FARM, SEL.CHEF_USER_INFO, compactArgs),
    contractCallUint256(CONTRACTS.PILL_FARM, SEL.CHEF_PENDING_REWARD, compactArgs),
  ]);

  let staked = 0n;
  if (pool.id === 0) {
    // BTC Pool: self-custody UTXO — getUserInfo returns 0, use getStakingTxId+Index instead
    staked = await getBTCStakedAmount(CONTRACTS.PILL_FARM, userAddress);
  } else if (rawInfo) {
    const bytes = base64ToBytes(rawInfo);
    staked = bytesToBigInt(bytes, 0, 32); // first 32 bytes = amount staked
  }


  return {
    poolId,
    poolName:      pool.name,
    symbol:        pool.symbol,
    decimals:      pool.decimals,
    tokenContract: pool.tokenContract ?? null,
    staked,
    pendingReward: pending,
  };
}

export async function getAllFarmPositions(userAddress: string): Promise<FarmUserInfo[]> {
  return Promise.all(FARM_POOLS.map(p => getFarmUserInfo(p.id, userAddress)));
}

// ── SAT Farm (Satoshi's Farm) positions ────────────────────────────────
export interface SatFarmUserInfo {
  poolId:        number;
  poolName:      string;
  symbol:        string;
  decimals:      number;
  tokenContract: string | null;
  staked:        bigint;
  pendingReward: bigint;
}

export async function getSatFarmUserInfo(poolId: number, userAddress: string): Promise<SatFarmUserInfo> {
  const pool = SAT_FARM_POOLS[poolId];
  const compactArgs = encodeUint32(poolId) + encodeAddress(userAddress);

  const [rawInfo, pending] = await Promise.all([
    contractCall(CONTRACTS.SAT_FARM, SEL.CHEF_USER_INFO, compactArgs),
    contractCallUint256(CONTRACTS.SAT_FARM, SEL.CHEF_PENDING_REWARD, compactArgs),
  ]);

  let staked = 0n;
  if (pool.id === 0) {
    // BTC Pool: self-custody UTXO
    staked = await getBTCStakedAmount(CONTRACTS.SAT_FARM, userAddress);
  } else if (rawInfo) {
    const bytes = base64ToBytes(rawInfo);
    staked = bytesToBigInt(bytes, 0, 32);
  }


  return {
    poolId,
    poolName:      pool.name,
    symbol:        pool.symbol,
    decimals:      pool.decimals,
    tokenContract: pool.tokenContract ?? null,
    staked,
    pendingReward: pending,
  };
}

export async function getAllSatFarmPositions(userAddress: string): Promise<SatFarmUserInfo[]> {
  return Promise.all(SAT_FARM_POOLS.map(p => getSatFarmUserInfo(p.id, userAddress)));
}

// ── SWAP Farm positions ────────────────────────────────────────────────
export interface SwapFarmUserInfo {
  poolId:        number;
  poolName:      string;
  symbol:        string;
  decimals:      number;
  tokenContract: string | null;
  staked:        bigint;
  pendingReward: bigint;
}

export async function getSwapFarmUserInfo(poolId: number, userAddress: string): Promise<SwapFarmUserInfo> {
  const pool = SWAP_FARM_POOLS[poolId];
  const compactArgs = encodeUint32(poolId) + encodeAddress(userAddress);
  const [rawInfo, pending] = await Promise.all([
    contractCall(CONTRACTS.SWAP_FARM, SEL.CHEF_USER_INFO, compactArgs),
    contractCallUint256(CONTRACTS.SWAP_FARM, SEL.CHEF_PENDING_REWARD, compactArgs),
  ]);
  let staked = 0n;
  if (pool.id === 0) {
    // BTC Pool: self-custody UTXO
    staked = await getBTCStakedAmount(CONTRACTS.SWAP_FARM, userAddress);
  } else if (rawInfo) {
    const bytes = base64ToBytes(rawInfo);
    staked = bytesToBigInt(bytes, 0, 32);
  }
  return { poolId, poolName: pool.name, symbol: pool.symbol, decimals: pool.decimals, tokenContract: pool.tokenContract ?? null, staked, pendingReward: pending };
}

export async function getAllSwapFarmPositions(userAddress: string): Promise<SwapFarmUserInfo[]> {
  return Promise.all(SWAP_FARM_POOLS.map(p => getSwapFarmUserInfo(p.id, userAddress)));
}

// ── Format helper ─────────────────────────────────────────────────────
export function formatTokenAmount(raw: bigint, decimals: number): number {
  if (raw === 0n) return 0;
  if (decimals === 0) return Number(raw);
  // Split into integer + fractional parts to preserve precision for sub-1 values
  // e.g. 14850000 satoshis (0.1485 BTC) with decimals=8:
  //   intPart = 14850000n / 100000000n = 0n
  //   fracPart = 14850000n % 100000000n = 14850000n
  //   result = 0 + 14850000 / 100000000 = 0.1485  ✓
  const factor = 10n ** BigInt(decimals);
  const intPart = raw / factor;
  const fracPart = raw % factor;
  return Number(intPart) + Number(fracPart) / Number(factor);
}

// ── LP Pool: underlying token amounts for a user's LP position ────────
export interface LPUnderlying {
  token0Symbol: string;
  token1Symbol: string;
  token0Amount: number;
  token1Amount: number;
}

export async function getLPUnderlying(
  poolContract: string,
  token0Symbol: string,
  token0Decimals: number,
  token1Symbol: string,
  token1Decimals: number,
  userLPBalance: bigint,
): Promise<LPUnderlying> {
  const zero: LPUnderlying = { token0Symbol, token1Symbol, token0Amount: 0, token1Amount: 0 };
  if (userLPBalance === 0n) return zero;
  try {
    const [reservesRaw, totalSupplyRaw] = await Promise.all([
      contractCall(poolContract, SEL.GET_RESERVES),
      contractCallUint256(poolContract, SEL.TOTAL_SUPPLY),
    ]);
    if (!reservesRaw || totalSupplyRaw === 0n) return zero;
    // getReserves: reserve0 (uint256 = 32B) + reserve1 (uint256 = 32B) + timestamp
    const bytes = base64ToBytes(reservesRaw);
    const reserve0 = bytesToBigInt(bytes, 0, 32);
    const reserve1 = bytesToBigInt(bytes, 32, 32);
    const token0Amount = formatTokenAmount((userLPBalance * reserve0) / totalSupplyRaw, token0Decimals);
    const token1Amount = formatTokenAmount((userLPBalance * reserve1) / totalSupplyRaw, token1Decimals);
    return { token0Symbol, token1Symbol, token0Amount, token1Amount };
  } catch (e) {
    return zero;
  }
}
