/**
 * Slowphie Server API client
 * Base URL is set via VITE_SLOWPHIE_API_URL env var
 *  - dev:  http://localhost:3001  (CORS open for all localhost)
 *  - prod: set VITE_SLOWPHIE_API_URL in Vercel env vars
 */

export interface TrackedToken {
  id:           string;
  name:         string;
  symbol:       string;
  address:      string;
  decimals:     number;
  deployedAt:   number;
  isPool:       boolean;
  token0:       string | null;
  token1:       string | null;
  token0Symbol: string | null;
  token1Symbol: string | null;
  token0Name:   string | null;
  token1Name:   string | null;
  verified:     boolean;
  maxSupply:    string;
  totalSupply:  string;
  icon:         string;
  firstSeenAt:  number;
  updatedAt:    number;
}

export interface SlowphieTracksResponse {
  tokens:     TrackedToken[];
  pools:      TrackedToken[];
  total:      number;
  poolsTotal: number;
  fetchedAt:  number;
  nextScanAt: number;
}

// ── /farms endpoint types ────────────────────────────────────────────
export interface FarmPool {
  poolId:        number;
  tokenContract: string | null;
  symbol:        string;
  name:          string;
  decimals:      number;
  isLP:          boolean;
  token0:        string | null;
  token0Symbol:  string | null;
  token1:        string | null;
  token1Symbol:  string | null;
}

export interface Farm {
  id:           string;   // 'pill_farm' | 'sat_farm' | 'swap_farm'
  name:         string;
  address:      string;
  rewardToken:  string;
  rewardSymbol: string;
  pools:        FarmPool[];
}


export interface FarmsResponse {
  farms: Farm[];
}

// ── /status endpoint ────────────────────────────────────────────────
export interface StatusResponse {
  status:    string;
  uptime:    number;
  timestamp: number;
  scanner: {
    isRunning:    boolean;
    lastRunAt:    number;
    lastError:    string | null;
    totalScanned: number;
    uniqueTokens: number;
    lpTokens:     number;
  };
  farms: {
    total: number;
    list: Array<{
      id:         string;
      name:       string;
      poolCount:  number;
      pools:      Array<{ poolId: number; symbol: string; isLP: boolean }>;
    }>;
  };
  fetchedAt:  number;
  nextScanAt: number;
}
const BASE_URL: string =
  (import.meta.env.VITE_SLOWPHIE_API_URL as string | undefined) ?? 'http://localhost:3001';

const TIMEOUT_MS = 5_000;

async function fetchTimeout(url: string): Promise<Response> {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}


export async function fetchStatus(): Promise<StatusResponse> {
  const res = await fetchTimeout(`${BASE_URL}/status`);
  if (!res.ok) throw new Error(`Slowphie /status HTTP ${res.status}`);
  return res.json() as Promise<StatusResponse>;
}

export async function fetchTrackedTokens(): Promise<SlowphieTracksResponse> {
  const res = await fetchTimeout(`${BASE_URL}/tracks`);
  if (!res.ok) throw new Error(`Slowphie API HTTP ${res.status}`);
  return res.json() as Promise<SlowphieTracksResponse>;
}

export async function fetchFarms(): Promise<FarmsResponse> {
  const res = await fetchTimeout(`${BASE_URL}/farms`);
  if (!res.ok) throw new Error(`Slowphie /farms HTTP ${res.status}`);
  return res.json() as Promise<FarmsResponse>;
}

// ── MCHAD Custom Staking ─────────────────────────────────────────────
export interface MchadWalletResponse {
  wallet: { btcAddress: string; mldsaHashedPublicKey: string; p2op: string };
  positions: Array<{
    contract:                  string;
    contractAddress:           string;
    stakedSymbol:              string;
    stakedFormatted:           string;
    stakedWeightedFormatted:   string;
    unclaimedRewardsFormatted: string;
    rewardSymbol:              string;
    multiplierFormatted:       string;
    lockDuration:              number;
    unlockTimestamp:           number;
  }>;
  balances: {
    mchadFormatted:     string;
    mchadMotoLpFormatted: string;
    mchadPillLpFormatted: string;
  };
}

