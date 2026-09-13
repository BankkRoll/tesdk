/**
 * @file Tuning the retry policy to the caller's latency budget.
 *
 * Prerequisites: none.
 */

import { TeslaClient, type RetryOptions } from '@bankkroll/tesdk'

/**
 * Retry policy for an interactive request path.
 *
 * One quick retry absorbs a single flaky hop; beyond that the user is better
 * served by an error they can act on than by a page that hangs.
 */
export const INTERACTIVE_RETRY: RetryOptions = {
  maxRetries: 1,
  initialDelayMs: 200,
  maxDelayMs: 1_000,
}

/**
 * Retry policy for a background job.
 *
 * Nobody is waiting, so the budget goes to durability. Backoff uses full
 * jitter, which is what stops a fleet-wide sweep from re-synchronizing into a
 * thundering herd after a shared outage.
 */
export const BACKGROUND_RETRY: RetryOptions = {
  maxRetries: 5,
  initialDelayMs: 1_000,
  maxDelayMs: 30_000,
}

/**
 * Builds a client for a user-facing request.
 *
 * @param accessToken - Bearer token.
 */
export function interactiveClient(accessToken: string): TeslaClient {
  return new TeslaClient({
    accessToken,
    retry: INTERACTIVE_RETRY,
    timeoutMs: 8_000,
  })
}

/**
 * Builds a client for a scheduled job.
 *
 * @param accessToken - Bearer token.
 */
export function backgroundClient(accessToken: string): TeslaClient {
  return new TeslaClient({
    accessToken,
    retry: BACKGROUND_RETRY,
    timeoutMs: 60_000,
  })
}

/**
 * Builds a client that never retries.
 *
 * The right choice behind an external idempotency key or an at-most-once queue,
 * where the caller owns retry semantics and a second attempt from underneath
 * would break its accounting.
 *
 * @param accessToken - Bearer token.
 */
export function noRetryClient(accessToken: string): TeslaClient {
  return new TeslaClient({ accessToken, retry: { maxRetries: 0 } })
}
