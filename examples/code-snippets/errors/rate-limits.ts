/**
 * @file Handling 429s and the `retryAfter` hint.
 *
 * Prerequisites: none.
 */

import { RateLimitError, TeslaClient, type Vehicle } from 'tesdk'

/**
 * Runs an operation, waiting out a rate limit once if one is hit.
 *
 * The client already retries 429s internally, honouring `Retry-After`. This
 * covers the case where the whole retry budget was spent and the limit is still
 * in force — typically a per-hour account quota rather than a burst.
 *
 * @typeParam T - Result of the operation.
 * @param operation - Thunk to run.
 * @param maxWaitSeconds - Give up rather than sleep longer than this.
 * @returns The operation's result.
 * @throws {RateLimitError} When the wait would exceed `maxWaitSeconds`.
 */
export async function withRateLimitWait<T>(
  operation: () => Promise<T>,
  maxWaitSeconds = 120,
): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    if (!(error instanceof RateLimitError)) throw error

    // Tesla omits Retry-After on some 429s; a minute is long enough to clear a
    // burst limit without stalling a request indefinitely.
    const waitSeconds = error.retryAfter ?? 60
    if (waitSeconds > maxWaitSeconds) throw error

    await new Promise((resolve) => setTimeout(resolve, waitSeconds * 1000))
    return await operation()
  }
}

/**
 * Walks a fleet at a rate that stays under the account quota.
 *
 * Spacing requests is cheaper than being throttled: a 429 costs the wait plus
 * the request that earned it, and repeated throttling can escalate to a longer
 * cooldown.
 *
 * @param client - Authenticated client.
 * @param vins - Vehicles to read.
 * @param requestsPerMinute - Ceiling to stay under.
 * @returns Snapshots keyed by VIN, omitting vehicles that were unreachable.
 */
export async function pacedSweep(
  client: TeslaClient,
  vins: string[],
  requestsPerMinute = 30,
): Promise<Record<string, Vehicle>> {
  const spacingMs = Math.ceil(60_000 / requestsPerMinute)
  const results: Record<string, Vehicle> = {}

  for (const [index, vin] of vins.entries()) {
    if (index > 0) await new Promise((resolve) => setTimeout(resolve, spacingMs))
    results[vin] = await withRateLimitWait(() => client.vehicles.get(vin))
  }

  return results
}

/**
 * Reports how long to wait before retrying, without swallowing anything else.
 *
 * @param error - Anything caught from an SDK call.
 * @returns Seconds to wait, or `undefined` when the error is not a rate limit.
 */
export function retryAfterSeconds(error: unknown): number | undefined {
  return error instanceof RateLimitError ? (error.retryAfter ?? 60) : undefined
}
