/**
 * @file Browser-based authorization-code login with PKCE.
 *
 * Starts a short-lived loopback server to receive the redirect, which keeps
 * the authorization code out of the shell history and off the process list.
 */

import { createServer } from 'node:http'
import { once } from 'node:events'
import { createPkcePair, randomString, type TeslaClient, type TokenSet } from '@bankkroll/tesdk'
import type { CliConfig } from './config.ts'
import { cyan, dim, line } from './ui.ts'

/** Scopes requested at login. Narrow these to what your integration needs. */
const SCOPES = [
  'user_data',
  'vehicle_device_data',
  'vehicle_location',
  'vehicle_cmds',
  'vehicle_charging_cmds',
  'energy_device_data',
  'energy_cmds',
] as const

/** Page shown in the browser once the redirect is handled. */
function resultPage(title: string, detail: string): string {
  return `<!doctype html>
<meta charset="utf-8">
<title>${title}</title>
<style>
  body { margin:0; min-height:100vh; display:grid; place-items:center;
         background:#111; color:#f4f4f4;
         font:400 15px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif }
  .card { text-align:center; padding:48px 56px }
  h1 { margin:0 0 8px; font-size:20px; font-weight:600; letter-spacing:-.01em }
  p { margin:0; color:#8e8e8e; font-size:14px }
</style>
<div class="card"><h1>${title}</h1><p>${detail}</p></div>`
}

/**
 * Runs the full login flow and stores the resulting tokens on the client.
 *
 * @param client - Client whose token store receives the credentials.
 * @param config - Redirect URI and application credentials.
 * @returns The issued token set.
 * @throws {Error} When the callback reports an error, `state` does not match,
 * or no code arrives before the timeout.
 */
export async function login(client: TeslaClient, config: CliConfig): Promise<TokenSet> {
  const pkce = await createPkcePair()
  const state = randomString()

  const redirect = new URL(config.redirectUri)
  const port = Number(redirect.port || '80')

  const authorizeUrl = client.oauth.authorizeUrl({
    scopes: [...SCOPES],
    state,
    pkce,
    prompt: 'login',
  })

  line()
  line(`Open this URL to authorize:\n\n  ${cyan(authorizeUrl)}\n`)
  line(dim(`Waiting for the redirect on ${redirect.origin}${redirect.pathname} …`))

  const code = await waitForCode(port, redirect.pathname, state)

  return await client.oauth.exchangeCode({ code, codeVerifier: pkce.verifier })
}

/**
 * Listens on the loopback interface for the OAuth redirect.
 *
 * @param port - Port from the configured redirect URI.
 * @param pathname - Expected callback path; other paths return 404.
 * @param expectedState - Value that the callback's `state` must equal.
 * @returns The authorization code.
 */
async function waitForCode(
  port: number,
  pathname: string,
  expectedState: string,
): Promise<string> {
  const { promise, resolve, reject } = Promise.withResolvers<string>()

  const server = createServer((request, response) => {
    const url = new URL(request.url ?? '/', `http://127.0.0.1:${port}`)
    if (url.pathname !== pathname) {
      response.writeHead(404).end()
      return
    }

    const error = url.searchParams.get('error')
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')

    const send = (status: number, title: string, detail: string): void => {
      response.writeHead(status, { 'content-type': 'text/html; charset=utf-8' })
      response.end(resultPage(title, detail))
    }

    if (error) {
      send(400, 'Authorization failed', error)
      reject(new Error(`Authorization failed: ${error}`))
      return
    }

    // A mismatched state means the response is not from the request we sent.
    if (state !== expectedState) {
      send(400, 'Authorization failed', 'State mismatch — possible CSRF.')
      reject(new Error('State mismatch: the callback did not match this request.'))
      return
    }

    if (!code) {
      send(400, 'Authorization failed', 'No authorization code was returned.')
      reject(new Error('No authorization code was returned.'))
      return
    }

    send(200, 'Signed in', 'You can close this tab and return to the terminal.')
    resolve(code)
  })

  const timeout = setTimeout(
    () => {
      reject(new Error('Timed out after 5 minutes waiting for the redirect.'))
    },
    5 * 60 * 1000,
  )

  server.listen(port, '127.0.0.1')
  await once(server, 'listening')

  try {
    return await promise
  } finally {
    clearTimeout(timeout)
    server.close()
  }
}
