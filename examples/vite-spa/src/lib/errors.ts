/**
 * @file Maps SDK failures onto something a visitor can act on.
 *
 * The interesting cases are not bugs but states the Fleet API reports through
 * the type system, each with a different remedy:
 *
 * - `VehicleAsleepError` — offer a wake button rather than an error.
 * - `SigningRequiredError` — the vehicle rejects unsigned commands, which no
 *   amount of retrying fixes; explain the Vehicle Command Proxy.
 * - `RateLimitError` — Tesla says when to come back, so say so too.
 */

import {
  AuthenticationError,
  ConnectionError,
  PermissionError,
  RateLimitError,
  SigningRequiredError,
  TeslaError,
  TimeoutError,
  VehicleAsleepError,
} from '@bankkroll/tesdk'

/** A failure rendered as a notice. */
export interface Failure {
  /** One-line summary shown in the notice. */
  message: string
  /** Optional second line carrying the remedy. */
  detail?: string
  /** Whether the UI should offer to wake the vehicle. */
  wakeable?: boolean
}

/**
 * Describes an unknown thrown value.
 *
 * @param error - Anything caught from an SDK call.
 * @returns A message, and where one exists, the remedy.
 *
 * @example
 * ```ts
 * try {
 *   await client.commands.doorLock(vin)
 * } catch (error) {
 *   setFailure(describeError(error))
 * }
 * ```
 */
export function describeError(error: unknown): Failure {
  if (error instanceof VehicleAsleepError) {
    return {
      message: 'The vehicle is asleep.',
      detail: 'Waking takes 10 to 60 seconds and draws from the battery, so it is never automatic.',
      wakeable: true,
    }
  }

  if (error instanceof SigningRequiredError) {
    return {
      message: 'This vehicle only accepts signed commands.',
      detail:
        'Vehicles from 2021 onward verify a signature made with your private key over the Tesla Vehicle Command Protocol, which no HTTP layer can produce. Run Tesla’s Vehicle Command Proxy and set TESLA_PROXY_URL to its address.',
    }
  }

  if (error instanceof RateLimitError) {
    return {
      message: 'Tesla is rate limiting this account.',
      detail: error.retryAfter
        ? `Try again in ${error.retryAfter} seconds.`
        : 'Fleet Telemetry replaces polling for continuous monitoring.',
    }
  }

  if (error instanceof AuthenticationError) {
    return { message: 'Your session expired.', detail: 'Sign in again to continue.' }
  }

  if (error instanceof PermissionError) {
    return {
      message: 'This account is not allowed to do that.',
      detail: 'The granted scopes may be narrower than the ones requested at sign-in.',
    }
  }

  if (error instanceof TimeoutError || error instanceof ConnectionError) {
    return {
      message: 'Could not reach Fleet API.',
      detail: 'The dev server proxies every request; check that it is still running.',
    }
  }

  if (error instanceof TeslaError) {
    // `requestId` is the x-txid header, which Tesla support asks for.
    return {
      message: error.message,
      ...(error.requestId ? { detail: `Request ${error.requestId}` } : {}),
    }
  }

  return { message: error instanceof Error ? error.message : 'Something went wrong.' }
}
