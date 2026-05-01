/**
 * Unified token color system — single source of truth.
 *
 * Primary lookup: contract address (lowercase).
 * Fallback: symbol (uppercase).
 * Everything else falls back to a neutral gray.
 *
 * All rendering paths (card, chart, chip, filter) must import from this file
 * so that adding or changing a token color only requires editing this one place.
 */

import { BTC_NATIVE } from './coreTokens';
import { CONTRACTS } from '../api/opnet';

// ── Token color definition ──────────────────────────────────────────────────────

export interface TokenStyle {
  hex: string;        // raw hex color (no #) — used for inline styles, chart lines, badges
  color: string;      // Tailwind text class
  bg: string;         // Tailwind bg class
  border: string;     // Tailwind border class
  gradient?: string[]; // optional gradient stop array for MCHAD-style borders
}

const FALLBACK: TokenStyle = {
  hex: '#6b7280',
  color: 'text-dark-300',
  bg: 'bg-dark-700/30',
  border: 'border-dark-600/30',
};

// ── Address-keyed map (primary) ────────────────────────────────────────────────

const BY_ADDRESS: Record<string, TokenStyle> = {
  // ── Native BTC sentinel ───────────────────────────────────────────────────────
  [BTC_NATIVE]:                                              { hex: '#fb923c', color: 'text-orange-400',  bg: 'bg-orange-500/10',   border: 'border-orange-500/20' },

  // ── Core tokens ──────────────────────────────────────────────────────────────
  [CONTRACTS.MOTO_TOKEN.toLowerCase()]:  { hex: '#e0e0e0', color: 'text-white',        bg: 'bg-white/5',          border: 'border-white/20' },
  [CONTRACTS.PILL_TOKEN.toLowerCase()]:  { hex: '#e64900', color: 'text-[#e64900]',   bg: 'bg-[#e64900]/10',    border: 'border-[#e64900]/20' },
  [CONTRACTS.MCHAD_TOKEN.toLowerCase()]: { hex: '#75bbdf', color: 'text-[#75bbdf]', bg: 'bg-white/5', border: 'border-transparent', gradient: ['#75bbdf80','#a260f980','#d15ba480','#e7595380','#e9764780','#e8ad5580','#e9d56880'] },
  [CONTRACTS.PEPE_TOKEN.toLowerCase()]:   { hex: '#4c9641', color: 'text-[#4c9641]',   bg: 'bg-[#4c9641]/10',    border: 'border-[#4c9641]/20' },
  [CONTRACTS.UNGA_TOKEN.toLowerCase()]:   { hex: '#b85c1b', color: 'text-[#b85c1b]',   bg: 'bg-[#b85c1b]/10',    border: 'border-[#b85c1b]/20' },
  [CONTRACTS.BLUE_TOKEN.toLowerCase()]:   { hex: '#0577c0', color: 'text-[#0577c0]',   bg: 'bg-[#0577c0]/10',    border: 'border-[#0577c0]/20' },

  // ── Discovered tokens ────────────────────────────────────────────────────────
  [CONTRACTS.ICHI_TOKEN.toLowerCase()]:   { hex: '#f2c244', color: 'text-[#f2c244]',   bg: 'bg-[#f2c244]/10',    border: 'border-[#f2c244]/20' },
  [CONTRACTS.SAT_TOKEN.toLowerCase()]:    { hex: '#e36cff', color: 'text-[#e36cff]',   bg: 'bg-[#e36cff]/10',    border: 'border-[#e36cff]/20' },
  [CONTRACTS.SWAP_TOKEN.toLowerCase()]:   { hex: '#60a5fa', color: 'text-blue-400',    bg: 'bg-blue-500/10',     border: 'border-blue-500/20' },
  ['0xeb9471cb73645b273e39e249804b8b169f1529f56d690fc32acded7cd1ed54c1']: { hex: '#a78bfa', color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20' },

  // ── New freeMint tokens ─────────────────────────────────────────────────────────
  ['0x4df18fe2574f7fb93cc117b03b7a2463b050ecf19b07a170da2f1e3573ef2f65']: { hex: '#fbbf24', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  ['0x9e9478efe3e8ad0c6e706c292860988303552299ec4cd38d553ec964dddb4323']: { hex: '#38bdf8', color: 'text-sky-400', bg: 'bg-sky-500/10', border: 'border-sky-500/20' },
};


// ── Symbol-keyed fallback (when address is unavailable) ──────────────────────────

const BY_SYMBOL: Record<string, TokenStyle> = {
  BTC:   BY_ADDRESS[BTC_NATIVE],
  MOTO:  BY_ADDRESS[CONTRACTS.MOTO_TOKEN.toLowerCase()],
  PILL:  BY_ADDRESS[CONTRACTS.PILL_TOKEN.toLowerCase()],
  MCHAD: BY_ADDRESS[CONTRACTS.MCHAD_TOKEN.toLowerCase()],
  PEPE:  BY_ADDRESS[CONTRACTS.PEPE_TOKEN.toLowerCase()],
  UNGA:  BY_ADDRESS[CONTRACTS.UNGA_TOKEN.toLowerCase()],
  BLUE:  BY_ADDRESS[CONTRACTS.BLUE_TOKEN.toLowerCase()],
  ICHI:  BY_ADDRESS[CONTRACTS.ICHI_TOKEN.toLowerCase()],
  SAT:   BY_ADDRESS[CONTRACTS.SAT_TOKEN.toLowerCase()],
  SWAP:  BY_ADDRESS[CONTRACTS.SWAP_TOKEN.toLowerCase()],
  CATS:   BY_ADDRESS['0xeb9471cb73645b273e39e249804b8b169f1529f56d690fc32acded7cd1ed54c1'],
  ASTEROID: BY_ADDRESS['0x4df18fe2574f7fb93cc117b03b7a2463b050ecf19b07a170da2f1e3573ef2f65'],
  motodog:  BY_ADDRESS['0x9e9478efe3e8ad0c6e706c292860988303552299ec4cd38d553ec964dddb4323'],
};


/** Look up token style by contract address first.
 *  If an address is provided but not found, returns FALLBACK (gray) —
 *  this prevents unknown tokens with the same symbol from stealing a core token's color.
 *  Symbol fallback is only used when no address is available at all. */
export function getTokenStyle(address?: string, symbol?: string): TokenStyle {
  if (address) {
    const norm = address.toLowerCase();
    if (BY_ADDRESS[norm]) return BY_ADDRESS[norm];
    // Address provided but not found → don't fall back to symbol,
    // to prevent color collision (e.g. fake PEPE getting core PEPE's green)
    return FALLBACK;
  }
  // No address available → fall back to symbol lookup
  if (symbol) {
    const sym = symbol.toUpperCase();
    if (BY_SYMBOL[sym]) return BY_SYMBOL[sym];
  }
  return FALLBACK;
}

/** Convenience: just the hex color, for chart lines and badges. */
export function getTokenHex(address?: string, symbol?: string): string {
  return getTokenStyle(address, symbol).hex;
}

/** Convenience: just the Tailwind classes, for card styling. */
export function getTokenTailwind(address?: string, symbol?: string): { color: string; bg: string; border: string; gradient?: string[] } {
  const s = getTokenStyle(address, symbol);
  return { color: s.color, bg: s.bg, border: s.border, gradient: s.gradient };
}
