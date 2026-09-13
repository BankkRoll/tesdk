/**
 * @file Discriminating the error hierarchy, by class and by code.
 *
 * Prerequisites: none.
 */

import {
  AuthenticationError,
  ConnectionError,
  InvalidRequestError,
  NotFoundError,
  PermissionError,
  RateLimitError,
  ServerError,
  SigningRequiredError,
  TeslaError,
  TimeoutError,
  VehicleAsleepError,
  type TeslaErrorCode,
} from 'tesdk'

/** What the caller should do about a failure. */
export type Remedy =
  /** Retry as-is; the failure is transient. */
  | 'retry'
  /** Wake the vehicle, then retry. */
  | 'wake'
  /** Wait the stated interval, then retry. */
  | 'backoff'
  /** Re-authorize the user. */
  | 'reauthorize'
  /** Route through a Vehicle Command Proxy. */
  | 'sign'
  /** Nothing will help; surface it. */
  | 'fail'

/**
 * Maps a failure to what to do about it, using `instanceof`.
 *
 * Order matters: `SigningRequiredError` and `PermissionError` are both HTTP 403,
 * and the more specific class must be tested first.
 *
 * @param error - Anything caught from an SDK call.
 * @returns The remedy, or `'fail'` for errors this SDK did not raise.
 *
 * @example
 * ```ts
 * try {
 *   await client.commands.doorLock(vin)
 * } catch (error) {
 *   if (remedyFor(error) === 'wake') await client.vehicles.ensureAwake(vin)
 * }
 * ```
 */
export function remedyFor(error: unknown): Remedy {
  if (error instanceof VehicleAsleepError) return 'wake'
  if (error instanceof RateLimitError) return 'backoff'
  if (error instanceof SigningRequiredError) return 'sign'
  if (error instanceof AuthenticationError) return 'reauthorize'
  if (error instanceof PermissionError) return 'fail'
  if (error instanceof NotFoundError) return 'fail'
  if (error instanceof InvalidRequestError) return 'fail'
  if (error instanceof ServerError) return 'retry'
  if (error instanceof ConnectionError) return 'retry'
  if (error instanceof TimeoutError) return 'retry'
  return 'fail'
}

/**
 * The same decision on the `code` field instead.
 *
 * Prefer this across a boundary that loses prototypes — a worker `postMessage`,
 * a serialized job payload, a structured log — where `instanceof` no longer
 * holds but the code survives. It also gives the compiler an exhaustiveness
 * check that a chain of `instanceof` cannot.
 *
 * @param code - The `code` field from a {@link TeslaError}.
 */
export function remedyForCode(code: TeslaErrorCode): Remedy {
  switch (code) {
    case 'vehicle_asleep':
      return 'wake'
    case 'rate_limit':
      return 'backoff'
    case 'signing_required':
      return 'sign'
    case 'authentication_error':
      return 'reauthorize'
    case 'server_error':
    case 'connection_error':
    case 'timeout':
      return 'retry'
    case 'permission_error':
    case 'not_found':
    case 'invalid_request':
    case 'api_error':
      return 'fail'
  }
}

/**
 * Renders a failure as a message worth showing a user.
 *
 * @param error - Anything caught from an SDK call.
 */
export function describe(error: unknown): string {
  if (!(error instanceof TeslaError)) {
    return error instanceof Error ? error.message : String(error)
  }

  const status = error.status === undefined ? '' : ` (HTTP ${error.status})`
  return `${error.code}${status}: ${error.message}`
}
