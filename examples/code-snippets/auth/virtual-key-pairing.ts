/**
 * @file Virtual key pairing: the deep link users follow, and how to tell
 * whether they followed it.
 *
 * Prerequisites: partner registration completed for the domain, and the user
 * already authorized with at least one of `vehicle_device_data`,
 * `vehicle_cmds`, or `vehicle_location`.
 */

import { TeslaClient, virtualKeyPairingUrl } from 'tesdk'

/** Pairing state for one vehicle. */
export interface PairingState {
  vin: string
  /** Whether this application's virtual key is installed on the vehicle. */
  paired: boolean
  /** Deep link to send the user to, present only while unpaired. */
  pairingUrl?: string
}

/**
 * Reports which vehicles still need the application's virtual key.
 *
 * Pairing cannot be done over the API — adding a key requires a physically
 * present, trusted user — so the remedy is always a link into the Tesla mobile
 * app. Pre-selecting the VIN spares users with several vehicles a choice they
 * can get wrong.
 *
 * @param client - Client authenticated as the vehicle's owner or driver.
 * @param domain - Registered application domain, without a scheme.
 * @param vins - Vehicles to check.
 * @returns One entry per requested VIN, in the order given.
 *
 * @example
 * ```ts
 * for (const { vin, pairingUrl } of await pairingStates(client, 'example.com', vins)) {
 *   if (pairingUrl) console.log(`${vin} needs pairing: ${pairingUrl}`)
 * }
 * ```
 */
export async function pairingStates(
  client: TeslaClient,
  domain: string,
  vins: string[],
): Promise<PairingState[]> {
  const status = await client.vehicles.fleetStatus(vins)
  const paired = new Set(status.key_paired_vins ?? [])

  return vins.map((vin) =>
    paired.has(vin)
      ? { vin, paired: true }
      : { vin, paired: false, pairingUrl: virtualKeyPairingUrl({ domain, vin }) },
  )
}

/**
 * Builds the account-wide pairing link, with no vehicle pre-selected.
 *
 * Use this in onboarding, before any VIN is known.
 *
 * @param domain - Registered application domain.
 */
export function onboardingPairingUrl(domain: string): string {
  return virtualKeyPairingUrl({ domain })
}
