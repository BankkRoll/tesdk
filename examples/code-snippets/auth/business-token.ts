/**
 * @file Third-party business token for fleets managed in Tesla for Business.
 *
 * Prerequisites: `TESLA_CLIENT_ID`, `TESLA_CLIENT_SECRET`, and an authorization
 * code that a business administrator generated from the Consent Management page.
 */

import { TeslaClient, type Scope, type Vehicle } from '@bankkroll/tesdk'

/**
 * Exchanges a Consent Management authorization code for a business token.
 *
 * Unlike the user flow, no browser redirect is involved: the administrator
 * grants consent once in Tesla for Business and hands over a code. The token
 * covers the whole business fleet and carries no user identity, so
 * `client.user` endpoints are unavailable to it.
 *
 * @param authCode - Code from the Consent Management page.
 * @param scopes - Scopes the business granted. Requesting more than was granted
 * fails the exchange rather than silently narrowing.
 * @returns A client authenticated as the business.
 */
export async function businessClient(authCode: string, scopes: Scope[]): Promise<TeslaClient> {
  const client = new TeslaClient({
    region: 'na',
    clientId: process.env['TESLA_CLIENT_ID'],
    clientSecret: process.env['TESLA_CLIENT_SECRET'],
  })

  await client.oauth.businessToken(authCode, scopes)
  return client
}

/**
 * Lists the fleet a business token can reach.
 *
 * @param authCode - Code from the Consent Management page.
 * @returns Every vehicle the business granted access to.
 */
export async function listBusinessFleet(authCode: string): Promise<Vehicle[]> {
  const client = await businessClient(authCode, ['vehicle_device_data', 'vehicle_cmds'])

  const fleet: Vehicle[] = []
  for await (const vehicle of client.vehicles.listAll()) fleet.push(vehicle)
  return fleet
}
