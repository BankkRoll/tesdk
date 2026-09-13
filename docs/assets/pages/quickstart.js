/**
 * @file Step-by-step from install to a first command.
 */

import { getApi } from '../lib/data.js'

import { codeBlock } from '../components/ui.js'

export function pageQuickstart() {
  const p = getApi().package
  return `
  <h1>Quickstart</h1>
  <p class="lede">From an empty project to reading live vehicle data.</p>

  <h2 id="install">1. Install</h2>
  ${codeBlock(`npm install ${p.name}`, 'terminal')}

  <h2 id="credentials">2. Register an application</h2>
  <p>Create an application at <a href="https://developer.tesla.com" target="_blank" rel="noopener">developer.tesla.com</a>. You need a client ID, a client secret for confidential clients, and at least one allowed redirect URI.</p>
  <div class="note note-warn">
    <span class="note-icon">▲</span>
    <div><strong>Register once per region.</strong> A token minted for one region is rejected by the others, and so is a partner registration.</div>
  </div>

  <h2 id="authorize">3. Authorize a user</h2>
  <p>Public clients use PKCE and hold no secret. Persist the verifier and state against the user's session before redirecting.</p>
  ${codeBlock(`import { TeslaClient, createPkcePair, randomString } from '${p.name}'

const client = new TeslaClient({
  region: 'na',
  clientId: process.env.TESLA_CLIENT_ID,
  clientSecret: process.env.TESLA_CLIENT_SECRET,
  redirectUri: 'https://example.com/callback',
})

const pkce = await createPkcePair()
const state = randomString()

const url = client.oauth.authorizeUrl({
  scopes: ['vehicle_device_data', 'vehicle_cmds'],
  state,
  pkce,
})`)}

  <p>Then exchange the code your callback receives:</p>
  ${codeBlock(`const tokens = await client.oauth.exchangeCode({
  code,
  codeVerifier: pkce.verifier,
})`)}

  <h2 id="read">4. Read vehicle data</h2>
  ${codeBlock(`const vehicles = await client.vehicles.list()

// Requesting only the subtrees you need keeps the payload small and
// shortens how long the vehicle stays awake.
const data = await client.vehicles.data(vehicles[0].vin, {
  endpoints: ['charge_state', 'climate_state'],
})

console.log(data.charge_state?.battery_level)`)}

  <h2 id="command">5. Send a command</h2>
  ${codeBlock(`await client.vehicles.withWake(vin, () => client.commands.doorLock(vin))`)}
  <p><code>withWake</code> runs the operation and, if the vehicle turns out to be asleep, wakes it and retries exactly once.</p>

  <h2 id="next">Next</h2>
  <div class="grid">
    <a class="card" href="#/auth"><div class="card-t">Authentication</div><div class="card-d">PKCE, partner and business tokens, refresh, and custom stores.</div></a>
    <a class="card" href="#/guides"><div class="card-t">Guides</div><div class="card-d">Regions, signing, waking, retries, and telemetry.</div></a>
    <a class="card" href="#/api"><div class="card-t">API reference</div><div class="card-d">Every method, generated from the shipped types.</div></a>
  </div>`
}
