/**
 * @file Account-scoped endpoints.
 *
 * @see {@link https://developer.tesla.com/docs/fleet-api/endpoints/user-endpoints}
 */

import type { RequestOverrides } from '../types/common.js'
import { BaseResource } from './base.js'

/** Account summary returned by {@link UserResource.me}. */
export interface UserProfile {
  email?: string
  full_name?: string
  profile_image_url?: string
  vault_uuid?: string
  [key: string]: unknown
}

/** Region assignment returned by {@link UserResource.region}. */
export interface UserRegion {
  /** Region code, such as `na` or `eu`. */
  region: string
  /** Fully qualified Fleet API base URL serving this account. */
  fleet_api_base_url: string
}

/** A vehicle order returned by {@link UserResource.orders}. */
export interface Order {
  orderId?: string
  vin?: string
  modelCode?: string
  orderStatus?: string
  [key: string]: unknown
}

/**
 * Account profile, region, and order endpoints.
 *
 * Accessed as `client.user`. These endpoints require a user context and are
 * therefore unavailable to third-party business tokens.
 *
 * @see {@link https://developer.tesla.com/docs/fleet-api/endpoints/user-endpoints}
 */
export class UserResource extends BaseResource {
  /** Returns a summary of the authenticated user's account. */
  async me(options: RequestOverrides = {}): Promise<UserProfile> {
    return await this.unwrap<UserProfile>({ method: 'GET', path: '/api/1/users/me', ...options })
  }

  /**
   * Returns the region serving this account and its Fleet API base URL.
   *
   * Authoritative, and preferable to inferring a region from a country code
   * with {@link regionForCountry}. Takes no parameters: the result is derived
   * from the token subject.
   */
  async region(options: RequestOverrides = {}): Promise<UserRegion> {
    return await this.unwrap<UserRegion>({
      method: 'GET',
      path: '/api/1/users/region',
      ...options,
    })
  }

  /** Returns custom feature flags applied to the account. */
  async featureConfig(options: RequestOverrides = {}): Promise<Record<string, unknown>> {
    return await this.unwrap<Record<string, unknown>>({
      method: 'GET',
      path: '/api/1/users/feature_config',
      ...options,
    })
  }

  /** Returns the account's active vehicle orders. */
  async orders(options: RequestOverrides = {}): Promise<Order[]> {
    return await this.unwrap<Order[]>({
      method: 'GET',
      path: '/api/1/users/orders',
      ...options,
    })
  }
}
