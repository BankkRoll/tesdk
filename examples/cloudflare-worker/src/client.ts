/**
 * @file Construction of the Tesla client for a single invocation.
 *
 * One client per invocation rather than a module-level singleton: a module
 * global would be shared by every request an isolate happens to serve, and its
 * in-flight refresh state would outlive the request that started it.
 */

import { TeslaClient } from 'tesdk'
import type { Env, WorkerConfig } from './env.js'
import { kvTokenStore } from './store.js'

/**
 * Builds a client that reads and refreshes tokens through KV.
 *
 * The retry budget is deliberately small: a Worker invocation has a limited CPU
 * and wall-clock allowance, and Fleet API rate limits are per-account, so long
 * backoff chains burn the budget without improving the odds.
 *
 * @param env - Bindings supplied by the runtime.
 * @param config - Validated configuration from `loadConfig`.
 * @returns A client with automatic token refresh persisted to KV.
 */
export function createClient(env: Env, config: WorkerConfig): TeslaClient {
  return new TeslaClient({
    region: config.region,
    // A Vehicle Command Proxy address replaces the regional host so commands
    // are signed before they reach Fleet API.
    baseUrl: config.proxyUrl,
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    redirectUri: config.redirectUri,
    tokenStore: kvTokenStore(env.TESLA_KV),
    timeoutMs: 20_000,
    retry: { maxRetries: 1, initialDelayMs: 400, maxDelayMs: 2_000 },
    onRequest: ({ method, url, status, attempt, durationMs }) => {
      console.log(JSON.stringify({ method, url, status, attempt, durationMs }))
    },
  })
}
