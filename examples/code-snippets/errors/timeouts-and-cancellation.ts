/**
 * @file Timeouts, `AbortSignal`, and telling a cancellation from a deadline.
 *
 * Prerequisites: none.
 */

import { TeslaClient, TimeoutError, type Vehicle, type VehicleData } from 'tesdk'

/**
 * Builds a client with a shorter default deadline than the SDK's 30 seconds.
 *
 * Suits an interactive request path, where a caller waiting 30 seconds has
 * already given up.
 *
 * @param accessToken - Bearer token.
 */
export function impatientClient(accessToken: string): TeslaClient {
  return new TeslaClient({ accessToken, timeoutMs: 5_000 })
}

/**
 * Overrides the deadline for one call.
 *
 * Per-call is the right granularity here: `vehicle_data` against a vehicle on a
 * weak cellular link is legitimately slow, while a `list` that takes ten seconds
 * is broken.
 *
 * @param client - Authenticated client.
 * @param vin - Vehicle identification number.
 */
export async function patientRead(client: TeslaClient, vin: string): Promise<VehicleData> {
  return await client.vehicles.data(vin, { timeoutMs: 60_000 })
}

/**
 * Cancels a request when the caller goes away.
 *
 * The signal is composed with the client timeout rather than replacing it, so
 * whichever fires first wins.
 *
 * @param client - Authenticated client.
 * @param signal - Cancellation signal, such as a server framework's
 * `request.signal`.
 */
export async function cancellableList(
  client: TeslaClient,
  signal: AbortSignal,
): Promise<Vehicle[]> {
  return await client.vehicles.list({ signal })
}

/**
 * Runs a read against a deadline the caller controls.
 *
 * @param client - Authenticated client.
 * @param vin - Vehicle identification number.
 * @param budgetMs - Total time allowed.
 * @returns The snapshot, or `undefined` when the budget ran out.
 */
export async function readWithinBudget(
  client: TeslaClient,
  vin: string,
  budgetMs: number,
): Promise<VehicleData | undefined> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), budgetMs)

  try {
    return await client.vehicles.data(vin, { signal: controller.signal })
  } catch (error) {
    if (error instanceof TimeoutError) return undefined
    throw error
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Distinguishes a caller-initiated abort from an elapsed deadline.
 *
 * The SDK raises `TimeoutError` for both, since neither produced a response.
 * The signal's own state is what separates them — and the distinction matters:
 * a deadline is worth alerting on, a user navigating away is not.
 *
 * @param error - Anything caught from an SDK call.
 * @param signal - The signal that was passed to the call.
 */
export function wasCancelledByCaller(error: unknown, signal: AbortSignal | undefined): boolean {
  return error instanceof TimeoutError && signal?.aborted === true
}
