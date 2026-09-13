/**
 * @file Worker bindings and the configuration derived from them.
 *
 * Declares the typed {@link Env} contract that `wrangler.toml` populates, and
 * validates it once per invocation so a missing binding fails with a clear
 * message instead of an opaque OAuth rejection later.
 */

import type { Region } from 'tesdk'

/**
 * Bindings injected by the Workers runtime.
 *
 * `vars` come from `[vars]` in `wrangler.toml`; secrets come from
 * `wrangler secret put` in production and `.dev.vars` locally. Both arrive as
 * plain string properties, which is why they are indistinguishable here.
 */
export interface Env {
  /** Namespace holding the token set and the latest charge snapshots. */
  TESLA_KV: KVNamespace

  /** Tesla application client id. */
  TESLA_CLIENT_ID: string
  /** Fleet API region. A token minted for one region is rejected by the others. */
  TESLA_REGION: string
  /** Redirect URI registered on the Tesla application. */
  TESLA_REDIRECT_URI: string
  /** Vehicle Command Proxy address, empty when commands go straight to Fleet API. */
  TESLA_PROXY_URL: string

  /** Tesla application secret. Secret binding. */
  TESLA_CLIENT_SECRET: string
  /** Bearer token guarding this Worker's own JSON API. Secret binding. */
  API_TOKEN: string
}

/** Validated configuration for a single invocation. */
export interface WorkerConfig {
  clientId: string
  clientSecret: string
  region: Region
  redirectUri: string
  /** Absent rather than empty when no proxy is configured, so it can be spread. */
  proxyUrl: string | undefined
  apiToken: string
}

const REGIONS: readonly string[] = ['na', 'eu', 'cn']

/**
 * Reads and validates the bindings.
 *
 * @param env - Bindings supplied by the runtime.
 * @returns Configuration with the region narrowed to a {@link Region}.
 * @throws {Error} When a required binding is missing or the region is unknown.
 */
export function loadConfig(env: Env): WorkerConfig {
  const missing = (['TESLA_CLIENT_ID', 'TESLA_CLIENT_SECRET', 'API_TOKEN'] as const).filter(
    (key) => !env[key],
  )
  if (missing.length > 0) {
    throw new Error(
      `Missing binding(s): ${missing.join(', ')}. Set vars in wrangler.toml and secrets with \`wrangler secret put\`.`,
    )
  }

  const region = env.TESLA_REGION || 'na'
  if (!REGIONS.includes(region)) {
    throw new Error(`TESLA_REGION must be na, eu, or cn (received "${region}").`)
  }

  return {
    clientId: env.TESLA_CLIENT_ID,
    clientSecret: env.TESLA_CLIENT_SECRET,
    region: region as Region,
    redirectUri: env.TESLA_REDIRECT_URI || 'http://localhost:8787/auth/callback',
    proxyUrl: env.TESLA_PROXY_URL || undefined,
    apiToken: env.API_TOKEN,
  }
}
