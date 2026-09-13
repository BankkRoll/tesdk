/**
 * @file Regions, signing, waking, retries, telemetry, and CORS.
 */

import { getApi } from '../lib/data.js'

import { codeBlock } from '../components/ui.js'

export function pageGuides() {
  const p = getApi().package
  return `
  <h1>Guides</h1>
  <p class="lede">The parts of the Fleet API that surprise people, and how this SDK models them.</p>

  <h2 id="regions">Regions</h2>
  <p>Fleet API is partitioned into three isolated deployments. A token minted for one is rejected by the others, so the region is a correctness concern rather than a latency optimization.</p>
  <div class="table-wrap"><table>
    <thead><tr><th>Region</th><th>Host</th><th>Coverage</th></tr></thead>
    <tbody>
      <tr><td><code>na</code></td><td><code>fleet-api.prd.na.vn.cloud.tesla.com</code></td><td>North America, Asia-Pacific</td></tr>
      <tr><td><code>eu</code></td><td><code>fleet-api.prd.eu.vn.cloud.tesla.com</code></td><td>Europe, Middle East, Africa</td></tr>
      <tr><td><code>cn</code></td><td><code>fleet-api.prd.cn.vn.cloud.tesla.cn</code></td><td>China</td></tr>
    </tbody>
  </table></div>
  <p>If you do not know the region ahead of time, let the API report it:</p>
  ${codeBlock(`const client = await new TeslaClient({ accessToken }).forUserRegion()`)}

  <h2 id="signing">Command signing</h2>
  <p>Vehicles from 2021 onward reject unsigned commands. Signing is not something an HTTP layer can do for you: commands are re-encoded as protobuf and signed with your private key over the Vehicle Command Protocol, and the car verifies that signature against its stored virtual key.</p>
  <p>Ask which of your vehicles require it:</p>
  ${codeBlock(`const status = await client.vehicles.fleetStatus([vin])
status.vehicle_info?.[vin]?.vehicle_command_protocol_required`)}
  <p>Then run Tesla's <a href="https://github.com/teslamotors/vehicle-command" target="_blank" rel="noopener">Vehicle Command Proxy</a> as a sidecar and point the client at it. Nothing else changes:</p>
  ${codeBlock(`const client = new TeslaClient({ baseUrl: 'https://localhost:4443', accessToken })`)}
  <div class="note note-danger">
    <span class="note-icon">▲</span>
    <div><strong>Never put the private key in your application process.</strong> Tesla's guidance is a KMS or HSM. Only the public key is ever hosted, at <code>/.well-known/appspecific/com.tesla.3p.public-key.pem</code>.</div>
  </div>

  <h2 id="waking">Waking vehicles</h2>
  <p>Waking draws down the traction battery, so the SDK never does it implicitly. Opt in explicitly:</p>
  ${codeBlock(`await client.vehicles.ensureAwake(vin)

// Or run an operation and retry once if the vehicle turns out to be asleep:
const data = await client.vehicles.withWake(vin, () => client.vehicles.data(vin))`)}
  <p>A sleeping vehicle surfaces as <code>VehicleAsleepError</code>, which maps to HTTP 408. That status is deliberately excluded from retries: without an explicit wake, no retry can succeed.</p>

  <h2 id="retries">Retries and idempotency</h2>
  <p>Idempotent requests retry on 429, 425, and 5xx using exponential backoff with full jitter, honouring <code>Retry-After</code> when present.</p>
  <p>Commands with a visible physical effect are <strong>never</strong> retried, because a transient failure must not actuate the car twice:</p>
  <div class="table-wrap"><table>
    <thead><tr><th>Never retried</th><th>Retried</th></tr></thead>
    <tbody>
      <tr><td><code>honkHorn</code>, <code>flashLights</code>, <code>actuateTrunk</code>, media controls, <code>remoteBoombox</code>, <code>createShareInvite</code></td>
          <td><code>doorLock</code>, <code>setChargeLimit</code>, <code>climateStart</code>, and other state-setting commands</td></tr>
    </tbody>
  </table></div>
  ${codeBlock(`const client = new TeslaClient({
  accessToken,
  retry: { maxRetries: 3, initialDelayMs: 500, maxDelayMs: 8_000 },
  timeoutMs: 30_000,
})`)}

  <h2 id="telemetry">Fleet Telemetry</h2>
  <p>Streaming beats polling <code>vehicle_data</code> on both cost and battery drain. Send the configuration through the Vehicle Command Proxy so it is signed:</p>
  ${codeBlock(`await client.telemetry.createConfig([vin], {
  hostname: 'telemetry.example.com',
  ca: caPem,
  fields: {
    Soc: { interval_seconds: 60 },
    Location: { interval_seconds: 10, minimum_delta: 50 },
  },
})`)}

  <h2 id="cors">Browsers and CORS</h2>
  <div class="note note-warn">
    <span class="note-icon">▲</span>
    <div>Tesla sends no permissive CORS headers, so a browser <strong>cannot</strong> call Fleet API directly. Proxy through your own backend. The SDK runs fine in a browser; the network policy is the obstacle.</div>
  </div>

  <h2 id="observability">Observability</h2>
  ${codeBlock(`const client = new TeslaClient({
  accessToken,
  onRequest: ({ method, url, status, attempt, durationMs }) => {
    logger.info({ method, url, status, attempt, durationMs })
  },
})`)}
  <p>Every error also carries <code>requestId</code>, taken from Tesla's <code>x-txid</code> header. Include it when contacting Tesla support.</p>`
}
