/**
 * Pure retry policy shared by the execution engine and its tests.
 * Transient gateway failures (rate limits, upstream 5xx, network resets) are
 * retried with exponential backoff and full jitter; deterministic failures
 * (bad request, missing credits, misconfiguration) fail fast.
 */

export const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 400;
const MAX_DELAY_MS = 5_000;

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

export function statusFromMessage(message: string): number | null {
  const match = /\((\d{3})\)/.exec(message) ?? /\b(\d{3})\b/.exec(message);
  return match ? Number(match[1]) : null;
}

export function isRetryable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const lower = message.toLowerCase();
  if (lower.includes("credits exhausted") || lower.includes("not configured")) return false;
  if (lower.includes("rate limit")) return true;
  if (lower.includes("timeout") || lower.includes("network") || lower.includes("fetch failed")) return true;
  const status = statusFromMessage(message);
  return status !== null && RETRYABLE_STATUS.has(status);
}

/** Exponential backoff with full jitter; `attempt` is 1-based. */
export function backoffDelayMs(attempt: number, random: () => number = Math.random): number {
  const ceiling = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** Math.max(0, attempt - 1));
  return Math.round(ceiling * (0.5 + random() * 0.5));
}

export async function withRetries<T>(
  fn: (attempt: number) => Promise<T>,
  options: { maxAttempts?: number; sleep?: (ms: number) => Promise<void> } = {},
): Promise<{ value: T; attempts: number }> {
  const maxAttempts = options.maxAttempts ?? MAX_ATTEMPTS;
  const sleep = options.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return { value: await fn(attempt), attempts: attempt };
    } catch (err) {
      lastError = err;
      if (attempt === maxAttempts || !isRetryable(err)) break;
      await sleep(backoffDelayMs(attempt));
    }
  }
  throw lastError;
}
