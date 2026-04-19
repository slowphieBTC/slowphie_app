/**
 * Core token classification.
 *
 * "Core" = tokens that are part of the default visible set on the
 * Aggregate Token Evolutions chart (shown by default).
 *
 * Default visible: BTC (native), MOTO, PILL, MCHAD, PEPE, UNGA, BLUE
 * + their LP pairs.
 *
 * "Discovered" = everything else — including SAT, SWAP, ICHI and
 * any token found by the /tracks scanner — hidden by default.
 */

import { CONTRACTS } from '../api/opnet';

/** Sentinel address for native BTC (not an OP-20 token, no contract address). */
export const BTC_NATIVE = '__btc_native__';

export const STATIC_CORE_ADDRESSES: ReadonlySet<string> = new Set(
  [
    // ── Native BTC (not an OP-20 token) ─────────────────────────────────
    BTC_NATIVE,
    // ── Core visible tokens ───────────────────────────────────────────
    CONTRACTS.MOTO_TOKEN,
    CONTRACTS.PILL_TOKEN,
    CONTRACTS.BLUE_TOKEN,
    CONTRACTS.PEPE_TOKEN,
    CONTRACTS.UNGA_TOKEN,
    CONTRACTS.MCHAD_TOKEN,
    // ── LP pairs involving only core tokens ───────────────────────────
    CONTRACTS.MOTO_PILL_LP,   // MOTO/PILL
    CONTRACTS.LP_PEPEMOTO,    // PEPE/MOTO
    CONTRACTS.LP_PEPEPILL,    // PEPE/PILL
    CONTRACTS.LP_UNGAPILL,    // UNGA/PILL
    CONTRACTS.LP_UNGAMOTO,    // UNGA/MOTO
    CONTRACTS.LP_BLUEPILL,    // BLUE/PILL
    CONTRACTS.LP_BLUEMOTO,    // BLUE/MOTO
    // ── MCHAD/MOTO custom staking LP ─────────────────────────────────
    '0xb0c47bdfabfc15772dc40b4e65e4ca3c3440229a580a4a792a2f01c32d6ec944',
  ].map(a => a.toLowerCase()),
);

// Tokens intentionally in "Discovered" (hidden by default):
//   SAT  — CONTRACTS.SAT_TOKEN
//   SWAP — CONTRACTS.SWAP_TOKEN
//   ICHI — CONTRACTS.ICHI_TOKEN
//   LP_SWMOTO   (SWAP/MOTO)
//   LP_ICHIPILL (ICHI/PILL)
//   LP_ICHIMOTO (ICHI/MOTO)

/** Returns true if the contract address belongs to the core visible set. */
export function isCore(address: string): boolean {
  return STATIC_CORE_ADDRESSES.has(address.toLowerCase());
}
