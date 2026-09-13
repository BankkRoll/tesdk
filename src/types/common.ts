/**
 * @file Types shared across resource namespaces.
 */

/**
 * Envelope wrapping every Fleet API payload.
 *
 * The SDK unwraps this before returning, so `response` is not visible on
 * resource method return types.
 *
 * @typeParam T - The wrapped payload.
 */
export interface FleetResponse<T> {
  response: T
  /** Present on list endpoints that support pagination. */
  pagination?: Pagination
  error?: string
  error_description?: string
}

/** Cursor metadata returned by paginated list endpoints. */
export interface Pagination {
  previous: number | null
  next: number | null
  current: number
  per_page: number
  count: number
  pages: number
}

/** Page selection accepted by paginated list endpoints. */
export interface PageOptions {
  /** 1-based page number. */
  page?: number
  /** Items per page. Fleet API defaults to 100. */
  perPage?: number
}

/** Per-call overrides accepted by every resource method. */
export interface RequestOverrides {
  /** Cancellation signal for this call. */
  signal?: AbortSignal
  /** Timeout in milliseconds, overriding the client default. */
  timeoutMs?: number
}
