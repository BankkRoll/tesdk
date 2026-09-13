/**
 * @file JSON responses and the error-to-status mapping for the HTTP API.
 *
 * Every route funnels failures through {@link errorResponse}, so a caller sees
 * the same envelope whether the failure came from Fleet API, from a missing
 * binding, or from an unhandled throw.
 */

import {
  AuthenticationError,
  InvalidRequestError,
  NotFoundError,
  PermissionError,
  RateLimitError,
  ServerError,
  SigningRequiredError,
  TeslaError,
  TimeoutError,
  VehicleAsleepError,
} from '@bankkroll/tesdk'

/** Error envelope returned by every failing route. */
export interface ErrorBody {
  /** Stable `TeslaError.code`, or `worker_error` for local failures. */
  code: string
  message: string
  /** Tesla transaction id (`x-txid`), which Tesla support asks for. */
  requestId?: string
  /** What the caller can do about it, when there is a concrete remedy. */
  remedy?: string
}

/**
 * Serializes a value as a JSON response.
 *
 * @param body - Value to serialize.
 * @param init - Status and headers, merged over the JSON content type.
 * @returns A `Response` with `application/json` and no-store caching.
 */
export function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body, null, 2), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...init.headers,
    },
  })
}

/**
 * Maps a thrown value to an HTTP status code.
 *
 * `VehicleAsleepError` becomes 409 rather than Tesla's 408: the vehicle is in a
 * conflicting state that the caller resolves by waking it, whereas 408 would
 * invite intermediaries to retry a request that cannot succeed unchanged.
 *
 * @param error - Value caught from a route handler.
 * @returns The status to respond with.
 */
function statusFor(error: unknown): number {
  if (error instanceof RateLimitError) return 429
  if (error instanceof VehicleAsleepError) return 409
  if (error instanceof SigningRequiredError) return 501
  if (error instanceof AuthenticationError) return 401
  if (error instanceof PermissionError) return 403
  if (error instanceof NotFoundError) return 404
  if (error instanceof InvalidRequestError) return 400
  if (error instanceof TimeoutError) return 504
  if (error instanceof ServerError) return 502
  return 500
}

/**
 * Suggests a remedy for the failures a caller can actually act on.
 *
 * @param error - Value caught from a route handler.
 * @returns Advice, or `undefined` when there is nothing useful to say.
 */
function remedyFor(error: unknown): string | undefined {
  if (error instanceof VehicleAsleepError) {
    return 'The vehicle is asleep. POST /api/vehicles/{vin}/commands/wake, then retry.'
  }
  if (error instanceof SigningRequiredError) {
    return 'This vehicle requires signed commands. Run the Tesla Vehicle Command Proxy and set TESLA_PROXY_URL to its address.'
  }
  if (error instanceof RateLimitError) {
    return error.retryAfter === undefined
      ? 'Fleet API is throttling this account. Back off before retrying.'
      : `Fleet API is throttling this account. Retry after ${error.retryAfter}s.`
  }
  if (error instanceof AuthenticationError) {
    return 'The stored token was rejected. Re-authorize at /auth/login.'
  }
  return undefined
}

/**
 * Converts a thrown value into a JSON error response.
 *
 * @param error - Value caught from a route handler.
 * @returns A `Response` carrying an {@link ErrorBody}.
 *
 * @example
 * ```ts
 * try {
 *   return await route(request)
 * } catch (error) {
 *   return errorResponse(error)
 * }
 * ```
 */
export function errorResponse(error: unknown): Response {
  const status = statusFor(error)
  const remedy = remedyFor(error)

  const body: ErrorBody = {
    code: error instanceof TeslaError ? error.code : 'worker_error',
    message: error instanceof Error ? error.message : String(error),
    ...(error instanceof TeslaError && error.requestId !== undefined
      ? { requestId: error.requestId }
      : {}),
    ...(remedy !== undefined ? { remedy } : {}),
  }

  const headers: Record<string, string> = {}
  if (error instanceof RateLimitError && error.retryAfter !== undefined) {
    headers['retry-after'] = String(error.retryAfter)
  }

  return json(body, { status, headers })
}
