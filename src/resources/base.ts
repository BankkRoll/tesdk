/**
 * @file Shared base class for resource namespaces.
 */

import { TeslaError } from '../core/errors.js'
import type { HttpClient, RequestOptions } from '../core/http.js'
import type { FleetResponse, Pagination } from '../types/common.js'

/** Narrows an unknown body to the Fleet API envelope shape. */
function hasEnvelope(body: unknown): body is FleetResponse<unknown> {
  return typeof body === 'object' && body !== null && 'response' in body
}

/**
 * Base class providing envelope unwrapping to resource namespaces.
 *
 * @internal
 */
export abstract class BaseResource {
  protected readonly http: HttpClient

  constructor(http: HttpClient) {
    this.http = http
  }

  /**
   * Issues a request and unwraps the Fleet API `response` envelope.
   *
   * Endpoints that return a bare payload rather than an envelope are passed
   * through unchanged.
   *
   * @typeParam T - Shape of the unwrapped payload.
   */
  protected async unwrap<T>(options: RequestOptions): Promise<T> {
    const body = await this.http.request<unknown>(options)
    return (hasEnvelope(body) ? body.response : body) as T
  }

  /**
   * Issues a request and returns the payload with its pagination cursor.
   *
   * @throws {TeslaError} When the response is not a Fleet API envelope.
   */
  protected async unwrapPaged(
    options: RequestOptions,
  ): Promise<{ data: unknown; pagination: Pagination | undefined }> {
    const body = await this.http.request<unknown>(options)
    if (!hasEnvelope(body)) {
      throw new TeslaError('Expected a paginated Fleet API response envelope', { body })
    }
    return { data: body.response, pagination: body.pagination }
  }
}

/**
 * Validates a VIN before it is interpolated into a request path.
 *
 * Rejects empty values and path separators so a malformed identifier fails
 * locally rather than producing a misleading 404 or escaping the intended
 * route.
 *
 * @returns The VIN unchanged, for inline use in a template literal.
 * @throws {TypeError} When the VIN is empty or contains `/`, `\`, `?`, or `#`.
 * @internal
 */
export function assertVin(vin: string): string {
  if (!vin || /[/\\?#]/.test(vin)) throw new TypeError(`Invalid VIN: ${JSON.stringify(vin)}`)
  return vin
}
