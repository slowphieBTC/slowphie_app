/**
 * useTokenVisibility — manages per-token chart visibility.
 *
 * Storage: localStorage key 'slowphie-token-visibility'
 * {
 *   showDiscovered: boolean,   // master toggle for discovered tokens (default: false)
 *   overrides: Record<address, boolean>  // per-token manual overrides
 * }
 *
 * Resolution logic:
 *   isVisible(address) = overrides[address] ?? (isCore(address) ? true : showDiscovered)
 */

import { useState, useCallback, useEffect } from 'react';
import { isCore, BTC_NATIVE } from '../lib/coreTokens';

const LS_KEY = 'slowphie-token-visibility';

interface VisibilityState {
  showDiscovered: boolean;
  overrides:      Record<string, boolean>;
}

const DEFAULT_STATE: VisibilityState = {
  showDiscovered: false,
  overrides:      {},
};

function loadState(): VisibilityState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<VisibilityState>;
    return {
      showDiscovered: parsed.showDiscovered ?? false,
      overrides:      parsed.overrides      ?? {},
    };
  } catch {
    return DEFAULT_STATE;
  }
}

function saveState(state: VisibilityState): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  } catch { /* quota exceeded — ignore */ }
}

// ── Token descriptor used by the filter panel UI ─────────────────────────────

export interface TokenVisibilityEntry {
  address:     string;
  symbol:      string;
  isCore:      boolean;
  isVisible:   boolean;    // resolved visibility
  isOverriden: boolean;    // has a manual override set
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useTokenVisibility() {
  const [state, setState] = useState<VisibilityState>(loadState);

  // Persist on every state change
  useEffect(() => { saveState(state); }, [state]);

  /** Resolve whether a given token contract address should appear on chart. */
  const isVisible = useCallback((address: string): boolean => {
    const norm = address.toLowerCase();
    if (norm in state.overrides) return state.overrides[norm];
    return isCore(norm) ? true : state.showDiscovered;
  }, [state]);

  /** Toggle a single token's visibility (sets override). */
  const toggleToken = useCallback((address: string) => {
    setState(prev => {
      const norm = address.toLowerCase();
      const currentlyVisible = isCore(norm)
        ? (prev.overrides[norm] ?? true)
        : (prev.overrides[norm] ?? prev.showDiscovered);
      return {
        ...prev,
        overrides: { ...prev.overrides, [norm]: !currentlyVisible },
      };
    });
  }, []);

  /** Toggle the master "show discovered" switch. Clears discovered overrides. */
  const toggleShowDiscovered = useCallback(() => {
    setState(prev => {
      const cleanedOverrides = Object.fromEntries(
        Object.entries(prev.overrides).filter(([addr]) => isCore(addr)),
      );
      return {
        showDiscovered: !prev.showDiscovered,
        overrides: cleanedOverrides,
      };
    });
  }, []);

  /** Reset all overrides and master toggle to defaults. */
  const reset = useCallback(() => {
    setState(DEFAULT_STATE);
  }, []);

  /**
   * Build a list of TokenVisibilityEntry from a token index list.
   * Always prepends BTC as a core entry since it's native (not in token_index).
   */
  const buildEntries = useCallback((
    tokenIndex: Array<{ address: string; symbol: string }>,
  ): TokenVisibilityEntry[] => {
    const entries: TokenVisibilityEntry[] = [];

    // Always include BTC as a core token (native, no contract address)
    const btcNorm = BTC_NATIVE; // already lowercase sentinel
    entries.push({
      address:     btcNorm,
      symbol:     'BTC',
      isCore:      true,
      isVisible:   btcNorm in state.overrides ? state.overrides[btcNorm] : true,
      isOverriden: btcNorm in state.overrides,
    });

    // Add all tokens from the index, skipping:
    //  - BTC_NATIVE itself (already manually prepended above)
    //  - any entry whose symbol is 'BTC' (stale pre-fix snapshots stored BTC
    //    under a staking contract address — consolidate all BTC under BTC_NATIVE)
    for (const t of tokenIndex) {
      const norm = t.address.toLowerCase();
      if (norm === BTC_NATIVE) continue;           // already prepended
      if (t.symbol.toUpperCase() === 'BTC') continue; // stale BTC entry → skip
      entries.push({
        address:     norm,
        symbol:      t.symbol,
        isCore:      isCore(norm),
        isVisible:   isVisible(norm),
        isOverriden: norm in state.overrides,
      });
    }

    // Sort: core tokens in fixed order, then remaining core (LPs) alpha, then discovered alpha
    const CORE_ORDER = ['BTC', 'MOTO', 'PILL', 'MCHAD', 'PEPE', 'UNGA', 'BLUE'];
    entries.sort((a, b) => {
      if (a.isCore !== b.isCore) return a.isCore ? -1 : 1;
      if (a.isCore && b.isCore) {
        const ai = CORE_ORDER.indexOf(a.symbol.toUpperCase());
        const bi = CORE_ORDER.indexOf(b.symbol.toUpperCase());
        if (ai !== -1 && bi !== -1) return ai - bi;  // both in fixed order
        if (ai !== -1) return -1;                     // a has fixed order, b doesn't
        if (bi !== -1) return 1;                      // b has fixed order, a doesn't
      }
      return a.symbol.localeCompare(b.symbol);        // discovered or remaining core: alpha
    });

    return entries;
  }, [isVisible, state.overrides]);

  return {
    showDiscovered:      state.showDiscovered,
    toggleShowDiscovered,
    isVisible,
    toggleToken,
    reset,
    buildEntries,
  };
}
