<div align="center">

<img src="public/SlowphieLogo.png" alt="Slowphie" width="80" />

# Slowphie

**Bitcoin DeFi companion app — built on OP_NET**

[![X](https://img.shields.io/badge/X-@SlowphieBTC-000000?style=flat&logo=x)](https://x.com/SlowphieBTC)
[![Telegram](https://img.shields.io/badge/Telegram-SlowphieChat-26A5E4?style=flat&logo=telegram)](https://t.me/SlowphieChat)
[![Bitcoin](https://img.shields.io/badge/Bitcoin-Mainnet-F7931A?style=flat&logo=bitcoin)](https://bitcoin.org)
[![OPNet](https://img.shields.io/badge/OPNet-L1%20Smart%20Contracts-b75be3?style=flat)](https://opnet.org)

</div>

---

## What is Slowphie?

Slowphie is a Bitcoin DeFi companion app powered by **OP_NET** — the only smart contract platform that runs natively on Bitcoin Layer 1, without bridges, without sidechains, and without custodians.

Three focused modules. One mission: **track, mint, and learn**.

> No account required. No bridge. No custody. Your keys, your Bitcoin.

---

## Modules

### 📊 Tracks — MotoSwap Position Tracker

<img src="public/OpStrat.png" alt="Tracks" width="120" />

Monitor all your **MotoSwap DeFi positions** across multiple Bitcoin wallets in real time — without connecting a wallet or giving up any custody.

**Features:**

- **Multi-wallet tracking** — Add any number of Bitcoin taproot (`bc1p...`) or OPNet (`0x...`) addresses and monitor all positions simultaneously
- **Position aggregation** — Tracks MOTO staking, BTC farms (PILL Farm, Satoshi's Farm, SWAP Farm), LP SWAP/MOTO positions, and raw token wallet balances
- **Token totals card** — Aggregates all token holdings across every tracked wallet for a complete portfolio snapshot at a glance
- **Live BTC price & block height** — Real-time data powered by the BlockFeed WebSocket stream, updating continuously
- **30s background refresh** — Position data refreshes silently every 30 seconds; navigating away and returning shows cached data instantly with no loading flash
- **Settings modal** — Add, label, edit, and remove tracked wallet addresses with a clean modal UI

**Technical specs:**

| | |
|---|---|
| Data source | OPNet Mainnet RPC + BlockFeed REST & WebSocket |
| Supported positions | Stake, BTC Farm, LP Farm, Token Wallet |
| Farms tracked | PILL Farm, Satoshi's Farm, SWAP Farm |
| Cache strategy | Zustand store — instant on return navigation |
| Custody | None — read-only, no wallet connection required |

---

### 🪙 Minter — OP-20 Token Minter

<img src="public/OpMinter.png" alt="Minter" width="120" />

Discover and mint **free OP-20 tokens** directly on Bitcoin's L1 smart contract platform. Some mintable tokens are not visible in MotoSwap's standard interface — Minter surfaces them for you.

**Features:**

- **Hidden gem detection** — Surfaces mintable OP-20 tokens that are hard or impossible to find through standard MotoSwap UI
- **One-click mint** — Connect your OP_WALLET browser extension and mint any available token with a single click
- **Supply progress bar** — Each token card displays total supply vs. circulating supply before you mint — know how scarce a token is in real time
- **Wallet balance display** — Your current holding for each token is shown in real time after connecting your wallet
- **Mint status feedback** — Clear transaction state display: idle → pending → confirmed, with full error handling
- **Wallet connection in AppBar** — OP_WALLET connect/disconnect button is available only on the Minter route, keeping the rest of the app clean

**Technical specs:**

| | |
|---|---|
| Protocol | OP-20 standard on OPNet — Bitcoin L1 smart contracts |
| Wallet required | OP_WALLET browser extension |
| Settlement | Direct Bitcoin L1 — no bridge, no sidechain |

---

### 🎓 School — Bitcoin & OPNet Learning Platform

<img src="public/OpSchool.png" alt="School" width="120" />

The **essential first step** before using Tracks or Minter. Bitcoin DeFi is technically complex — understanding the fundamentals protects your funds and sharpens every decision you make on-chain.

> Start here. The technology rewards those who understand it — and punishes those who don't.

**Features:**

- **7 progressive modules** — From Bitcoin UTXO basics to quantum-resistant cryptography; each module unlocks after passing the previous quiz with 50%+
- **35 quiz questions** — Real multiple-choice questions with detailed explanations for every answer
- **40+ glossary terms** — Fully searchable glossary of Bitcoin and DeFi terminology, defined in plain English, with an alphabet sidebar for quick navigation
- **Practical exercises** — Each module includes hands-on exercises with individual auto-saving answer fields — one textarea per exercise, saved locally
- **Progress persistence** — All quiz scores, completion states, and exercise answers are stored in `localStorage`; your progress survives page reloads and navigation
- **Progressive unlock system** — Modules lock until you complete the previous quiz (50%+ threshold), encouraging real learning over skipping
- **Score circle** — Animated SVG score visualization on quiz completion with pass/fail color coding

**Course curriculum:**

| Module | Topic |
|--------|-------|
| 1 | Bitcoin fundamentals — UTXO model, blocks, private keys |
| 2 | Why Bitcoin DeFi is different — ACS, bridges, custody risks |
| 3 | OPNet architecture — WASM contracts, Checksum Root, runtime |
| 4 | NativeSwap & MotoSwap — LP mechanics, price impact, slippage |
| 5 | Staking & farming on Bitcoin — epochs, reward distribution |
| 6 | CEX vs DEX — self-custody, key management, opsec |
| 7 | Quantum resistance — ML-DSA signatures, post-quantum Bitcoin |

**Technical specs:**

| | |
|---|---|
| Modules | 7 — Beginner to Advanced |
| Topics | UTXO, ACS, OPNet, NativeSwap, quantum, CEX vs DEX |
| Quiz threshold | 50%+ to unlock next module |
| Storage | localStorage — no account or server needed |
| Estimated time | ~7 hours total across all modules |

---

## Live data infrastructure

Slowphie pulls real-time data from two sources:

| Source | Used for |
|--------|----------|
| **OPNet Mainnet RPC** | Position data — staking, farming, LP, token balances |
| **BlockFeed REST API** | BTC price, latest block height, indexed contract events |
| **BlockFeed WebSocket** | Live stream — block updates, price ticks in real time |

---

## Tech stack

| Layer | Technology |
|-------|------------|
| Framework | React 18 + TypeScript |
| Build tool | Vite |
| Styling | Tailwind CSS + custom glassmorphism |
| Animations | Framer Motion |
| State management | Zustand |
| Wallet integration | @btc-vision/walletconnect |
| Blockchain | OPNet — Bitcoin L1 smart contracts |

---

## Community

- **X** — [@SlowphieBTC](https://x.com/SlowphieBTC)
- **Telegram** — [t.me/SlowphieChat](https://t.me/SlowphieChat)
- **GitHub** — [github.com/slowphieBTC/slowphie_app](https://github.com/slowphieBTC/slowphie_app)

---

<div align="center">

Built on OPNet &nbsp;·&nbsp; Bitcoin Mainnet &nbsp;·&nbsp; No bridges &nbsp;·&nbsp; No custody

</div>
