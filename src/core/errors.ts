/**
 * @file Error hierarchy.
 *
 * Every failure surfaced by the SDK is an instance of {@link TeslaError}, so a
 * single `catch` can discriminate with `instanceof` or on the literal
 * {@link TeslaError.code} field rather than by matching message text.
 */

/**
 * Stable discriminant for {@link TeslaError.code}.
 *
 * Values are part of the public API and will not change within a major version.
 */
export type TeslaErrorCode =
  | 'api_error'
  | 'authentication_error'
  | 'permission_error'
  | 'not_found'
  | 'invalid_request'
  | 'rate_limit'
  | 'vehicle_asleep'
  | 'server_error'
  | 'connection_error'
  | 'timeout'
  | 'signing_required'

/** Options accepted by the {@link TeslaError} constructor. */
export interface TeslaErrorOptions {
  /** HTTP status code, when the failure originated from a response. */
  status?: number
  /** Parsed response body, retained for diagnostics. */
  body?: unknown
  /** Value of the `x-txid` response header, requested by Tesla support. */
  requestId?: string
  /** Underlying cause, such as a network error or abort reason. */
  cause?: unknown
}

/**
 * Base class for every error thrown by this SDK.
 *
 * @example
 * ```ts
 * try {
 *   await client.vehicles.data(vin)
 * } catch (error) {
 *   if (error instanceof TeslaError) console.error(error.code, error.requestId)
 * }
 * ```
 */
export class TeslaError extends Error {
  /** Machine-readable discriminant for this error class. */
  readonly code: TeslaErrorCode = 'api_error'
  /** HTTP status code, when a response was received. */
  readonly status: number | undefined
  /** Parsed response body, when one was present. */
  readonly body: unknown
  /** Tesla transaction id, to include when contacting Tesla support. */
  readonly requestId: string | undefined

  constructor(message: string, options: TeslaErrorOptions = {}) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined)
    this.name = new.target.name
    this.status = options.status
    this.body = options.body
    this.requestId = options.requestId
  }
}

/** Thrown on HTTP 401 when a token is missing, expired, or rejected. */
export class AuthenticationError extends TeslaError {
  override readonly code = 'authentication_error' as const
}

/**
 * Thrown on HTTP 403 when the token lacks a required scope or the account
 * lacks access to the requested resource.
 */
export class PermissionError extends TeslaError {
  override readonly code = 'permission_error' as const
}

/** Thrown on HTTP 404 for an unknown VIN, energy site, or route. */
export class NotFoundError extends TeslaError {
  override readonly code = 'not_found' as const
}

/** Thrown on HTTP 400 and 422 for malformed or rejected parameters. */
export class InvalidRequestError extends TeslaError {
  override readonly code = 'invalid_request' as const
}

/** Thrown on HTTP 429 when the account or application is throttled. */
export class RateLimitError extends TeslaError {
  override readonly code = 'rate_limit' as const
  /** Seconds to wait before retrying, parsed from `Retry-After` when present. */
  readonly retryAfter: number | undefined

  constructor(message: string, options: TeslaErrorOptions & { retryAfter?: number } = {}) {
    super(message, options)
    this.retryAfter = options.retryAfter
  }
}

/**
 * Thrown on HTTP 408 when the vehicle is asleep or outside network coverage.
 *
 * Recoverable by calling {@link VehiclesResource.wakeUp} and retrying. The SDK
 * never wakes a vehicle implicitly, because waking consumes battery charge.
 */
export class VehicleAsleepError extends TeslaError {
  override readonly code = 'vehicle_asleep' as const
}

/** Thrown on HTTP 5xx responses. */
export class ServerError extends TeslaError {
  override readonly code = 'server_error' as const
}

/** Thrown when no response was received, such as a DNS, TLS, or CORS failure. */
export class ConnectionError extends TeslaError {
  override readonly code = 'connection_error' as const
}

/** Thrown when a request exceeds its deadline or the caller aborts it. */
export class TimeoutError extends TeslaError {
  override readonly code = 'timeout' as const
}

/**
 * Thrown when a command requires Vehicle Command Protocol signing.
 *
 * Vehicles from 2021 onward reject unsigned commands. Route requests through a
 * Vehicle Command Proxy by setting the client `baseUrl` to the proxy address.
 *
 * @see {@link https://github.com/teslamotors/vehicle-command}
 */
export class SigningRequiredError extends TeslaError {
  override readonly code = 'signing_required' as const
}

/**
 * Maps an HTTP status code to the corresponding error class.
 *
 * @param status - HTTP status code from the response.
 * @param message - Message extracted from the response body.
 * @param options - Response metadata attached to the resulting error.
 * @returns An unthrown {@link TeslaError} subclass instance.
 */
export function errorFromStatus(
  status: number,
  message: string,
  options: TeslaErrorOptions & { retryAfter?: number } = {},
): TeslaError {
  const opts = { ...options, status }
  switch (status) {
    case 400:
    case 422:
      return new InvalidRequestError(message, opts)
    case 401:
      return new AuthenticationError(message, opts)
    case 403:
      // A missing virtual key and a missing scope share status 403 and are
      // distinguishable only by the message body.
      return /unsigned|signed command|virtual key/i.test(message)
        ? new SigningRequiredError(message, opts)
        : new PermissionError(message, opts)
    case 404:
      return new NotFoundError(message, opts)
    case 408:
      return new VehicleAsleepError(message, opts)
    case 429:
      return new RateLimitError(message, opts)
    default:
      return status >= 500 ? new ServerError(message, opts) : new TeslaError(message, opts)
  }
}
