/**
 * @file Creating, listing, revoking, and redeeming vehicle share invites.
 *
 * Prerequisites: a token with `vehicle_cmds`, held by the vehicle owner.
 */

import { TeslaClient, type ShareInvite } from 'tesdk'

/**
 * Mints a share link granting driver-level app access.
 *
 * Single-use and valid for 24 hours. Never retried automatically, because every
 * call mints a distinct link and a retried request would leave a live invite
 * nobody tracked.
 *
 * @param client - Authenticated client, held by the owner.
 * @param vin - Vehicle identification number.
 * @returns The invite, whose `share_link` is what you send the driver.
 */
export async function createInvite(client: TeslaClient, vin: string): Promise<ShareInvite> {
  return await client.vehicles.createShareInvite(vin)
}

/**
 * Lists the invites that are still live.
 *
 * Tesla returns revoked and expired invites too, so both are filtered out here.
 *
 * @param client - Authenticated client.
 * @param vin - Vehicle identification number.
 */
export async function activeInvites(client: TeslaClient, vin: string): Promise<ShareInvite[]> {
  const now = Date.now()
  const invites = await client.vehicles.shareInvites(vin, { perPage: 25 })

  return invites.filter((invite) => {
    if (invite.revoked_at) return false
    return invite.expires_at === undefined || Date.parse(invite.expires_at) > now
  })
}

/**
 * Revokes every live invite for a vehicle.
 *
 * The remedy when a link may have leaked: invites cannot be edited, only
 * cancelled and reissued.
 *
 * @param client - Authenticated client, held by the owner.
 * @param vin - Vehicle identification number.
 * @returns How many invites were revoked.
 */
export async function revokeAllInvites(client: TeslaClient, vin: string): Promise<number> {
  const invites = await activeInvites(client, vin)
  const ids = invites.flatMap((invite) => (invite.id === undefined ? [] : [invite.id]))

  await Promise.all(ids.map((id) => client.vehicles.revokeShareInvite(vin, id)))
  return ids.length
}

/**
 * Redeems an invite code as the currently authenticated account.
 *
 * @param client - Client authenticated as the driver accepting the invite.
 * @param code - Single-use code from the share link.
 */
export async function redeemInvite(client: TeslaClient, code: string): Promise<ShareInvite> {
  return await client.vehicles.redeemShareInvite(code)
}
