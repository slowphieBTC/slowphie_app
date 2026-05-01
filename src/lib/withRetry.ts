/**
 * Bounded retry wrapper for flaky RPC / network calls.
 *
 * Usage:
 *   const bal = await withRetry(() => getTokenBalance(addr, user), { fallback: 0n });
 *
 * Default: 1 retry, 250ms backoff (so total max attempts = 2). On final failure
 * the optional `fallback` is returned and the failure is counted via the
 * optional `onFail` callback (used by usePositions to track fetchHealth).
 */

export interface RetryOptions<T> {
  /** Number of retries AFTER the first attempt. Default 1 (so 2 attempts total). */
  retries?: number;
  /** Delay in ms before each retry. Default 250. */
  delayMs?: number;
  /** Value returned when every attempt failed. */
  fallback: T;
  /** Called once per call when ALL attempts failed. */
  onFail?: (err: unknown) => void;
  /** Optional label for logging — included in console warnings. */
  label?: string;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions<T>): Promise<T> {
  const retries = opts.retries ?? 1;
  const delayMs = opts.delayMs ?? 250;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        await sleep(delayMs);
      }
    }
  }
  if (opts.label && typeof console !== 'undefined') {
    // eslint-disable-next-line no-console
    console.warn(`[withRetry] ${opts.label} failed after ${retries + 1} attempts`, lastErr);
  }
  opts.onFail?.(lastErr);
  return opts.fallback;
}
