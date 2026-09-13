/**
 * @file Routing commands through Tesla's Vehicle Command Proxy.
 *
 * Prerequisites: a running proxy from
 * https://github.com/teslamotors/vehicle-command, holding the private key whose
 * public half is registered on your domain.
 */

import { SigningRequiredError, TeslaClient, type TokenStore } from 'tesdk'

/** Client pair for an application that talks to both hosts. */
export interface ClientPair {
  /** Fleet API directly: reads, and commands for vehicles that allow them. */
  readonly api: TeslaClient
  /** The proxy: signed commands and telemetry configuration. */
  readonly proxy: TeslaClient
}

/**
 * Builds a read client and a command client over one shared token store.
 *
 * The proxy speaks the same protocol as Fleet API, so only the host changes —
 * every call site stays identical. Sharing the store means one refresh serves
 * both, rather than two clients racing to renew the same token.
 *
 * @param proxyUrl - Address the proxy listens on, such as
 * `https://localhost:4443`.
 * @param tokenStore - Store both clients read credentials from.
 *
 * @example
 * ```ts
 * const { api, proxy } = clientPair('https://localhost:4443', tokenStore)
 * const vehicles = await api.vehicles.list()
 * await proxy.commands.doorLock(vehicles[0].vin)
 * ```
 */
export function clientPair(proxyUrl: string, tokenStore: TokenStore): ClientPair {
  const shared = {
    clientId: process.env['TESLA_CLIENT_ID'],
    clientSecret: process.env['TESLA_CLIENT_SECRET'],
    tokenStore,
  }

  return {
    api: new TeslaClient({ ...shared, region: 'na' }),
    proxy: new TeslaClient({ ...shared, baseUrl: proxyUrl }),
  }
}

/**
 * Sends a command directly, falling back to the proxy when signing is required.
 *
 * Avoids a `fleetStatus` lookup before every command: the 403 is the capability
 * check, and it costs one wasted request the first time rather than one extra
 * request every time. Cache the outcome per VIN in anything long-lived.
 *
 * @typeParam T - Result of the command.
 * @param pair - Clients from {@link clientPair}.
 * @param command - The command, parameterized by which client sends it.
 * @returns The command result.
 *
 * @example
 * ```ts
 * await sendSigningAware(pair, (client) => client.commands.doorLock(vin))
 * ```
 */
export async function sendSigningAware<T>(
  pair: ClientPair,
  command: (client: TeslaClient) => Promise<T>,
): Promise<T> {
  try {
    return await command(pair.api)
  } catch (error) {
    if (!(error instanceof SigningRequiredError)) throw error
    return await command(pair.proxy)
  }
}

/**
 * Reports whether the proxy is up before relying on it.
 *
 * Worth doing at startup: a proxy that is not running produces a
 * `ConnectionError` on the first command, which reads like a network problem
 * rather than a missing sidecar.
 *
 * @param proxy - Client pointed at the proxy.
 */
export async function proxyReachable(proxy: TeslaClient): Promise<boolean> {
  try {
    await proxy.user.region({ timeoutMs: 3_000 })
    return true
  } catch {
    return false
  }
}
