/**
 * @file Wiring `onRequest` into logs and metrics.
 *
 * Prerequisites: none. The logger and metrics interfaces are declared locally
 * so the snippet compiles against any implementation.
 */

import { TeslaClient, type RequestLogEntry } from 'tesdk'

/** The subset of a structured logger this uses. */
export interface Logger {
  info(fields: Record<string, unknown>, message: string): void
  warn(fields: Record<string, unknown>, message: string): void
}

/** The subset of a metrics client this uses. */
export interface Metrics {
  increment(name: string, tags: Record<string, string>): void
  histogram(name: string, value: number, tags: Record<string, string>): void
}

/** A 17-character VIN, or an all-digit energy site or invoice id. */
const IDENTIFIER_SEGMENT = /^([A-HJ-NPR-Z0-9]{17}|\d{4,})$/

/**
 * Strips the query string and identifiers out of a URL.
 *
 * VINs and site ids in a metric tag would blow up cardinality, and a query
 * string can carry a token, so both are removed before anything is emitted.
 * The `/api/1/` version segment is left alone, which is why the digit rule
 * requires four or more.
 *
 * @param url - Absolute request URL.
 * @returns A path with variable segments replaced by `:id`.
 *
 * @example
 * ```ts
 * routeOf('https://host/api/1/vehicles/5YJ3E1EA1JF000001/vehicle_data?endpoints=x')
 * // '/api/1/vehicles/:id/vehicle_data'
 * ```
 */
export function routeOf(url: string): string {
  return new URL(url).pathname
    .split('/')
    .map((segment) => (IDENTIFIER_SEGMENT.test(segment) ? ':id' : segment))
    .join('/')
}

/**
 * Builds a client that logs every attempt.
 *
 * `onRequest` fires once per *attempt*, not per call, so a retried request
 * produces several entries with increasing `attempt`. That is what makes it
 * useful: it shows the retries the SDK absorbed on your behalf.
 *
 * @param accessToken - Bearer token.
 * @param logger - Structured logger.
 */
export function loggingClient(accessToken: string, logger: Logger): TeslaClient {
  return new TeslaClient({
    accessToken,
    onRequest: ({ method, url, status, attempt, durationMs, error }: RequestLogEntry) => {
      const fields = { method, route: routeOf(url), status, attempt, durationMs }
      if (error !== undefined || (status !== undefined && status >= 400)) {
        logger.warn(fields, 'Fleet API request failed')
      } else {
        logger.info(fields, 'Fleet API request')
      }
    },
  })
}

/**
 * Builds a client that emits latency and outcome metrics.
 *
 * @param accessToken - Bearer token.
 * @param metrics - Metrics client.
 */
export function instrumentedClient(accessToken: string, metrics: Metrics): TeslaClient {
  return new TeslaClient({
    accessToken,
    onRequest: ({ method, url, status, attempt, durationMs }) => {
      const tags = {
        method,
        route: routeOf(url),
        status: status === undefined ? 'none' : String(status),
      }
      metrics.histogram('tesla.request.duration_ms', durationMs, tags)
      metrics.increment('tesla.request.count', tags)
      if (attempt > 1) metrics.increment('tesla.request.retry', tags)
    },
  })
}
