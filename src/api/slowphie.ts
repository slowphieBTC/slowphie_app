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

export async function fetchTrackedTokens(): Promise<SlowphieTracksResponse> {
  const res = await fetchTimeout(`${BASE_URL}/tracks`);
  if (!res.ok) throw new Error(`Slowphie API HTTP ${res.status}`);
  return res.json() as Promise<SlowphieTracksResponse>;
}
