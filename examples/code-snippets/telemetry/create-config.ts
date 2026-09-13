/**
 * @file Applying a Fleet Telemetry configuration to a set of vehicles.
 *
 * Prerequisites: a running Fleet Telemetry server, its CA certificate chain,
 * and a client pointed at a Vehicle Command Proxy — the configuration payload
 * must be signed.
 */

import { TeslaClient, type TelemetryConfig, type TelemetryConfigResult } from '@bankkroll/tesdk'

/**
 * Streams state of charge and location to a self-hosted server.
 *
 * A vehicle accepts configurations from at most five applications, and each
 * `createConfig` call replaces this application's, so send the complete field
 * set every time rather than trying to add to it.
 *
 * @param proxyClient - Client whose `baseUrl` is a Vehicle Command Proxy.
 * @param vins - Vehicles to configure, in one request.
 * @param hostname - Fleet Telemetry server, as `host:port`.
 * @param caPem - PEM-encoded CA chain the vehicle validates the server against.
 * @returns How many vehicles took the configuration, and why any were skipped.
 *
 * @example
 * ```ts
 * const proxyClient = new TeslaClient({ baseUrl: 'https://localhost:4443', accessToken })
 * const result = await streamBasics(proxyClient, [vin], 'telemetry.example.com:4443', caPem)
 * ```
 */
export async function streamBasics(
  proxyClient: TeslaClient,
  vins: string[],
  hostname: string,
  caPem: string,
): Promise<TelemetryConfigResult> {
  const config: TelemetryConfig = {
    hostname,
    ca: caPem,
    fields: {
      Soc: { interval_seconds: 60 },
      ChargeState: { interval_seconds: 30 },
      Location: { interval_seconds: 10, minimum_delta: 50 },
    },
    // Have the vehicle resend anything the server did not acknowledge, so a
    // server restart does not silently lose a window of data.
    delivery_policy: 'latest',
  }

  return await proxyClient.telemetry.createConfig(vins, config)
}

/**
 * Applies a configuration and reports the VINs that refused it.
 *
 * The usual reason is `missing_key`: the vehicle has no virtual key for this
 * application, so send those owners a pairing link.
 *
 * @param proxyClient - Client pointed at a Vehicle Command Proxy.
 * @param vins - Vehicles to configure.
 * @param config - Configuration to apply.
 * @returns VINs that were skipped, with the reason Tesla gave.
 */
export async function applyAndReportSkipped(
  proxyClient: TeslaClient,
  vins: string[],
  config: TelemetryConfig,
): Promise<Record<string, unknown>> {
  const result = await proxyClient.telemetry.createConfig(vins, config)
  return result.skipped_vehicles ?? {}
}

/**
 * Applies a JWS the caller signed themselves.
 *
 * Only for callers implementing Schnorr over NIST P-256 outside this SDK. The
 * proxy path above is the supported route.
 *
 * @param client - Authenticated client. No proxy needed: the token is signed.
 * @param token - Pre-signed configuration JWS.
 */
export async function applySignedToken(
  client: TeslaClient,
  token: string,
): Promise<TelemetryConfigResult> {
  return await client.telemetry.createConfigJws(token)
}
