/**
 * @file Virtual key helpers.
 *
 * A virtual key is a P-256 key pair that authorizes an application to command
 * a vehicle. The public key is hosted on the application domain and enrolled
 * with Tesla via partner registration; the private key stays on the
 * application server and signs commands, normally through the Vehicle Command
 * Proxy.
 *
 * Adding a key to a vehicle always requires a trusted user, which is why the
 * pairing step is a deep link into the Tesla mobile app rather than an API
 * call.
 *
 * @see {@link https://developer.tesla.com/docs/fleet-api/virtual-keys/developer-guide}
 */

/**
 * Path at which the application public key must remain publicly available.
 *
 * Registration fails, and previously paired vehicles stop trusting the
 * application, if this file stops resolving.
 */
export const PUBLIC_KEY_PATH = '/.well-known/appspecific/com.tesla.3p.public-key.pem'

/** Options for {@link virtualKeyPairingUrl}. */
export interface PairingUrlOptions {
  /** Registered application domain, without a scheme. */
  domain: string
  /** Pre-selects a vehicle for users who own more than one. */
  vin?: string
}

/**
 * Builds the URL that prompts a user to add this application's virtual key to
 * their vehicle.
 *
 * The user must already have authorized the application with at least one of
 * the `vehicle_device_data`, `vehicle_cmds`, or `vehicle_location` scopes, and
 * must open the link on a device with the Tesla mobile app installed.
 *
 * @returns An absolute `tesla.com` deep link.
 *
 * @example
 * ```ts
 * virtualKeyPairingUrl({ domain: 'example.com', vin })
 * // 'https://tesla.com/_ak/example.com?vin=...'
 * ```
 */
export function virtualKeyPairingUrl(options: PairingUrlOptions): string {
  const domain = options.domain.replace(/^https?:\/\//, '').replace(/\/+$/, '')
  const url = new URL(`https://tesla.com/_ak/${domain}`)
  if (options.vin) url.searchParams.set('vin', options.vin)
  return url.toString()
}

/**
 * Builds the URL at which Tesla expects to find the application public key.
 *
 * @param domain - Registered application domain.
 */
export function publicKeyUrl(domain: string): string {
  const host = domain.replace(/^https?:\/\//, '').replace(/\/+$/, '')
  return `https://${host}${PUBLIC_KEY_PATH}`
}
