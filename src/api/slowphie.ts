/**
 * Slowphie Server API client
 * Base URL is set via VITE_SLOWPHIE_API_URL env var
 *  - dev:  http://localhost:3001  (CORS open for all localhost)
 *  - prod: set VITE_SLOWPHIE_API_URL in Vercel env vars
 */

// ── Feed types ──────────────────────────────────────────────────────
export interface OraclePrice {
  symbol: string;
  price: string;
  confidence: number;
  captured_at: string;
}

export interface LatestBlock {
  block_height: string;
  bitcoin_block_height: string;
  opnet_block_height: string;
  btc_tx_count: number;
  contract_calls: number;
  events_count: number;
  indexed_at: string;
}

export interface OracleResponse {
  ok: boolean;
  data: OraclePrice[];
}

export interface BlockResponse {
  ok: boolean;
  data: LatestBlock;
}


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
  swapMeta?: {
    routeCount: number;
    bestRouteTrust: string;
    lastRouteUpdate: number;
  };
  trust?: string;
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

export interface RouterTokensParams {
  search?: string;
  trust?: string;
  sort?: string;
  limit?: number;
  offset?: number;
}

export async function fetchRouterTokens(params?: RouterTokensParams): Promise<SlowphieTracksResponse> {
  const qs = new URLSearchParams();
  qs.set('onlyTokens', 'true');
  qs.set('swappable', 'true');
  qs.set('limit', String(params?.limit ?? 5000));
  qs.set('offset', String(params?.offset ?? 0));
  qs.set('sort', params?.sort ?? 'deployedAt_desc');
  if (params?.search) qs.set('search', params.search);
  if (params?.trust) qs.set('trust', params.trust);
  const url = `${BASE_URL}/tracks?${qs.toString()}`;
  const res = await fetchTimeout(url);
  if (!res.ok) throw new Error(`Slowphie /tracks router HTTP ${res.status}`);
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

// ── Feed endpoints (blocks & oracle) ────────────────────────────────

export async function fetchLatestBlock(): Promise<BlockResponse> {
  const res = await fetchTimeout(`${BASE_URL}/v1/blocks/latest`);
  if (!res.ok) throw new Error(`Slowphie /v1/blocks/latest HTTP ${res.status}`);
  return res.json() as Promise<BlockResponse>;
}

export async function fetchOraclePrices(): Promise<OracleResponse> {
  const res = await fetchTimeout(`${BASE_URL}/v1/oracle/all`);
  if (!res.ok) throw new Error(`Slowphie /v1/oracle/all HTTP ${res.status}`);
  return res.json() as Promise<OracleResponse>;
}

// ── /markets endpoint ────────────────────────────────────────────────
export interface MarketRoute {
  path:             string[];   // e.g. ["BTC", "BLUE", "MOTO"]
  price:            string;     // BTC per token (this route's price)
  feeAdjustedPrice: string;
  totalFeePct:      number;
  source:           string;     // "nativeswap" | "nativeswap+motoswap"
  confidence:       number;     // 1 = direct, 0.8 = via hop
  trust?:           string;     // "OK" | "WARNING" | "UNKNOWN"
  pathAddresses?:   string[];
  tokenTaxes?:      Array<{ symbol: string; address: string; taxPct: number; direction: string }>;
}

export interface MarketLastTrade {
  exchange:  string;
  token0:    string;
  token1:    string;
  amountIn:  string;
  amountOut: string;
  price:     string;
  timestamp: string;
  blockHeight?: string;
  trust?:     string;
}

export interface MarketData {
  id:         string;        // contract address (matches tokenContract in positions)
  name:       string;
  symbol:     string;
  /** Best-route price in BTC (routes[0].price = lowest/best price for buyer). "0" = no market */
  price:      string;
  marketcap:  string;        // in BTC
  lastTrade:  MarketLastTrade | null;
  routes:     MarketRoute[]; // sorted: routes[0] = lowest price (best for buyer)
  spread:     string;
  rawSpread:  string;
  arbitrage:  boolean;
}

export interface MarketsResponse {
  markets:       MarketData[];
  total:         number;
  fetchedAt:     number;     // Unix ms
  nextRefreshAt: number;     // Unix ms (~5 min refresh cycle)
}

export async function fetchMarkets(): Promise<MarketsResponse> {
  const res = await fetchTimeout(`${BASE_URL}/markets`);
  if (!res.ok) throw new Error(`Slowphie /markets HTTP ${res.status}`);
  return res.json() as Promise<MarketsResponse>;
}

export async function fetchMarketBySymbol(symbol: string): Promise<MarketData> {
  const res = await fetchTimeout(`${BASE_URL}/markets/${encodeURIComponent(symbol)}`);
  if (!res.ok) throw new Error(`Slowphie /markets/${symbol} HTTP ${res.status}`);
  return res.json() as Promise<MarketData>;
}

export async function fetchMarketByAddress(address: string): Promise<MarketData> {
  const res = await fetchTimeout(`${BASE_URL}/markets/${encodeURIComponent(address)}`);
  if (!res.ok) throw new Error(`Slowphie /markets/${address} HTTP ${res.status}`);
  return res.json() as Promise<MarketData>;
}

// ── Route & History endpoints ────────────────────────────────────────────────

export interface ArbitrageDetail {
  optimalBtcIn: string;
  optimalBtcInSats: string;
  estimatedProfitBtc: string;
  estimatedProfitSats: string;
  profitMarginPct: number;
  buyLeg: { path: string[]; source: string };
  sellLeg: { path: string[]; source: string };
  feasibility: string;
  queueImpactValidated: boolean;
  calculatedAt: string;
  totalTaxesApplied: Array<{ symbol: string; address: string; taxPct: number; direction: string }>;
}

export interface RouteDetail {
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  price: string;
  marketcap: string;
  buyTax: number;
  sellTax: number;
  spread: string;
  arbitrage: boolean;
  arbitrageDetail?: ArbitrageDetail;
  routes: MarketRoute[];
  lastTrade: MarketLastTrade | null;
}

export async function fetchTokenRoutes(address: string): Promise<RouteDetail> {
  const res = await fetchTimeout(`${BASE_URL}/routes/${encodeURIComponent(address)}`);
  if (!res.ok) throw new Error(`Slowphie /routes/${address} HTTP ${res.status}`);
  return res.json() as Promise<RouteDetail>;
}

export interface HistoryPoint {
  timestamp: number;
  bestPriceBtc: string;
  feeAdjustedPriceBtc: string;
  routeCount: number;
  bestRoutePath: string[];
  arbitrageSpreadPct?: number;
  estimatedLiquidityBtc: string;
}

export interface HistoryResponse {
  tokenAddress: string;
  interval: string;
  data: Array<{
    timestamp: number;
    open: string;
    high: string;
    low: string;
    close: string;
    volumeBtc: string;
  }> | HistoryPoint[];
}

export async function fetchTokenHistory(
  address: string,
  interval: string = '15m',
  from: string = '24h',
  ohlc: boolean = true
): Promise<HistoryResponse> {
  const url = `${BASE_URL}/history/${encodeURIComponent(address)}?interval=${interval}&from=${encodeURIComponent(from)}&ohlc=${ohlc}`;
  const res = await fetchTimeout(url);
  if (!res.ok) throw new Error(`Slowphie /history/${address} HTTP ${res.status}`);
  return res.json() as Promise<HistoryResponse>;
}

// ── Arbitrage endpoint ───────────────────────────────────────────────────────

export interface ArbitrageOpportunity {
  tokenAddress: string;
  tokenSymbol: string;
  detectedAt: number;
  blockHeight: string;
  spreadPct: number;
  buyRoute: { path: string[]; price: string };
  sellRoute: { path: string[]; price: string };
  feasibility: string;
  optimalSizeBtc?: string;
  expectedProfitBtc?: string;
  status: string;
}

export interface ArbitrageResponse {
  opportunities: ArbitrageOpportunity[];
  total: number;
  page: number;
  limit: number;
  offset: number;
}

export async function fetchArbitrageOpportunities(
  status: string = 'open',
  limit: number = 20
): Promise<ArbitrageResponse> {
  const url = `${BASE_URL}/arbitrage?status=${status}&limit=${limit}`;
  const res = await fetchTimeout(url);
  if (!res.ok) throw new Error(`Slowphie /arbitrage HTTP ${res.status}`);
  return res.json() as Promise<ArbitrageResponse>;
}
