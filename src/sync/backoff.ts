/**
 * Pure retry policy. No React Native imports so it can be unit tested in plain Node.
 */

export const MAX_ATTEMPTS = 6;
export const BASE_DELAY_MS = 2_000;
export const MAX_DELAY_MS = 60_000;

/**
 * Exponential backoff with "full jitter".
 * attempt is 1-based: the delay to wait after the Nth failed attempt.
 * random is injectable so tests are deterministic.
 */
export function backoffDelay(attempt: number, random: () => number = Math.random): number {
  const exp = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** Math.max(0, attempt - 1));
  // Never retry instantly: keep at least half the window, jitter the rest.
  return Math.round(exp / 2 + random() * (exp / 2));
}

export type FailureDecision =
  | { kind: 'retry'; nextAttemptAt: number }
  | { kind: 'give-up' };

/**
 * Decide what to do after a failed push.
 * Permanent errors (validation, 4xx) are not retried automatically.
 */
export function decideAfterFailure(
  attemptsSoFar: number,
  retryable: boolean,
  now: number,
  random: () => number = Math.random,
): FailureDecision {
  if (!retryable || attemptsSoFar >= MAX_ATTEMPTS) return { kind: 'give-up' };
  return { kind: 'retry', nextAttemptAt: now + backoffDelay(attemptsSoFar, random) };
}
