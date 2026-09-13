/**
 * @file Partner token via the `client_credentials` grant, and the one-time
 * registration it unlocks.
 *
 * Prerequisites: `TESLA_CLIENT_ID` and `TESLA_CLIENT_SECRET`, plus a PEM public
 * key already hosted on the application domain (see `host-public-key.ts`).
 */

import { TeslaClient, type PartnerAccount, type TokenSet } from 'tesdk'

/**
 * Mints a partner token, which represents the application rather than a user.
 *
 * Required for every `client.partner` endpoint and for the partner-only
 * `vehicle_specs` and `vehicle_pricing_info` scopes. A partner token carries no
 * user context, so `client.user` and per-vehicle endpoints reject it.
 *
 * @returns The token set, already stored on the returned client.
 */
export async function mintPartnerToken(): Promise<{ client: TeslaClient; tokens: TokenSet }> {
  const client = new TeslaClient({
    region: 'na',
    clientId: process.env['TESLA_CLIENT_ID'],
    clientSecret: process.env['TESLA_CLIENT_SECRET'],
  })

  const tokens = await client.oauth.clientCredentials(['openid', 'vehicle_specs'])
  return { client, tokens }
}

/**
 * Registers the application in one region and verifies the public key landed.
 *
 * Registration is per-region: a token minted for `eu` is rejected by `na`, and
 * so is a registration. Run this once per region you serve.
 *
 * @param domain - Domain hosting the public key, shown to users during pairing.
 * @returns The partner account record Tesla created.
 */
export async function registerPartnerDomain(domain: string): Promise<PartnerAccount> {
  const { client } = await mintPartnerToken()

  const account = await client.partner.register(domain)

  // A readable key confirms Tesla fetched it; registration succeeds before the
  // fetch is verified, so this is the real check.
  const { public_key: publicKey } = await client.partner.publicKey(domain)
  if (!publicKey) {
    throw new Error(`No public key registered for ${domain}. Confirm the PEM is reachable.`)
  }

  return account
}
