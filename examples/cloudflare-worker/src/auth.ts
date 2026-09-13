/**
 * @file OAuth authorization-code flow for the Worker.
 *
 * The Worker authorizes once, as an operator, and then runs unattended: the
 * cron handler has no browser to redirect. `/auth/login` and `/auth/callback`
 * exist only to seed KV with a refresh token that every later invocation reuses.
 *
 * PKCE state lives in KV rather than a cookie because the operator may complete
 * the redirect in a different browser session, and because the callback is the
 * only consumer.
 */

import { createPkcePair, randomString, type Scope, type TeslaClient } from '@bankkroll/tesdk'
import { json } from './http.js'

/** Scopes the monitor and the command routes need. */
const SCOPES: Scope[] = ['vehicle_device_data', 'vehicle_cmds', 'vehicle_charging_cmds']

/** KV key prefix for pending PKCE verifiers, keyed by `state`. */
const PENDING_PREFIX = 'oauth:pending:'

/**
 * The authorization request is single-use and short-lived; KV expires the
 * verifier on its own so an abandoned login leaves nothing behind.
 */
const PENDING_TTL_SECONDS = 600

/**
 * Starts the flow by redirecting the operator to Tesla.
 *
 * @param client - Client configured with the application credentials.
 * @param kv - Namespace bound as `TESLA_KV`.
 * @returns A 302 to Tesla's consent screen.
 */
export async function startLogin(client: TeslaClient, kv: KVNamespace): Promise<Response> {
  const pkce = await createPkcePair()
  const state = randomString()

  await kv.put(PENDING_PREFIX + state, pkce.verifier, { expirationTtl: PENDING_TTL_SECONDS })

  return Response.redirect(client.oauth.authorizeUrl({ scopes: SCOPES, state, pkce }), 302)
}

/**
 * Completes the flow, exchanging the code for tokens.
 *
 * The client's KV-backed token store persists the result, so nothing needs to
 * be written here explicitly.
 *
 * @param client - Client configured with the application credentials.
 * @param kv - Namespace bound as `TESLA_KV`.
 * @param url - The callback URL, carrying `code` and `state`.
 * @returns A JSON acknowledgement, or a 400 when the callback is not valid.
 */
export async function completeLogin(
  client: TeslaClient,
  kv: KVNamespace,
  url: URL,
): Promise<Response> {
  const error = url.searchParams.get('error')
  if (error) {
    return json(
      { code: 'oauth_denied', message: url.searchParams.get('error_description') ?? error },
      { status: 400 },
    )
  }

  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  if (!code || !state) {
    return json(
      { code: 'invalid_request', message: 'The callback is missing `code` or `state`.' },
      { status: 400 },
    )
  }

  // Deleting before the exchange makes the verifier single-use even if the
  // exchange itself fails, so a replayed callback cannot reuse it.
  const verifier = await kv.get(PENDING_PREFIX + state)
  await kv.delete(PENDING_PREFIX + state)

  if (!verifier) {
    return json(
      {
        code: 'invalid_request',
        message: 'Unknown or expired `state`. Start again at /auth/login.',
      },
      { status: 400 },
    )
  }

  const tokens = await client.oauth.exchangeCode({ code, codeVerifier: verifier })

  return json({
    authorized: true,
    scopes: tokens.scopes ?? [],
    expiresAt: new Date(tokens.expiresAt).toISOString(),
    refreshable: tokens.refreshToken !== undefined,
  })
}
