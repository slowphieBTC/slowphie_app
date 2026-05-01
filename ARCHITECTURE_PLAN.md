# Slowphie Architecture Plan v2.0
## MongoDB Storage Migration + WebSocket Subscriptions + /router & Route Popup Redesign

> **Status:** Planning Phase — No code changes yet  
> **Date:** 2026-04-23  
> **Scope:** Server storage layer, WebSocket protocol, /router page, Best Route Popup

---

## 1. Executive Summary

### Current Pain Points
| Issue | Impact |
|-------|--------|
| In-memory stores lost on restart | Cold-start penalty, no historical data |
| JSON file persistence | Race conditions, no querying, scaling limit |
| Broadcast-only WebSocket | All clients receive all events, wasted bandwidth |
| No per-token real-time updates | /router popup requires full REST refetch |
| No route history | Cannot show price charts, arbitrage trends |
| Static token metadata | No dynamic tax updates, trust scoring |

### Goals
1. **Persistent Storage:** MongoDB for all scanner, market, and route data
2. **Subscription WebSocket:** Clients subscribe to specific channels (token, address, global)
3. **Real-time Route Popup:** Live best-route updates with price impact visualization
4. **Historical Queries:** Time-series route prices, arbitrage history, volume tracking
5. **UI Modernization:** Virtualized lists, skeleton loading, optimistic updates

---

## 2. MongoDB Schema Design

### 2.1 Collections Overview

```
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│    tokens       │  │     pools       │  │     farms       │
│  (OP-20 tokens) │  │  (LP pair data) │  │  (MotoChef)     │
└────────┬────────┘  └────────┬────────┘  └────────┬────────┘
         │                    │                    │
         └────────────────────┼────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │   market_routes   │
                    │ (BFS route cache) │
                    └─────────┬─────────┘
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
┌────────▼────────┐  ┌────────▼────────┐  ┌────────▼────────┐
│ route_history   │  │ arbitrage_logs  │  │ price_ticks     │
│ (time-series)   │  │ (opportunities) │  │ (candle data)   │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

### 2.2 Detailed Schemas

#### `tokens` — OP-20 Token Registry
```typescript
interface TokenDoc {
  _id: string;                    // contract address
  symbol: string;
  name: string;
  decimals: number;
  totalSupply: string;            // bigint as string
  derivedId?: string;
  deployer?: string;
  createdAt: Date;                // deployment time
  firstSeenAt: Date;              // when scanner discovered it
  lastUpdatedAt: Date;
  
  // Dynamic metadata (updated per scan)
  taxProfile: {
    buyTaxPct: number;
    sellTaxPct: number;
    transferTaxPct: number;
  };
  trustScore: 'verified' | 'community' | 'warning' | 'unknown';
  trustReasons?: string[];        // why warning/unknown
  
  // Indexing
  tags: string[];                 // ['defi', 'meme', 'staking']
  iconUrl?: string;
  website?: string;
  socials?: { twitter?: string; telegram?: string; discord?: string };
  
  // Stats (computed)
  stats: {
    holderCount?: number;
    txCount24h?: number;
    volumeBtc24h?: string;
    marketCapBtc?: string;
  };
}

// Indexes:
// { symbol: 1, name: 'text' }          — search
// { trustScore: 1, createdAt: -1 }     — filtered listing
// { 'stats.marketCapBtc': -1 }         — market cap sort
// { createdAt: -1 }                    — new tokens
```

#### `pools` — MotoSwap LP Pools
```typescript
interface PoolDoc {
  _id: string;                    // pool contract address
  token0: string;                 // ref → tokens._id
  token1: string;                 // ref → tokens._id
  symbol: string;                 // e.g. "LP-MOTOBTC"
  
  // Reserves (updated per block)
  reserves: {
    reserve0: string;             // bigint string
    reserve1: string;
    blockTimestampLast: number;
    blockHeight: string;
    updatedAt: Date;
  };
  
  // Derived (computed on reserve update)
  tvlBtc?: string;
  volumeBtc24h?: string;
  feeApy?: number;
  
  // Farm linkage
  farmId?: number;                // MotoChef poolId if staked
  farmAllocPoints?: number;
}

// Indexes:
// { token0: 1, token1: 1 }            — pair lookup
// { 'reserves.blockHeight': -1 }      — latest per block
// { farmId: 1 }                        — farm-joined queries
```

#### `market_routes` — Current Best Routes (latest snapshot)
```typescript
interface MarketRouteDoc {
  _id: string;                    // "{fromToken}:{toToken}" e.g. "btc:moto"
  fromToken: string;              // "btc" or token address
  toToken: string;                // token address
  
  // All discovered routes (sorted by feeAdjustedPrice asc)
  routes: Array<{
    path: string[];               // ["btc", "moto", "pill"] symbol path
    pathAddresses: string[];      // contract addresses
    hops: Array<{
      dex: 'nativeswap' | 'motoswap';
      poolAddress?: string;
      tokenIn: string;
      tokenOut: string;
      feePct: number;
      buyTaxPct?: number;
      sellTaxPct?: number;
    }>;
    feeAdjustedPrice: string;     // price in BTC after all fees
    rawPrice: string;
    liquidityScore: number;       // 0-1 based on reserve depth
    estimatedSlippagePct: number; // for $1000 trade
  }>;
  
  // Best route summary
  bestRoute: MarketRouteDoc['routes'][0];
  bestRouteTrust: 'high' | 'medium' | 'low';
  
  // Arbitrage detection
  arbitrage: {
    exists: boolean;
    spreadPct: number;
    cheapestRouteIndex: number;
    expensiveRouteIndex: number;
    feasibility: 'profitable' | 'below-fees' | 'dust-profit' | 'liquidity-capped' | 'queue-impacted' | 'shared-pool';
    optimalSizeBtc?: string;
    expectedProfitBtc?: string;
  } | null;
  
  // Metadata
  blockHeight: string;
  computedAt: Date;
  routeCount: number;
  
  // TTL: auto-expire after 2 blocks if not refreshed
  expireAt: Date;
}

// Indexes:
// { toToken: 1 }                       — token lookup
// { 'arbitrage.exists': 1, 'arbitrage.spreadPct': -1 } — arb opportunities
// { computedAt: -1 }                   — recent first
// { expireAt: 1 }, { expireAfterSeconds: 0 } — TTL
```

#### `route_history` — Time-Series Route Prices
```typescript
interface RouteHistoryDoc {
  _id: ObjectId;
  tokenAddress: string;
  blockHeight: string;
  timestamp: Date;
  
  // Price data
  bestPriceBtc: string;
  bestPriceUsd?: string;          // using live BTC/USD
  feeAdjustedPriceBtc: string;
  
  // Route metadata at this point in time
  routeCount: number;
  bestRoutePath: string[];
  
  // Arbitrage snapshot
  arbitrageSpreadPct?: number;
  arbitrageFeasibility?: string;
  
  // Volume estimation
  estimatedLiquidityBtc: string;  // min reserve along best path
}

// Indexes:
// { tokenAddress: 1, timestamp: -1 }   — time-series per token
// { tokenAddress: 1, blockHeight: -1 } — block-aligned
// { timestamp: -1 }                    — global recent

// Use MongoDB Time-Series Collection for this:
// db.createCollection('route_history', { timeseries: { timeField: 'timestamp', metaField: 'tokenAddress', granularity: 'minutes' }})
```

#### `arbitrage_logs` — Detected Opportunities
```typescript
interface ArbitrageLogDoc {
  _id: ObjectId;
  tokenAddress: string;
  tokenSymbol: string;
  
  // Trigger condition
  detectedAt: Date;
  blockHeight: string;
  spreadPct: number;
  
  // Routes involved
  buyRoute: { path: string[]; price: string; };
  sellRoute: { path: string[]; price: string; };
  
  // Simulation results
  simulation: {
    feasibility: string;
    optimalSizeBtc: string;
    expectedProfitBtc: string;
    profitAfterFeesBtc: string;
    gasEstimateBtc: string;
  };
  
  // Resolution tracking
  status: 'open' | 'expired' | 'executed' | 'stale';
  expiredAt?: Date;
  resolvedAt?: Date;
  resolvedProfitBtc?: string;
}

// Indexes:
// { status: 1, detectedAt: -1 }        — active opportunities
// { tokenAddress: 1, detectedAt: -1 }  — per token history
```

#### `price_ticks` — OHLC Candles (for charts)
```typescript
interface PriceTickDoc {
  _id: ObjectId;
  tokenAddress: string;
  interval: '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
  timestamp: Date;                // interval start
  open: string;
  high: string;
  low: string;
  close: string;
  volumeBtc: string;
  routeCount: number;
}

// Time-series collection
// Indexes: { tokenAddress: 1, interval: 1, timestamp: -1 }
```

#### `farms` — MotoChef Farm Pools
```typescript
interface FarmDoc {
  _id: number;                    // poolId
  lpToken: string;                // ref → pools._id
  rewardToken: string;            // ref → tokens._id (usually MOTO)
  allocPoints: number;
  
  // Dynamic (per block)
  totalStaked: string;
  apr?: number;
  tvlBtc?: string;
  
  // Reward rate
  rewardPerBlock: string;
  lastRewardBlock: string;
  
  updatedAt: Date;
}
```

---

## 3. Server Architecture Changes

### 3.1 New Module Structure

```
src/
├── db/
│   ├── connection.ts             # MongoDB client singleton
│   ├── models/
│   │   ├── Token.ts              # TokenDoc model + queries
│   │   ├── Pool.ts               # PoolDoc model + queries
│   │   ├── MarketRoute.ts        # MarketRouteDoc model + queries
│   │   ├── RouteHistory.ts       # Time-series operations
│   │   ├── ArbitrageLog.ts       # Arb logging
│   │   ├── PriceTick.ts          # OHLC aggregation
│   │   └── Farm.ts               # Farm model
│   └── migrations/
│       └── 001_initial_indexes.ts
│
├── services/
│   ├── scanner.ts                # (existing) → writes to MongoDB
│   ├── poolDiscovery.ts          # (existing) → writes to MongoDB
│   ├── farmScanner.ts            # (existing) → writes to MongoDB
│   ├── marketBuilder.ts          # (existing) → writes routes to MongoDB
│   ├── arbitrageSimulator.ts     # (existing) → logs to MongoDB
│   ├──
│   ├── wsManager.ts              # REFACTORED — subscription channels
│   ├── wsChannels.ts             # NEW — channel definitions
│   ├── wsBroadcast.ts            # NEW — targeted broadcast helpers
│   ├──
│   ├── marketRefreshScheduler.ts # (existing) → triggers broadcasts
│   ├── discoveryScheduler.ts     # (existing)
│   ├── feedManager.ts            # (existing)
│   └── tickAggregator.ts         # NEW — builds OHLC from route_history
│
├── routes/                       # Fastify routes
│   ├── markets.ts                # GET /markets, /markets/:address
│   ├── tokens.ts                 # GET /tracks, /tracks/:address
│   ├── routes.ts                 # NEW — GET /routes/:token (best routes)
│   ├── history.ts                # NEW — GET /history/:token?interval=&from=&to
│   ├── arbitrage.ts              # NEW — GET /arbitrage?status=open
│   └── farms.ts                  # GET /farms
│
└── types/
    └── wsChannels.ts             # Channel type definitions
```

### 3.2 Storage Migration: In-Memory → MongoDB

| Current | New | Notes |
|---------|-----|-------|
| `tokenStore.ts` (in-memory Map) | `Token.ts` model | Upsert on scan, queryable |
| `marketStore.ts` (in-memory) | `MarketRoute.ts` model | TTL auto-cleanup |
| `farmStore.ts` (in-memory) | `Farm.ts` model | Per-block updates |
| `data/{network}/*.json` files | MongoDB collections | Eliminate file I/O |
| No history | `RouteHistory.ts` time-series | 15-min granularity default |
| No arbitrage log | `ArbitrageLog.ts` | Track opportunity lifecycle |
| No price charts | `PriceTick.ts` + aggregation | OHLC for any interval |

### 3.3 Scanner → MongoDB Write Pattern

```typescript
// Pseudo-code for scanner.ts migration

async function scanTokens() {
  const opscanTokens = await fetchOpscanTokens();
  
  for (const raw of opscanTokens) {
    const token = normalizeToken(raw);
    
    // Upsert into MongoDB (not in-memory)
    await TokenModel.findOneAndUpdate(
      { _id: token.address },
      { 
        $setOnInsert: { firstSeenAt: new Date() },
        $set: { 
          ...token,
          lastUpdatedAt: new Date(),
        }
      },
      { upsert: true }
    );
  }
  
  // Emit discovery_update with counts from DB
  const counts = await Promise.all([
    TokenModel.countDocuments(),
    PoolModel.countDocuments(),
    FarmModel.countDocuments(),
  ]);
  
  broadcastDiscoveryUpdate(...counts);
}
```

### 3.4 Market Builder → MongoDB + Broadcast

```typescript
// After BFS route discovery completes:

async function saveAndBroadcastRoutes(blockHeight: string) {
  const routes = computeAllRoutes();
  
  for (const [tokenAddr, routeData] of routes) {
    // 1. Upsert current best routes
    await MarketRouteModel.findOneAndUpdate(
      { toToken: tokenAddr },
      { $set: { ...routeData, blockHeight, computedAt: new Date(), expireAt: new Date(Date.now() + 2 * BLOCK_TIME_MS) } },
      { upsert: true }
    );
    
    // 2. Insert time-series point
    await RouteHistoryModel.insertOne({
      tokenAddress: tokenAddr,
      blockHeight,
      timestamp: new Date(),
      bestPriceBtc: routeData.bestRoute.feeAdjustedPrice,
      routeCount: routeData.routeCount,
      bestRoutePath: routeData.bestRoute.path,
      arbitrageSpreadPct: routeData.arbitrage?.spreadPct,
      estimatedLiquidityBtc: calculateLiquidity(routeData.bestRoute),
    });
    
    // 3. Broadcast to token-specific WebSocket channel
    broadcastToChannel(`token:${tokenAddr}`, {
      type: 'token_route_update',
      tokenAddress: tokenAddr,
      blockHeight,
      bestPrice: routeData.bestRoute.feeAdjustedPrice,
      routeCount: routeData.routeCount,
      arbitrage: routeData.arbitrage,
    });
  }
  
  // 4. Global market_update (existing behavior preserved)
  broadcastMarketUpdate(...);
}
```

---

## 4. WebSocket Protocol v2 — Subscription Channels

### 4.1 Problem with Current Protocol
- All clients receive all `market_update`, `block_update`, `discovery_update`
- No way for /router popup to get live updates for a specific token
- Bandwidth waste: mobile clients receive data for 100+ tokens they don't care about

### 4.2 New Protocol Design

#### Connection Flow
```
Client connects → receives connection_welcome
     ↓
Client sends subscribe message for channels
     ↓
Server confirms subscriptions
     ↓
Client receives only relevant events
```

#### Subscribe Message (client → server)
```json
{
  "type": "subscribe",
  "channels": ["global", "token:0xabc...", "arbitrage"],
  "clientId": "optional-uuid"
}
```

#### Subscribe Confirm (server → client)
```json
{
  "type": "subscribe_confirm",
  "channels": ["global", "token:0xabc...", "arbitrage"],
  "timestamp": 1745308912000
}
```

#### Unsubscribe Message
```json
{
  "type": "unsubscribe",
  "channels": ["token:0xabc..."]
}
```

### 4.3 Channel Definitions

| Channel | Pattern | Events | Use Case |
|---------|---------|--------|----------|
| `global` | fixed | `block_update`, `market_update`, `discovery_update` | Dashboard, stats bar |
| `token:{address}` | per token | `token_route_update`, `token_price_tick` | /router popup, token detail |
| `arbitrage` | fixed | `arbitrage_opportunity`, `arbitrage_resolved` | Arb monitor page |
| `portfolio:{address}` | per wallet | `portfolio_update` | OpStrat (future) |
| `pool:{address}` | per pool | `pool_reserve_update` | LP position tracking |

### 4.4 Event Payloads (New + Enhanced)

#### `token_route_update` (NEW)
```json
{
  "type": "token_route_update",
  "channel": "token:0xabc123...",
  "timestamp": 1745308915000,
  "blockHeight": "946181",
  "tokenAddress": "0xabc123...",
  "tokenSymbol": "MOTO",
  "data": {
    "bestPriceBtc": "0.00012345",
    "bestPriceUsd": "12.34",
    "routeCount": 4,
    "bestRoute": {
      "path": ["BTC", "MOTO"],
      "pathAddresses": ["btc", "0xabc123..."],
      "feeAdjustedPrice": "0.00012345",
      "estimatedSlippagePct": 0.12,
      "liquidityScore": 0.95
    },
    "allRoutes": [
      { "path": ["BTC", "MOTO"], "feeAdjustedPrice": "0.00012345", "dex": "nativeswap" },
      { "path": ["BTC", "PILL", "MOTO"], "feeAdjustedPrice": "0.00012500", "dex": "motoswap" }
    ],
    "arbitrage": {
      "exists": true,
      "spreadPct": 2.5,
      "feasibility": "profitable",
      "optimalSizeBtc": "0.5"
    }
  }
}
```

#### `token_price_tick` (NEW)
```json
{
  "type": "token_price_tick",
  "channel": "token:0xabc123...",
  "timestamp": 1745308915000,
  "tokenAddress": "0xabc123...",
  "interval": "15m",
  "ohlc": {
    "open": "0.00012000",
    "high": "0.00012500",
    "low": "0.00011900",
    "close": "0.00012345",
    "volumeBtc": "12.5"
  }
}
```

#### `arbitrage_opportunity` (NEW)
```json
{
  "type": "arbitrage_opportunity",
  "channel": "arbitrage",
  "timestamp": 1745308915000,
  "blockHeight": "946181",
  "opportunity": {
    "id": "arb_946181_moto",
    "tokenAddress": "0xabc123...",
    "tokenSymbol": "MOTO",
    "spreadPct": 3.2,
    "buyRoute": { "path": ["BTC", "MOTO"], "price": "0.00012000" },
    "sellRoute": { "path": ["MOTO", "PILL", "BTC"], "price": "0.00012384" },
    "feasibility": "profitable",
    "optimalSizeBtc": "1.0",
    "expectedProfitBtc": "0.032",
    "expiresAt": 1745309515000
  }
}
```

#### Enhanced `block_update`
```json
{
  "type": "block_update",
  "channel": "global",
  "timestamp": 1745308912000,
  "blockHeight": "946181",
  "btcTxCount": 3205,
  "contractCalls": 12,
  "eventsCount": 45,
  "marketRefreshMs": 245,        // NEW: how long market rebuild took
  "tokensPriced": 23             // NEW: included in this block's refresh
}
```

### 4.5 Server Implementation (wsManager.ts)

```typescript
// Channel subscription tracking
interface ClientState {
  socket: WebSocket;
  channels: Set<string>;
  subscribedTokens: Set<string>;
}

const clients = new Map<WebSocket, ClientState>();

function handleSubscribe(ws: WebSocket, channels: string[]) {
  const client = clients.get(ws);
  if (!client) return;
  
  for (const channel of channels) {
    client.channels.add(channel);
    
    // If token channel, add to index for fast broadcast
    if (channel.startsWith('token:')) {
      const tokenAddr = channel.slice(6);
      client.subscribedTokens.add(tokenAddr);
      tokenSubscribers.get(tokenAddr)?.add(ws) ?? tokenSubscribers.set(tokenAddr, new Set([ws]));
    }
  }
  
  ws.send(JSON.stringify({ type: 'subscribe_confirm', channels }));
}

function broadcastToChannel(channel: string, payload: object) {
  const message = JSON.stringify(payload);
  
  if (channel === 'global') {
    for (const [ws, client] of clients) {
      if (client.channels.has('global') && ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    }
  } else if (channel.startsWith('token:')) {
    const tokenAddr = channel.slice(6);
    const subs = tokenSubscribers.get(tokenAddr);
    if (subs) {
      for (const ws of subs) {
        if (ws.readyState === WebSocket.OPEN) ws.send(message);
      }
    }
  }
  // ... etc for other channels
}
```

---

## 5. /router Page Architecture

### 5.1 Current State
- Static grid of token cards
- Click icon → `TokenMarketPopup` (REST fetch once)
- No real-time updates
- No search/filter/sort
- Loads all tokens + pools at once

### 5.2 Proposed Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  OpRouter Page                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Search Bar + Filters + Sort                           │  │
│  │ [Search ___] [Trust ▼] [Sort: Mkt Cap ▼] [Tags ▼]   │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Live Stats Bar (WebSocket global)                     │  │
│  │ ● Live | Block 946181 | 23 priced | 3 arb | 162 tok   │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Virtualized Token Grid (React Window / Virtuoso)      │  │
│  │ ┌─────────┐ ┌─────────┐ ┌─────────┐                  │  │
│  │ │ MOTO    │ │ PILL    │ │ BLUE    │  ...             │  │
│  │ │ ₿0.0001 │ │ ₿0.0002 │ │ ₿0.0003 │                  │  │
│  │ │ +2.4%   │ │ -1.2%   │ │ +5.6%   │                  │  │
│  │ │ 4 routes│ │ 2 routes│ │ 1 route │                  │  │
│  │ └─────────┘ └─────────┘ └─────────┘                  │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ TokenMarketPopup (Modal) — see section 6              │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 5.3 Data Flow

```
Page Load:
  ├─→ REST GET /tracks?limit=50&sort=marketCap (initial)
  ├─→ REST GET /markets?includeStats=true (for prices)
  └─→ WS connect + subscribe "global"

User Scrolls (infinite scroll):
  └─→ REST GET /tracks?limit=50&offset=50&sort=marketCap

User Opens Token Popup:
  ├─→ WS subscribe "token:{address}"
  ├─→ REST GET /routes/{address} (full route detail)
  ├─→ REST GET /history/{address}?interval=15m&from=24h (chart data)
  └─→ Popup receives live WS updates for this token

User Closes Popup:
  └─→ WS unsubscribe "token:{address}"
```

### 5.4 New Components Needed

| Component | File | Purpose |
|-----------|------|---------|
| `TokenGrid` | `components/TokenGrid.tsx` | Virtualized grid with windowing |
| `TokenSearchBar` | `components/TokenSearchBar.tsx` | Search + filter + sort controls |
| `TokenCardV2` | `components/TokenCardV2.tsx` | Enhanced card with price change, sparkline |
| `PriceSparkline` | `components/PriceSparkline.tsx` | Mini chart from route_history |
| `TrustBadge` | `components/TrustBadge.tsx` | Verified/Warning/Unknown indicator |

### 5.5 Enhanced TokenCard Design

```
┌─────────────────────────────┐
│  ┌─────┐  MOTO      [Live] │
│  │icon │  MotoCoin   ●     │
│  └─────┘                 ▲  │
│  ┌──────────────────────┐│  │
│  │  mini sparkline      ││  │
│  │  ▁▂▄▆▇██▇▅▄▂▁       ││  │
│  └──────────────────────┘│  │
│  ₿ 0.00012345    +2.4% ▼  │
│  $12.34 USD               │
│  ─────────────────────────  │
│  4 routes · Liquidity: High │
│  [Explore] [Trade]          │
└─────────────────────────────┘
```

---

## 6. Best Route Popup Architecture

### 6.1 Current State
- `TokenMarketPopup` component
- Fetches data once on open
- Shows basic market info
- No route visualization
- No real-time updates

### 6.2 Proposed Architecture: `TokenRoutePopup`

```
┌─────────────────────────────────────────────────────────────────┐
│  MOTO Market Info                                    [X]        │
│  MotoCoin · 0xabc1...2345                     [View on Opscan]  │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  PRICE CHART (lightweight-charts)                       │   │
│  │  ┌─────────────────────────────────────────────────┐    │   │
│  │  │                                                 │    │   │
│  │  │  ▁▂▃▄▅▆▇██▇▆▅▄▃▂▁  ← 24h price history       │    │   │
│  │  │                                                 │    │   │
│  │  └─────────────────────────────────────────────────┘    │   │
│  │  1H   6H   24H   7D   ALL                              │   │
│  └─────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│  CURRENT PRICE                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  ₿ 0.00012345 BTC      $12.34 USD    ● Live (Block    │   │
│  │  946181)                                                │   │
│  │  Change: +2.4% (1h)  +5.1% (24h)  -1.2% (7d)         │   │
│  └─────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│  BEST ROUTE (Auto-selected)                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  BTC ──NativeSwap──► MOTO                               │   │
│  │  Fee: 0.2%  ·  Slippage: 0.12%  ·  Liquidity: 95%      │   │
│  │  [Copy Route] [Simulate $1000]                          │   │
│  └─────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│  ALL ROUTES (4)                                    [▼ Expand] │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  #  Path                    Price        Fee    Liquidity│   │
│  │  1  BTC → MOTO            0.00012345   0.2%    ████████│   │
│  │  2  BTC → PILL → MOTO     0.00012500   0.7%    ████     │   │
│  │  3  BTC → SAT → MOTO      0.00012700   0.7%    ██       │   │
│  │  4  BTC → BLUE → MOTO     0.00012900   0.7%    █        │   │
│  └─────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│  ARBITRAGE DETECTION                                            │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  ⚠️ Spread: 2.5% between routes 1 and 2                │   │
│  │  Feasibility: Profitable (optimal: 1.0 BTC)            │   │
│  │  Expected profit: 0.032 BTC (~$320)                    │   │
│  └─────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│  TOKEN STATS                                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Market Cap: $1.2M  ·  Holders: 1,234  ·  24h Vol:    │   │
│  │  $45K                                                   │   │
│  │  Tax: 0% buy / 0% sell / 0% transfer                    │   │
│  │  Trust: Verified ✓                                      │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 6.3 Data Sources

| Section | Source | Refresh |
|---------|--------|---------|
| Price Chart | GET /history/{token}?interval=15m&from=24h | On open |
| Current Price | WS `token_route_update` | Live |
| Best Route | WS `token_route_update` + GET /routes/{token} | Live + initial |
| All Routes | GET /routes/{token} | On open |
| Arbitrage | WS `token_route_update` (arbitrage field) | Live |
| Token Stats | GET /tracks/{token} | On open |

### 6.4 WebSocket Lifecycle for Popup

```typescript
// Pseudo-code for popup component

function TokenRoutePopup({ tokenAddress, onClose }) {
  const [routes, setRoutes] = useState(null);
  const [history, setHistory] = useState(null);
  const ws = useWebSocket();
  
  useEffect(() => {
    // 1. Subscribe to token channel
    ws.subscribe(`token:${tokenAddress}`);
    
    // 2. Fetch initial data
    Promise.all([
      fetchRoutes(tokenAddress),
      fetchHistory(tokenAddress, '15m', '24h'),
    ]).then(([routesData, historyData]) => {
      setRoutes(routesData);
      setHistory(historyData);
    });
    
    // 3. Listen for live updates
    const handler = (msg) => {
      if (msg.type === 'token_route_update' && msg.tokenAddress === tokenAddress) {
        setRoutes(msg.data);
      }
    };
    ws.on('token_route_update', handler);
    
    return () => {
      ws.unsubscribe(`token:${tokenAddress}`);
      ws.off('token_route_update', handler);
    };
  }, [tokenAddress]);
  
  return (
    <Modal>
      <PriceChart data={history} livePrice={routes?.bestPriceBtc} />
      <BestRouteCard route={routes?.bestRoute} />
      <RouteList routes={routes?.allRoutes} />
      {routes?.arbitrage?.exists && <ArbitrageAlert arb={routes.arbitrage} />}
      <TokenStats token={tokenAddress} />
    </Modal>
  );
}
```

---

## 7. REST API Changes

### 7.1 New Endpoints

#### `GET /routes/:tokenAddress`
Returns complete route data for a token (used by popup).

```json
{
  "tokenAddress": "0xabc123...",
  "tokenSymbol": "MOTO",
  "blockHeight": "946181",
  "computedAt": "2026-04-23T00:15:00Z",
  "bestRoute": { /* ... */ },
  "allRoutes": [ /* ... */ ],
  "arbitrage": { /* ... */ },
  "priceHistory24h": [
    { "timestamp": "2026-04-22T00:15:00Z", "priceBtc": "0.00012000" },
    /* ... 96 points for 15-min intervals */
  ]
}
```

#### `GET /history/:tokenAddress`
Time-series price data for charts.

Query params:
- `interval`: `1m` | `5m` | `15m` | `1h` | `4h` | `1d`
- `from`: ISO timestamp or relative (`1h`, `24h`, `7d`, `30d`, `all`)
- `to`: ISO timestamp (optional, default now)

```json
{
  "tokenAddress": "0xabc123...",
  "interval": "15m",
  "data": [
    { "timestamp": "2026-04-22T00:00:00Z", "open": "0.000119", "high": "0.000121", "low": "0.000118", "close": "0.000120", "volumeBtc": "2.5" },
    /* ... */
  ]
}
```

#### `GET /arbitrage`
List arbitrage opportunities.

Query params:
- `status`: `open` | `expired` | `all` (default `open`)
- `minSpread`: minimum spread % (default 1)
- `token`: filter by token address

```json
{
  "opportunities": [
    {
      "id": "arb_946181_moto",
      "tokenAddress": "0xabc123...",
      "tokenSymbol": "MOTO",
      "spreadPct": 3.2,
      "detectedAt": "2026-04-23T00:15:00Z",
      "expiresAt": "2026-04-23T00:25:00Z",
      "feasibility": "profitable",
      "optimalSizeBtc": "1.0",
      "expectedProfitBtc": "0.032"
    }
  ],
  "total": 3,
  "page": 1,
  "limit": 20
}
```

#### Enhanced `GET /tracks`
Add query params for server-side filtering/sorting:
- `search`: text search on symbol/name
- `trust`: `verified` | `community` | `warning` | `unknown`
- `sort`: `marketCap` | `price` | `createdAt` | `volume24h`
- `order`: `asc` | `desc`
- `limit`, `offset`: pagination
- `tags`: comma-separated tags

### 7.2 Modified Endpoints

| Endpoint | Change |
|----------|--------|
| `GET /markets` | Add `?includeHistory=true` to include 24h sparkline data |
| `GET /status` | Add MongoDB connection status, collection counts |
| `POST /tracks/scan` | Now triggers async scan, returns job ID |

---

## 8. UI Improvements Plan

### 8.1 Performance

| Improvement | Technique | Impact |
|-------------|-----------|--------|
| Virtualized grid | `react-window` or `@tanstack/react-virtual` | Render 50 items instead of 200+ |
| Skeleton loading | `framer-motion` skeletons | Perceived speed ↑ |
| Image lazy loading | `loading="lazy"` + blur placeholder | Initial paint ↓ |
| Route prefetch | Hover on card → prefetch `/routes/:addr` | Popup opens instantly |
| Debounced search | 300ms debounce on search input | Fewer API calls |

### 8.2 UX Enhancements

| Feature | Description |
|---------|-------------|
| **Live dot indicator** | Pulsing green dot on cards receiving WS updates |
| **Price change flash** | Brief green/red flash when price changes |
| **Copy route** | One-click copy optimal swap path to clipboard |
| **Route simulation** | "Simulate $1000" button showing expected output |
| **Arbitrage toast** | Global toast when new arb opportunity detected |
| **Keyboard nav** | `↑/↓` navigate cards, `Enter` open popup, `Esc` close |
| **Share route** | Generate shareable link to specific token's route |
| **Watchlist** | Star tokens to pin them to top (stored in localStorage) |

### 8.3 Design System Updates

```css
/* New design tokens */
--color-live: #4ade80;          /* pulsing green */
--color-arb: #f59e0b;           /* amber for arbitrage */
--color-route-ns: #3b82f6;      /* blue for NativeSwap */
--color-route-ms: #8b5cf6;      /* purple for MotoSwap */
--shadow-popup: 0 25px 50px -12px rgba(0,0,0,0.5);
--radius-popup: 16px;
```

---

## 9. Migration Plan

### Phase 1: MongoDB Foundation (Week 1)
- [ ] Set up MongoDB connection (`src/db/connection.ts`)
- [ ] Create all schema models with indexes
- [ ] Add migration script for initial indexes
- [ ] Add MongoDB to docker-compose (if applicable)
- [ ] Update `.env` with `MONGODB_URI`

### Phase 2: Storage Layer Migration (Week 1-2)
- [ ] Migrate `tokenStore.ts` → `TokenModel` (upsert on scan)
- [ ] Migrate `marketStore.ts` → `MarketRouteModel` (TTL)
- [ ] Migrate `farmStore.ts` → `FarmModel`
- [ ] Remove JSON file persistence
- [ ] Update `marketBuilder.ts` to write to MongoDB
- [ ] Update `arbitrageSimulator.ts` to log to MongoDB

### Phase 3: Historical Data (Week 2)
- [ ] Implement `RouteHistory` time-series writes
- [ ] Implement `PriceTick` OHLC aggregation (`tickAggregator.ts`)
- [ ] Backfill initial history from current market data
- [ ] Add `GET /history/:token` endpoint

### Phase 4: WebSocket v2 (Week 2-3)
- [ ] Refactor `wsManager.ts` with subscription support
- [ ] Implement channel definitions (`wsChannels.ts`)
- [ ] Add `token_route_update` broadcast in `marketBuilder.ts`
- [ ] Add `arbitrage_opportunity` broadcast
- [ ] Update `useSlowphieFeed` hook with subscribe/unsubscribe
- [ ] Create `useTokenChannel` hook for per-token subscriptions

### Phase 5: /router Page Redesign (Week 3-4)
- [ ] Create `TokenSearchBar` component
- [ ] Create virtualized `TokenGrid`
- [ ] Create `TokenCardV2` with sparkline + live indicator
- [ ] Add server-side filtering/sorting to `GET /tracks`
- [ ] Implement infinite scroll
- [ ] Add search + filter state to URL (`?search=moto&sort=marketCap`)

### Phase 6: Route Popup Redesign (Week 4)
- [ ] Create `TokenRoutePopup` (replace `TokenMarketPopup`)
- [ ] Integrate `lightweight-charts` for price history
- [ ] Add route visualization component
- [ ] Add arbitrage alert section
- [ ] Wire up `useTokenChannel` for live updates
- [ ] Add route simulation feature

### Phase 7: Polish & Testing (Week 5)
- [ ] Add skeleton loading states
- [ ] Add error boundaries
- [ ] Add E2E tests for /router flow
- [ ] Performance audit (Lighthouse)
- [ ] Mobile responsiveness pass
- [ ] Update i18n strings

---

## 10. File Change Summary

### New Files (Server)
```
src/db/connection.ts
src/db/models/Token.ts
src/db/models/Pool.ts
src/db/models/MarketRoute.ts
src/db/models/RouteHistory.ts
src/db/models/ArbitrageLog.ts
src/db/models/PriceTick.ts
src/db/models/Farm.ts
src/db/migrations/001_initial_indexes.ts
src/services/wsChannels.ts
src/services/wsBroadcast.ts
src/services/tickAggregator.ts
src/routes/routes.ts
src/routes/history.ts
src/routes/arbitrage.ts
src/types/wsChannels.ts
```

### Modified Files (Server)
```
src/services/wsManager.ts              # Major refactor
src/services/marketBuilder.ts          # Add DB writes + broadcast
src/services/marketRefreshScheduler.ts # Add targeted broadcast
src/services/scanner.ts                # Write to MongoDB
src/services/poolDiscovery.ts          # Write to MongoDB
src/services/farmScanner.ts            # Write to MongoDB
src/services/arbitrageSimulator.ts     # Log to MongoDB
src/routes/markets.ts                  # Add query params
src/routes/tokens.ts                   # Add query params
src/index.ts                           # Add DB connection startup
```

### New Files (UI)
```
src/components/TokenGrid.tsx
src/components/TokenSearchBar.tsx
src/components/TokenCardV2.tsx
src/components/PriceSparkline.tsx
src/components/TrustBadge.tsx
src/components/TokenRoutePopup.tsx
src/components/RouteVisualizer.tsx
src/components/ArbitrageAlert.tsx
src/components/SkeletonCard.tsx
src/hooks/useTokenChannel.ts
src/hooks/useTokenHistory.ts
src/hooks/useVirtualTokens.ts
```

### Modified Files (UI)
```
src/pages/OpRouter.tsx                 # Major refactor
src/components/TokenMarketPopup.tsx    # Deprecate → remove
src/api/slowphie.ts                    # Add new endpoints
src/hooks/useSlowphieFeed.ts           # Add subscribe/unsubscribe
src/store/index.ts                     # Add filter/sort state
```

---

## 11. Risk Assessment

| Risk | Mitigation |
|------|------------|
| MongoDB not available in current infra | Use Docker container locally; Atlas for prod |
| Cold start slower with DB | Keep in-memory cache layer; DB is source of truth |
| WebSocket subscriptions increase complexity | Start with global + token channels only |
| Time-series data volume | Use MongoDB TTL (90 days); aggregate to daily after 30d |
| Backward compatibility | Keep old WS events alongside new; deprecate gradually |
| Query performance | Pre-create all indexes; use explain() to verify |

---

## 12. Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Token list load time | ~2s (all tokens) | <500ms (first 50) |
| Popup open time | ~800ms | <200ms (prefetch) |
| Price update latency | 15-60s (poll) | <3s (WebSocket) |
| Time to interactive | ~4s | <2s |
| API bandwidth / client | ~50KB/min | ~5KB/min (subscriptions) |
| Historical data | None | 90 days |

---

*End of Architecture Plan v2.0*
