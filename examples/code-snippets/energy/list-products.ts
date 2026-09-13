/**
 * @file Finding the energy sites on an account.
 *
 * Prerequisites: a token with `energy_device_data`.
 */

import { TeslaClient, type Product } from '@bankkroll/tesdk'

/** An energy site with its identifier already narrowed to a number. */
export interface EnergySite {
  siteId: number
  name: string | undefined
  resourceType: string | undefined
}

/**
 * Lists the energy sites on the account.
 *
 * `products` returns vehicles and energy sites in one array, distinguished only
 * by which identifier field is present, so filtering on `energy_site_id` is the
 * reliable way to separate them.
 *
 * @param client - Authenticated client.
 */
export async function energySites(client: TeslaClient): Promise<EnergySite[]> {
  const products: Product[] = await client.energy.products()

  return products.flatMap((product) =>
    product.energy_site_id === undefined
      ? []
      : [
          {
            siteId: product.energy_site_id,
            name: product.site_name,
            resourceType: product.resource_type,
          },
        ],
  )
}

/**
 * Returns the single energy site on the account.
 *
 * @param client - Authenticated client.
 * @throws {Error} When the account has no site, or more than one.
 */
export async function soleEnergySite(client: TeslaClient): Promise<EnergySite> {
  const sites = await energySites(client)
  const [only] = sites

  if (!only || sites.length > 1) {
    throw new Error(`Expected exactly one energy site, found ${sites.length}.`)
  }
  return only
}
