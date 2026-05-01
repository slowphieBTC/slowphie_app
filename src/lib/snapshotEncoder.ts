/**
 * Compact binary snapshot encoder/decoder.
 *
 * Wire format:
 *
 * ┌──────────────────────────────────────────────────────────────┐
 * │ HEADER  (8 bytes)                                            │
 * │  timestamp     : Uint32 (unix seconds)          → 4 bytes   │
 * │  btc_usd_cents : Uint32 (e.g. 8900000=$89k)     → 4 bytes   │
 * │                                                              │
 * │ MARKET PRICES  (1 + N×6 bytes)                               │
 * │  count         : Uint8                          → 1 byte     │
 * │  per entry:                                                  │
 * │    token_idx   : Uint8                          → 1 byte     │
 * │    price_btc   : Float32 (BTC per 1 token)      → 4 bytes   │
 * │    confidence  : Uint8  (0–100)                 → 1 byte     │
 * │                                                              │
 * │ BTC WALLETS  (1 + N×6 bytes)                                 │
 * │  count         : Uint8                          → 1 byte     │
 * │  per wallet:                                                 │
 * │    wallet_idx  : Uint8                          → 1 byte     │
 * │    sats        : Uint40 (max ~1099 BTC)         → 5 bytes   │
 * │                                                              │
 * │ TOKEN HOLDINGS  (2 + N×6 bytes)                              │
 * │  count         : Uint16                         → 2 bytes   │
 * │  per holding:                                                │
 * │    wallet_idx  : Uint8                          → 1 byte     │
 * │    token_idx   : Uint8                          → 1 byte     │
 * │    amount      : Float32 (token units)          → 4 bytes   │
 * └──────────────────────────────────────────────────────────────┘
 */

export interface PriceEntry {
  tokenIdx:   number;  // Uint8 index into token_index store
  priceBtc:   number;  // BTC per 1 token (routes[0].price — lowest/best price for buyer)
  confidence: number;  // 0–100 (from routes[0].confidence * 100)
}

export interface WalletEntry {
  walletIdx: number;  // Uint8 index into wallet_index store
  sats:      number;  // native BTC balance in satoshis
}

export interface HoldingEntry {
  walletIdx: number;  // Uint8
  tokenIdx:  number;  // Uint8
  amount:    number;  // token units (formatted, e.g. 1234.5678)
}

export interface SnapshotPayload {
  timestamp:  number;        // unix seconds
  btcUsdCents: number;       // BTC price in USD cents (e.g. 8_900_000 = $89,000)
  prices:     PriceEntry[];
  wallets:    WalletEntry[];
  holdings:   HoldingEntry[];
}

// ── Encode ───────────────────────────────────────────────────────────────────

export function encodeSnapshot(payload: SnapshotPayload): Uint8Array {
  const { timestamp, btcUsdCents, prices, wallets, holdings } = payload;

  const nPrices   = Math.min(prices.length, 255);
  const nWallets  = Math.min(wallets.length, 255);
  const nHoldings = Math.min(holdings.length, 65535);

  // byte sizes
  const headerSize   = 8;
  const pricesSize   = 1 + nPrices   * 6;
  const walletsSize  = 1 + nWallets  * 6;
  const holdingsSize = 2 + nHoldings * 6;
  const total        = headerSize + pricesSize + walletsSize + holdingsSize;

  const buf  = new ArrayBuffer(total);
  const view = new DataView(buf);
  let off = 0;

  // ── Header ──
  view.setUint32(off, Math.floor(timestamp));   off += 4;
  view.setUint32(off, Math.floor(btcUsdCents)); off += 4;

  // ── Market prices ──
  view.setUint8(off, nPrices); off += 1;
  for (let i = 0; i < nPrices; i++) {
    const p = prices[i];
    view.setUint8(off, p.tokenIdx);                     off += 1;
    view.setFloat32(off, p.priceBtc, false);            off += 4;
    view.setUint8(off, Math.round(p.confidence * 100)); off += 1;
  }

  // ── BTC wallets ──
  view.setUint8(off, nWallets); off += 1;
  for (let i = 0; i < nWallets; i++) {
    const w   = wallets[i];
    const sat = Math.floor(w.sats);
    // Uint40: split into high byte (bits 32–39) + low Uint32 (bits 0–31)
    const hi = Math.floor(sat / 0x1_0000_0000);
    const lo = sat >>> 0;  // force unsigned 32-bit
    view.setUint8(off, w.walletIdx); off += 1;
    view.setUint8(off, hi & 0xff);   off += 1;
    view.setUint32(off, lo, false);  off += 4;
  }

  // ── Token holdings ──
  view.setUint16(off, nHoldings, false); off += 2;
  for (let i = 0; i < nHoldings; i++) {
    const h = holdings[i];
    view.setUint8(off, h.walletIdx);           off += 1;
    view.setUint8(off, h.tokenIdx);            off += 1;
    view.setFloat32(off, h.amount, false);     off += 4;
  }

  return new Uint8Array(buf);
}

// ── Decode ───────────────────────────────────────────────────────────────────

export function decodeSnapshot(data: Uint8Array): SnapshotPayload {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let off = 0;

  // ── Header ──
  const timestamp   = view.getUint32(off, false); off += 4;
  const btcUsdCents = view.getUint32(off, false);  off += 4;

  // ── Market prices ──
  const nPrices = view.getUint8(off); off += 1;
  const prices: PriceEntry[] = [];
  for (let i = 0; i < nPrices; i++) {
    const tokenIdx   = view.getUint8(off);          off += 1;
    const priceBtc   = view.getFloat32(off, false); off += 4;
    const confidence = view.getUint8(off) / 100;    off += 1;
    prices.push({ tokenIdx, priceBtc, confidence });
  }

  // ── BTC wallets ──
  const nWallets = view.getUint8(off); off += 1;
  const wallets: WalletEntry[] = [];
  for (let i = 0; i < nWallets; i++) {
    const walletIdx = view.getUint8(off);                       off += 1;
    const hi        = view.getUint8(off);                       off += 1;
    const lo        = view.getUint32(off, false);               off += 4;
    const sats      = hi * 0x1_0000_0000 + (lo >>> 0);
    wallets.push({ walletIdx, sats });
  }

  // ── Token holdings ──
  const nHoldings = view.getUint16(off, false); off += 2;
  const holdings: HoldingEntry[] = [];
  for (let i = 0; i < nHoldings; i++) {
    const walletIdx = view.getUint8(off);           off += 1;
    const tokenIdx  = view.getUint8(off);           off += 1;
    const amount    = view.getFloat32(off, false);  off += 4;
    holdings.push({ walletIdx, tokenIdx, amount });
  }

  return { timestamp, btcUsdCents, prices, wallets, holdings };
}
