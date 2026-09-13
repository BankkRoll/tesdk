/**
 * @file Vehicle management: specifications, options, pricing, warranty,
 * eligibility, and enterprise roles.
 *
 * @see {@link https://developer.tesla.com/docs/fleet-api/endpoints/vehicle-management}
 */

import type { RequestOverrides } from '../types/common.js'
import { BaseResource, assertVin } from './base.js'

/** Factory option codes returned by {@link FleetResource.options}. */
export interface VehicleOptions {
  codes?: { code: string; name?: string; description?: string }[]
  [key: string]: unknown
}

/** Subscription or upgrade eligibility for a vehicle. */
export interface Eligibility {
  eligible?: boolean
  vin?: string
  [key: string]: unknown
}

/** Warranty coverage returned by {@link FleetResource.warrantyDetails}. */
export interface WarrantyDetails {
  activeWarranty?: unknown[]
  upcomingWarranty?: unknown[]
  expiredWarranty?: unknown[]
  [key: string]: unknown
}

/** Parameters for {@link FleetResource.pricing}. */
export interface PricingRequest {
  /** Two-letter market code, such as `US`. */
  market: string
  /** Model code, such as `m3` or `my`. */
  model: string
  /** ISO 4217 currency code. */
  currency?: string
  [key: string]: unknown
}

/** Enterprise roles assigned for a vehicle. */
export interface EnterpriseRoles {
  vin?: string
  roles?: unknown[]
  [key: string]: unknown
}

/**
 * Vehicle product information and enterprise management.
 *
 * Accessed as `client.fleet`.
 *
 * @see {@link https://developer.tesla.com/docs/fleet-api/endpoints/vehicle-management}
 */
export class FleetResource extends BaseResource {
  /** Returns factory option codes and their descriptions. */
  async options(vin: string, options: RequestOverrides = {}): Promise<VehicleOptions> {
    return await this.unwrap<VehicleOptions>({
      method: 'GET',
      path: '/api/1/dx/vehicles/options',
      query: { vin: assertVin(vin) },
      ...options,
    })
  }

  /** Returns subscriptions the vehicle is eligible for. */
  async eligibleSubscriptions(vin: string, options: RequestOverrides = {}): Promise<Eligibility> {
    return await this.unwrap<Eligibility>({
      method: 'GET',
      path: '/api/1/dx/vehicles/subscriptions/eligibility',
      query: { vin: assertVin(vin) },
      ...options,
    })
  }

  /** Returns paid upgrades the vehicle is eligible for. */
  async eligibleUpgrades(vin: string, options: RequestOverrides = {}): Promise<Eligibility> {
    return await this.unwrap<Eligibility>({
      method: 'GET',
      path: '/api/1/dx/vehicles/upgrades/eligibility',
      query: { vin: assertVin(vin) },
      ...options,
    })
  }

  /** Returns warranty coverage for a vehicle. */
  async warrantyDetails(vin: string, options: RequestOverrides = {}): Promise<WarrantyDetails> {
    return await this.unwrap<WarrantyDetails>({
      method: 'GET',
      path: '/api/1/dx/warranty/details',
      query: { vin: assertVin(vin) },
      ...options,
    })
  }

  /**
   * Returns pricing for a vehicle model in a market.
   *
   * Requires the `vehicle_pricing_info` scope, which is available only to
   * partner tokens.
   */
  async pricing(
    request: PricingRequest,
    options: RequestOverrides = {},
  ): Promise<Record<string, unknown>> {
    return await this.unwrap<Record<string, unknown>>({
      method: 'POST',
      path: '/api/1/dx/vehicles/pricing',
      body: request,
      idempotent: true,
      ...options,
    })
  }

  /** Returns enterprise roles assigned for a vehicle. */
  async enterpriseRoles(vin: string, options: RequestOverrides = {}): Promise<EnterpriseRoles> {
    return await this.unwrap<EnterpriseRoles>({
      method: 'GET',
      path: `/api/1/dx/enterprise/v1/${assertVin(vin)}/roles`,
      ...options,
    })
  }

  /**
   * Sets payer roles for a vehicle.
   *
   * Requires the `enterprise_management` scope.
   */
  async setEnterprisePayer(
    vin: string,
    payer: Record<string, unknown>,
    options: RequestOverrides = {},
  ): Promise<Record<string, unknown>> {
    return await this.unwrap<Record<string, unknown>>({
      method: 'POST',
      path: `/api/1/dx/enterprise/v1/${assertVin(vin)}/payer`,
      body: payer,
      idempotent: true,
      ...options,
    })
  }
}
