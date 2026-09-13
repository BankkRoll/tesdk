/**
 * @file Worker entry point.
 *
 * Exports the two handlers the Workers runtime invokes:
 *
 * - `scheduled` — the cron-triggered fleet monitor
 * - `fetch` — the JSON API, the OAuth routes, and a small index page
 *
 * Both build the same client and share the same error mapping. Nothing in this
 * example imports a Node built-in, which is why `wrangler.toml` sets no
 * `nodejs_compat` flag: tesdk is Web Standards only.
 */

import { handleApi, type RouteContext } from './api.js'
import { completeLogin, startLogin } from './auth.js'
import { createClient } from './client.js'
import { loadConfig, type Env } from './env.js'
import { errorResponse, json } from './http.js'
import { runMonitor } from './monitor.js'
import { hasTokens } from './store.js'

/** Routes reachable without the API token. */
const PUBLIC_PATHS = new Set(['/', '/auth/login', '/auth/callback'])

/**
 * Checks the bearer token guarding the API.
 *
 * Compared in constant time so a timing oracle cannot recover the token one
 * byte at a time.
 *
 * @param request - The incoming request.
 * @param expected - The configured `API_TOKEN`.
 * @returns `true` when the `Authorization` header carries the right token.
 */
function isAuthorized(request: Request, expected: string): boolean {
  const header = request.headers.get('authorization') ?? ''
  const presented = header.startsWith('Bearer ') ? header.slice(7) : ''

  const a = new TextEncoder().encode(presented)
  const b = new TextEncoder().encode(expected)
  if (a.byteLength !== b.byteLength) return false

  let diff = 0
  for (let i = 0; i < a.length; i += 1) diff |= (a[i] ?? 0) ^ (b[i] ?? 0)
  return diff === 0
}

/** Describes the API and whether the Worker has been authorized yet. */
async function index(kv: KVNamespace): Promise<Response> {
  return json({
    service: 'tesdk-fleet-monitor',
    authorized: await hasTokens(kv),
    routes: {
      'GET /auth/login': 'Authorize this Worker against a Tesla account',
      'GET /api/health': 'Outcome of the most recent scheduled run',
      'GET /api/snapshots': 'Charge readings recorded by the monitor',
      'GET /api/vehicles': 'Fleet listing with the last recorded reading',
      'GET /api/vehicles/:vin': 'Live charge and climate state (?wake=1 to wake)',
      'POST /api/vehicles/:vin/commands/:name': 'lock, unlock, charge-start, charge-stop, flash',
    },
  })
}

export default {
  /**
   * Serves the HTTP API.
   *
   * @param request - The incoming request.
   * @param env - Bindings supplied by the runtime.
   * @returns A JSON response; failures are mapped by {@link errorResponse}.
   */
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const config = loadConfig(env)
      const url = new URL(request.url)

      if (!PUBLIC_PATHS.has(url.pathname) && !isAuthorized(request, config.apiToken)) {
        return json(
          {
            code: 'authentication_error',
            message: 'A valid `Authorization: Bearer` token is required.',
          },
          { status: 401, headers: { 'www-authenticate': 'Bearer' } },
        )
      }

      const client = createClient(env, config)

      if (url.pathname === '/') return await index(env.TESLA_KV)
      if (url.pathname === '/auth/login') return await startLogin(client, env.TESLA_KV)
      if (url.pathname === '/auth/callback') return await completeLogin(client, env.TESLA_KV, url)

      const context: RouteContext = { client, kv: env.TESLA_KV, url }
      return (
        (await handleApi(request, context)) ??
        json(
          { code: 'not_found', message: `No route for ${request.method} ${url.pathname}.` },
          { status: 404 },
        )
      )
    } catch (error) {
      return errorResponse(error)
    }
  },

  /**
   * Polls the fleet on the cron schedule.
   *
   * The work is handed to `waitUntil` so the run survives the handler
   * returning, which is what keeps the KV writes from being cancelled.
   *
   * @param event - Trigger metadata, including the cron expression that fired.
   * @param env - Bindings supplied by the runtime.
   * @param ctx - Execution context used to extend the invocation's lifetime.
   */
  scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext): void {
    const config = loadConfig(env)
    ctx.waitUntil(runMonitor(createClient(env, config), env.TESLA_KV, event.cron))
  },
} satisfies ExportedHandler<Env>
