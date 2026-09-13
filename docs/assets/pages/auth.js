/**
 * @file Token types, PKCE, refresh, stores, scopes, virtual keys.
 */

import { getApi } from '../lib/data.js'
import { ICON } from '../icons.js'
import { pageHeader } from '../components/page-header.js'

import { codeBlock } from '../components/ui.js'

export function pageAuth() {
  const p = getApi().package
  return `
  ${pageHeader({
    section: 'Getting started',
    title: 'Authentication',
    lede: 'Three token types, each for a different relationship between your application and the vehicles it reaches.',
    meta: [{ label: 'OAuth 2.0 + PKCE', icon: ICON.key }],
  })}

  <div class="table-wrap"><table>
    <thead><tr><th>Token</th><th>Represents</th><th>Grant</th></tr></thead>
    <tbody>
      <tr><td>Third-party</td><td>A person who granted your app access</td><td><code>authorization_code</code> + PKCE</td></tr>
      <tr><td>Partner</td><td>Your application itself</td><td><code>client_credentials</code></td></tr>
      <tr><td>Third-party business</td><td>A business fleet</td><td><code>client_credentials</code> + <code>auth_code</code></td></tr>
    </tbody>
  </table></div>

  <h2 id="pkce">Authorization code with PKCE</h2>
  ${codeBlock(`import { TeslaClient, createPkcePair, randomString } from '${p.name}'

const pkce = await createPkcePair()
const state = randomString()

// Persist both against the user's session before redirecting.
const url = client.oauth.authorizeUrl({ scopes: ['vehicle_device_data'], state, pkce })

// In your callback, after checking that state matches:
const tokens = await client.oauth.exchangeCode({ code, codeVerifier: pkce.verifier })`)}

  <h2 id="partner">Partner tokens</h2>
  <p>Partner tokens represent the application rather than a user. They are required for every <code>client.partner</code> endpoint and for the partner-only <code>vehicle_specs</code> and <code>vehicle_pricing_info</code> scopes. They carry no user context, so <code>client.user</code> rejects them.</p>
  ${codeBlock(`await client.oauth.clientCredentials(['openid', 'vehicle_specs'])
await client.partner.register('example.com')`)}

  <h2 id="business">Business tokens</h2>
  <p>No browser redirect: a business administrator grants consent once in Tesla for Business and hands over an authorization code.</p>
  ${codeBlock(`await client.oauth.businessToken(authCode, ['vehicle_device_data', 'vehicle_cmds'])`)}

  <h2 id="refresh">Refresh</h2>
  <p>Give the client a token set and it refreshes on demand, one minute before expiry. Concurrent requests share a single in-flight refresh rather than stampeding the token endpoint.</p>
  ${codeBlock(`const client = new TeslaClient({
  clientId,
  clientSecret,
  tokens: { accessToken, refreshToken, expiresAt },
})`)}

  <h2 id="stores">Token stores</h2>
  <p>Persist credentials across restarts with any store that satisfies the interface. Reads and writes may be async.</p>
  ${codeBlock(`import { createTokenStore } from '${p.name}'

const tokenStore = createTokenStore({
  get: () => db.tokens.find(userId),
  set: (tokens) => db.tokens.upsert(userId, tokens),
})`)}
  <div class="note note-danger">
    <span class="note-icon">▲</span>
    <div><strong>A refresh token is a password.</strong> It grants the same access until revoked. Encrypt it at rest, and never log it.</div>
  </div>

  <h2 id="scopes">Scopes</h2>
  <div class="table-wrap"><table>
    <thead><tr><th>Scope</th><th>Grants</th></tr></thead>
    <tbody>
      ${[
        ['openid', 'Sign in with Tesla'],
        ['offline_access', 'A refresh token'],
        ['user_data', 'Contact information, address, profile'],
        ['vehicle_device_data', 'Live vehicle data, service history, upgrades'],
        ['vehicle_location', 'Precise and coarse location'],
        ['vehicle_cmds', 'Driver management, unlock, wake, remote start'],
        ['vehicle_charging_cmds', 'Charging history and start, stop, schedule'],
        ['energy_device_data', 'Energy live status, site info, history'],
        ['energy_cmds', 'Backup reserve, operation mode, storm mode'],
        ['vehicle_specs', 'Detailed specifications. Partner tokens only'],
        ['vehicle_pricing_info', 'Pricing by market and model. Partner tokens only'],
        ['enterprise_management', 'Enterprise functions for business accounts'],
      ]
        .map(([s, d]) => `<tr><td><code>${s}</code></td><td>${d}</td></tr>`)
        .join('')}
    </tbody>
  </table></div>

  <h2 id="virtual-keys">Virtual keys</h2>
  <p>Commanding a 2021+ vehicle requires a virtual key paired to the car. Host your public key, register the domain, then send the user to the pairing link.</p>
  ${codeBlock(`import { virtualKeyPairingUrl, publicKeyUrl } from '${p.name}'

publicKeyUrl('example.com')
// https://example.com/.well-known/appspecific/com.tesla.3p.public-key.pem

virtualKeyPairingUrl({ domain: 'example.com', vin })
// https://tesla.com/_ak/example.com?vin=...`)}`
}
