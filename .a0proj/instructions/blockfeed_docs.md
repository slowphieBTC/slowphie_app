# Getting Started

BlockFeed is the indexed data layer for OPNet — the smart contract protocol built on Bitcoin. All endpoints are open during testnet with no API key required. Add `x-api-key: your-key` to your requests for higher rate limits once paid tiers launch.

## Quick health check
```
curl https://api.blockfeed.online/v1/status
```

## Rate Limits

| Tier | Limit | Key required |
|------|------|-------------|
| Public (testnet) | 120 req / min | No |
| Builder (soon) | 10,000 req / day | Yes |
| Pro (soon) | Unlimited | Yes |

## Address Formats

OPNet represents all addresses — both wallets and contracts — as `0x + 64 hex characters (32 bytes)`.

| Type | Format | Example |
|------|--------|--------|
| OPNet Contract | 0x + 64 hex | 0xfd4473840751d58d9f8b73bdd57d6c5260453d5518bd7cd02d0a4cf3df9bf4dd |
| OPNet Wallet | 0x + 64 hex | 0xda8cdc0186a09e263b3e30e6d0265d3ecf5de5d9be6baa524b037f3720652b1a |
| BTC Taproot | bc1p... | bc1p5cyxnux0whkpt88a3a4tus5vxjtp9rl5c9hkl04kq5... |
| TX Hash | 64 hex | ee4d6844b4235309ee30a20c81236dc3df5fb6d2... |

The API accepts all formats interchangeably.

---

## Keeper Program

Keepers are decentralized participants powering BlockFeed’s oracle and settlement layer.

### 1. Oracle Submission
Fetch BTC/USD prices, aggregate, sign with ed25519, submit on-chain.

### 2. Bet Settlement
Monitor OPBET markets and settle completed rounds.

---

## Run a Keeper

### Requirements
- Node.js 20+
- Funded Bitcoin taproot wallet
- Stable internet

### Install
```
npm install -g blockfeed-keeper
```

### Generate config
```
blockfeed-keeper init
```

### Start
```
blockfeed-keeper start
```

---

## Fees & Mempool

### GET /v1/fees/latest
Returns current Bitcoin fee rate.

Example:
```
curl https://api.blockfeed.online/v1/fees/latest
```

---

## Block Data

### GET /v1/blocks/latest
Latest indexed OPNet block.

---

## Contract Events

### GET /v1/events/recent
Most recent contract events.

---

## Token Registry

### GET /v1/tokens
All OP20 tokens.

---

## Price Oracle

### GET /v1/oracle/all
Latest prices for all symbols.

---

## Smart Contract Integration

Oracle contract:
```
0x4397befe4e067390596b3c296e77fe86589487bf3bf3f0a9a93ce794e2d78fb5
```

---

## Address Explorer

### GET /v1/address/:addr
Address overview.

---

## Transactions

### GET /v1/tx/:hash
Transaction details.

---

## Search

### GET /v1/search
Search across all entities.

---

## Analytics

### GET /v1/status
API health and stats.

---

## Real-time

### WebSocket
```
wss://api.blockfeed.online/v1/stream
```

---

## Webhooks (beta)

POST `/v1/webhooks`

Payload example:
```
{
  "event": "Transferred",
  "contract": "0xfd4473...",
  "block": 12410
}
```
