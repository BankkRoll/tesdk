/**
 * @file The error hierarchy and how to discriminate it.
 */

import { codeBlock } from '../components/ui.js'
import { ICON } from '../icons.js'
import { pageHeader } from '../components/page-header.js'

export function pageErrors() {
  return `
  ${pageHeader({
    section: 'Getting started',
    title: 'Errors',
    lede: 'Every failure is a <code>TeslaError</code> subclass, discriminable by class or by a stable <code>code</code>.',
    meta: [{ label: '10 error classes', icon: ICON.shield }],
  })}

  ${codeBlock(`try {
  await client.commands.doorLock(vin)
} catch (error) {
  if (error instanceof VehicleAsleepError) await client.vehicles.ensureAwake(vin)
  else if (error instanceof RateLimitError) console.warn(\`retry in \${error.retryAfter}s\`)
  else if (error instanceof TeslaError) console.error(error.code, error.requestId)
}`)}

  <div class="table-wrap"><table>
    <thead><tr><th>Class</th><th>Code</th><th>HTTP</th><th>Meaning</th></tr></thead>
    <tbody>
      ${[
        ['InvalidRequestError', 'invalid_request', '400, 422', 'Malformed or rejected parameters'],
        ['AuthenticationError', 'authentication_error', '401', 'Token missing, expired, or rejected'],
        ['PermissionError', 'permission_error', '403', 'Missing scope or no access'],
        ['SigningRequiredError', 'signing_required', '403', 'Command needs the Vehicle Command Proxy'],
        ['NotFoundError', 'not_found', '404', 'Unknown VIN, site, or route'],
        ['VehicleAsleepError', 'vehicle_asleep', '408', 'Vehicle asleep or out of coverage'],
        ['RateLimitError', 'rate_limit', '429', 'Throttled — carries <code>retryAfter</code>'],
        ['ServerError', 'server_error', '5xx', 'Tesla-side failure'],
        ['ConnectionError', 'connection_error', '—', 'DNS, TLS, socket, or CORS'],
        ['TimeoutError', 'timeout', '—', 'Deadline exceeded or caller aborted'],
      ]
        .map(
          ([c, code, http, m]) =>
            `<tr><td><code>${c}</code></td><td><code>${code}</code></td><td>${http}</td><td>${m}</td></tr>`,
        )
        .join('')}
    </tbody>
  </table></div>

  <h2 id="request-id">Request ids</h2>
  <p>Every error carries <code>requestId</code>, read from Tesla's <code>x-txid</code> response header. It is the identifier Tesla support asks for, and it is safe to include in a public bug report — unlike a token.</p>

  <h2 id="cancellation">Cancellation and timeouts</h2>
  <p>Every method accepts a per-call <code>signal</code> and <code>timeoutMs</code>, composed with the client default.</p>
  ${codeBlock(`const controller = new AbortController()
setTimeout(() => controller.abort(), 5_000)

await client.vehicles.list({ signal: controller.signal })`)}
  <p>A caller-initiated abort is never retried, since it was deliberate.</p>`
}

/** Renders one class member as an API entry. */
