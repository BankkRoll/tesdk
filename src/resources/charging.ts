/**
 * @file Charging history, sessions, and invoices.
 *
 * Distinct from {@link OcpiResource}, which exposes Tesla's public charging
 * network under OCPI 2.2.1. These endpoints cover the authenticated account's
 * own charging records.
 *
 * @see {@link https://developer.tesla.com/docs/fleet-api/endpoints/charging-endpoints}
 */

import type { PageOptions, RequestOverrides } from '../types/common.js'
import { BaseResource } from './base.js'

/** A charging event from {@link ChargingResource.history}. */
export interface ChargingHistoryEntry {
  sessionId?: number
  vin?: string
  chargeStartDateTime?: string
  chargeStopDateTime?: string
  siteLocationName?: string
  /** Energy delivered in kilowatt-hours. */
  energyDrawnKwh?: string
  fees?: unknown[]
  [key: string]: unknown
}

/** Paginated charging history. */
export interface ChargingHistoryPage {
  data?: ChargingHistoryEntry[]
  totalResults?: number
  hasMoreData?: boolean
  [key: string]: unknown
}

/** A billed charging session from {@link ChargingResource.sessions}. */
export interface ChargingSession {
  sessionId?: string
  vin?: string
  /** Energy delivered in kilowatt-hours. */
  energyDrawnKwh?: number
  chargeStartDateTime?: string
  chargeStopDateTime?: string
  [key: string]: unknown
}

/** Paginated charging sessions. */
export interface ChargingSessionPage {
  data?: ChargingSession[]
  totalResults?: number
  [key: string]: unknown
}

/**
 * Charging history and invoices for the authenticated account.
 *
 * Accessed as `client.charging`.
 *
 * @see {@link https://developer.tesla.com/docs/fleet-api/endpoints/charging-endpoints}
 */
export class ChargingResource extends BaseResource {
  /** Returns paginated charging history for the account. */
  async history(options: PageOptions & RequestOverrides = {}): Promise<ChargingHistoryPage> {
    const { page, perPage, ...overrides } = options
    return await this.unwrap<ChargingHistoryPage>({
      method: 'GET',
      path: '/api/1/dx/charging/history',
      query: { pageNo: page, pageSize: perPage },
      ...overrides,
    })
  }

  /**
   * Returns session detail including pricing and energy.
   *
   * Available only to business accounts that own a fleet of vehicles.
   */
  async sessions(options: PageOptions & RequestOverrides = {}): Promise<ChargingSessionPage> {
    const { page, perPage, ...overrides } = options
    return await this.unwrap<ChargingSessionPage>({
      method: 'GET',
      path: '/api/1/dx/charging/sessions',
      query: { pageNo: page, pageSize: perPage },
      ...overrides,
    })
  }

  /**
   * Downloads the PDF invoice for a charging event.
   *
   * @param invoiceId - Invoice identifier taken from a {@link history} entry.
   * @returns Raw PDF bytes, not a parsed object.
   */
  async invoice(invoiceId: string, options: RequestOverrides = {}): Promise<ArrayBuffer> {
    return await this.http.request<ArrayBuffer>({
      method: 'GET',
      path: `/api/1/dx/charging/invoice/${encodeURIComponent(invoiceId)}`,
      headers: { accept: 'application/pdf' },
      responseType: 'binary',
      ...options,
    })
  }
}
