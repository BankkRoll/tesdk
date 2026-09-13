/**
 * @file Documentation site runtime.
 *
 * Renders every page from `api.json`, which is regenerated from the emitted
 * declarations on each build, so the reference cannot drift from the code.
 * Routing is hash-based, which keeps the site a single static file set that
 * GitHub Pages can serve without rewrite rules.
 */

/** @type {any} */
let API = null

const $ = (sel, root = document) => root.querySelector(sel)

/** Escapes text for safe interpolation into HTML. */
const esc = (s = '') =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  )

/** Renders a limited Markdown subset: inline code, bold, links, paragraphs. */
function md(text = '') {
  if (!text) return ''
  return text
    .split(/\n\n+/)
    .map((para) => {
      const html = esc(para)
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\bhttps?:\/\/[^\s<)]+/g, (u) => `<a href="${u}" target="_blank" rel="noopener">${u}</a>`)
        .replace(/\n/g, ' ')
      return `<p>${html}</p>`
    })
    .join('')
}

/** Minimal TypeScript tokenizer for code blocks. */
function highlight(code) {
  const KEYWORDS =
    /\b(const|let|var|function|return|await|async|import|export|from|type|interface|class|extends|implements|new|if|else|for|of|in|try|catch|finally|throw|typeof|instanceof|as|declare|readonly|public|private|void|null|undefined|true|false|this)\b/g

  /** @type {{start:number,end:number,cls:string}[]} */
  const spans = []
  const claim = (re, cls) => {
    for (const m of code.matchAll(re)) {
      const start = m.index
      const end = start + m[0].length
      if (spans.some((s) => start < s.end && end > s.start)) continue
      spans.push({ start, end, cls })
    }
  }

  // Order matters: comments and strings claim their range before keywords, so
  // a keyword inside a string is not highlighted as code.
  claim(/\/\/[^\n]*/g, 'tok-com')
  claim(/'[^'\n]*'|"[^"\n]*"|`[^`]*`/g, 'tok-str')
  claim(KEYWORDS, 'tok-key')
  claim(/\b\d[\d_.]*\b/g, 'tok-num')
  claim(/\b[A-Z][A-Za-z0-9]*\b/g, 'tok-type')
  claim(/\b[a-z][A-Za-z0-9]*(?=\()/g, 'tok-fn')

  spans.sort((a, b) => a.start - b.start)

  let out = ''
  let at = 0
  for (const s of spans) {
    if (s.start < at) continue
    out += esc(code.slice(at, s.start))
    out += `<span class="${s.cls}">${esc(code.slice(s.start, s.end))}</span>`
    at = s.end
  }
  return out + esc(code.slice(at))
}

/** Renders a copyable code block. */
function codeBlock(code, label = '') {
  return `<div class="code">
    ${label ? `<div class="code-head">${esc(label)}</div>` : ''}
    <button class="code-copy" aria-label="Copy code">${ICON.copy}</button>
    <pre><code>${highlight(code)}</code></pre>
  </div>`
}

const ICON = {
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m5 13 4 4L19 7"/></svg>',
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></svg>',
  github: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 1.5a10.5 10.5 0 0 0-3.3 20.5c.5.1.7-.2.7-.5v-2c-2.9.6-3.5-1.3-3.5-1.3-.5-1.2-1.2-1.5-1.2-1.5-.9-.7.1-.7.1-.7 1 .1 1.6 1.1 1.6 1.1.9 1.6 2.4 1.1 3 .9.1-.7.4-1.1.7-1.4-2.3-.3-4.8-1.2-4.8-5.2 0-1.1.4-2 1-2.8-.1-.3-.4-1.3.1-2.7 0 0 .9-.3 2.8 1a9.6 9.6 0 0 1 5 0c1.9-1.3 2.8-1 2.8-1 .5 1.4.2 2.4.1 2.7.7.8 1 1.7 1 2.8 0 4-2.5 4.9-4.8 5.2.4.3.7 1 .7 2v3c0 .3.2.6.7.5A10.5 10.5 0 0 0 12 1.5Z"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h16"/></svg>',
  npm: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M2 6h20v11h-10v2H7v-2H2V6Zm2 2v7h3V10h2v5h2V8H4Zm9 0v7h2v-2h3V8h-5Zm2 2h1v3h-1v-3Zm4-2v7h2V10h1v5h2V8h-5Z"/></svg>',
}

/* ── Pages ─────────────────────────────────────────────────────────────── */

function pageHome() {
  const p = API.package
  const s = API.stats

  return `
  <div class="hero">
    <h1>${esc(p.name.split('/').pop())}</h1>
    <p class="lede">${esc(p.description)}</p>
    <div class="hero-actions">
      <a class="btn btn-primary" href="#/quickstart">Get started</a>
      <a class="btn btn-ghost" href="#/api">API reference</a>
      <a class="btn btn-ghost" href="${p.repository}" target="_blank" rel="noopener">${ICON.github} GitHub</a>
    </div>
    <div class="stats">
      <div><div class="stat-n">${s.methods}</div><div class="stat-l">typed methods</div></div>
      <div><div class="stat-n">${s.namespaces}</div><div class="stat-l">namespaces</div></div>
      <div><div class="stat-n">0</div><div class="stat-l">runtime deps</div></div>
      <div><div class="stat-n">6</div><div class="stat-l">runtimes</div></div>
    </div>
  </div>

  <h2 id="install">Install</h2>
  ${codeBlock(`npm install ${p.name}`, 'terminal')}

  ${codeBlock(`import { TeslaClient } from '${p.name}'

const client = new TeslaClient({ region: 'na', accessToken: process.env.TESLA_TOKEN })

const [vehicle] = await client.vehicles.list()
const data = await client.vehicles.data(vehicle.vin, { endpoints: ['charge_state'] })

console.log(\`\${data.charge_state?.battery_level}%\`)`)}

  <h2 id="why">Why this SDK</h2>
  <div class="grid">
    ${[
      ['Runs everywhere', 'Web Standards only — fetch, AbortSignal, URL, Web Crypto. Node 20+, browsers, Deno, Bun, Cloudflare Workers, Vercel Edge.'],
      ['Zero dependencies', 'Nothing in the runtime tree to audit, and nothing that can break underneath you.'],
      ['Fully typed', 'Every endpoint, payload, and error. No <code>any</code>, no unsafe casts.'],
      ['Safe commands', 'Commands with a visible physical effect are never retried, so a horn never honks twice.'],
      ['Honest about Tesla', 'Regional token binding, sleeping vehicles, and command signing are modelled, not hidden.'],
      ['Attested builds', 'Published from CI with npm provenance and an immutable action supply chain.'],
    ]
      .map(([t, d]) => `<div class="card"><div class="card-t">${t}</div><div class="card-d">${d}</div></div>`)
      .join('')}
  </div>

  <h2 id="namespaces">Namespaces</h2>
  <div class="grid">
    ${API.namespaces
      .map(
        (ns) => `<a class="card" href="#/api/${ns.key}">
          <div class="card-t"><code>client.${ns.key}</code><span class="nav-count">${ns.members.filter((m) => m.kind === 'method').length}</span></div>
          <div class="card-d">${esc(ns.blurb)}</div>
        </a>`,
      )
      .join('')}
  </div>`
}

function pageQuickstart() {
  const p = API.package
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

function pageGuides() {
  const p = API.package
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

function pageAuth() {
  const p = API.package
  return `
  <h1>Authentication</h1>
  <p class="lede">Three token types, each for a different relationship between your application and the vehicles it reaches.</p>

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

function pageErrors() {
  return `
  <h1>Errors</h1>
  <p class="lede">Every failure is a <code>TeslaError</code> subclass, discriminable by class or by a stable <code>code</code>.</p>

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
function member(m, nsKey) {
  const id = `${nsKey}-${m.name}`
  const meta = []

  if (m.params.length) {
    meta.push(`<div class="api-meta-row"><div class="api-meta-k">Params</div><div class="api-meta-v">${m.params
      .map((pp) => {
        const [name, ...rest] = pp.split(/\s+-\s+/)
        return `<div><code>${esc(name.trim())}</code> ${md(rest.join(' - ')).replace(/^<p>|<\/p>$/g, '')}</div>`
      })
      .join('')}</div></div>`)
  }
  if (m.returns) {
    meta.push(`<div class="api-meta-row"><div class="api-meta-k">Returns</div><div class="api-meta-v">${md(m.returns).replace(/^<p>|<\/p>$/g, '')}</div></div>`)
  }
  if (m.throws.length) {
    meta.push(`<div class="api-meta-row"><div class="api-meta-k">Throws</div><div class="api-meta-v">${m.throws.map((t) => md(t).replace(/^<p>|<\/p>$/g, '')).join('')}</div></div>`)
  }

  return `<div class="api-item" id="${id}">
    <div class="api-sig">
      <span class="api-name">${esc(m.name)}</span>
      <span class="api-type t-${m.kind}">${m.kind}</span>
      ${m.deprecated ? '<span class="api-type t-deprecated">deprecated</span>' : ''}
      ${m.throws.length ? '<span class="api-type t-throws">throws</span>' : ''}
    </div>
    ${codeBlock(m.signature)}
    ${m.doc ? `<div class="api-doc">${md(m.doc)}</div>` : ''}
    ${meta.length ? `<div class="api-meta">${meta.join('')}</div>` : ''}
    ${m.examples.map((ex) => codeBlock(ex.code, ex.title)).join('')}
  </div>`
}

function pageApiIndex() {
  return `
  <h1>API reference</h1>
  <p class="lede">Generated from the shipped type declarations, so it always matches the installed version.</p>

  <h2 id="client">Client</h2>
  ${codeBlock(`const client = new TeslaClient({
  region: 'na',                    // 'na' | 'eu' | 'cn'
  accessToken,                     // or tokens / tokenStore for auto-refresh
  baseUrl,                         // Vehicle Command Proxy address
  ocpiToken, ocpiBaseUrl,          // Charging API, a separate product
  timeoutMs: 30_000,
  retry: { maxRetries: 2, initialDelayMs: 500, maxDelayMs: 8_000 },
  onRequest: (info) => logger.info(info),
  fetch,                           // custom fetch implementation
  headers,                         // added to every request
})`)}

  <h2 id="namespaces">Namespaces</h2>
  <div class="grid">
    ${API.namespaces
      .map(
        (ns) => `<a class="card" href="#/api/${ns.key}">
          <div class="card-t"><code>client.${ns.key}</code><span class="nav-count">${ns.members.filter((m) => m.kind === 'method').length}</span></div>
          <div class="card-d">${esc(ns.blurb)}</div>
        </a>`,
      )
      .join('')}
  </div>

  <h2 id="types">Types</h2>
  <p>${API.shapes.length} exported interfaces and type aliases. <a href="#/types">Browse them →</a></p>`
}

function pageNamespace(key) {
  const ns = API.namespaces.find((n) => n.key === key)
  if (!ns) return `<h1>Not found</h1><p>No namespace named <code>${esc(key)}</code>.</p>`

  const methods = ns.members.filter((m) => m.kind === 'method')
  const props = ns.members.filter((m) => m.kind !== 'method')

  return `
  <h1><code>client.${esc(ns.key)}</code></h1>
  <p class="lede">${esc(ns.blurb)}</p>
  ${ns.doc ? `<div class="api-doc">${md(ns.doc)}</div>` : ''}
  ${ns.see.length ? `<div class="note"><span class="note-icon">→</span><div>${ns.see.map((s) => md(s)).join('')}</div></div>` : ''}
  ${ns.examples.map((ex) => codeBlock(ex.code, ex.title)).join('')}

  ${props.length ? `<h2 id="properties">Properties</h2>${props.map((m) => member(m, ns.key)).join('')}` : ''}
  <h2 id="methods">Methods <span class="nav-count">${methods.length}</span></h2>
  ${methods.map((m) => member(m, ns.key)).join('')}`
}

function pageTypes() {
  const interfaces = API.shapes.filter((s) => s.kind === 'interface')
  const aliases = API.shapes.filter((s) => s.kind === 'type')

  return `
  <h1>Types</h1>
  <p class="lede">${interfaces.length} interfaces and ${aliases.length} type aliases, exported from the package root.</p>

  <h2 id="aliases">Type aliases</h2>
  ${aliases
    .map(
      (t) => `<div class="api-item" id="type-${t.name}">
        <div class="api-sig"><span class="api-name">${esc(t.name)}</span><span class="api-type t-property">type</span></div>
        ${codeBlock(`type ${t.name} = ${t.definition}`)}
        ${t.doc ? `<div class="api-doc">${md(t.doc)}</div>` : ''}
      </div>`,
    )
    .join('')}

  <h2 id="interfaces">Interfaces</h2>
  ${interfaces
    .map(
      (t) => `<div class="api-item" id="type-${t.name}">
        <div class="api-sig"><span class="api-name">${esc(t.name)}</span><span class="api-type t-method">interface</span></div>
        ${t.doc ? `<div class="api-doc">${md(t.doc)}</div>` : ''}
        ${
          t.fields.length
            ? `<div class="table-wrap"><table>
                <thead><tr><th>Field</th><th>Type</th><th>Description</th></tr></thead>
                <tbody>${t.fields
                  .map(
                    (f) =>
                      `<tr><td><code>${esc(f.name)}</code>${f.optional ? '<span class="nav-count">?</span>' : ''}</td><td><code>${esc(f.type)}</code></td><td>${md(f.doc).replace(/^<p>|<\/p>$/g, '')}</td></tr>`,
                  )
                  .join('')}</tbody>
              </table></div>`
            : ''
        }
      </div>`,
    )
    .join('')}`
}

function pageExamples() {
  const repo = API.package.repository
  return `
  <h1>Examples</h1>
  <p class="lede">Four runnable applications and 45 focused snippets, all typechecked in CI against the built SDK.</p>

  <h2 id="apps">Applications</h2>
  <div class="grid">
    ${[
      ['Node CLI', 'Browser OAuth with a loopback server, file-backed tokens, wake handling.', 'node-cli'],
      ['Next.js 16', 'Server Actions, httpOnly cookie sessions, streaming with Suspense.', 'nextjs-app'],
      ['Vite SPA', 'PKCE in the browser, and the dev proxy Tesla&rsquo;s missing CORS headers force.', 'vite-spa'],
      ['Cloudflare Worker', 'Cron fleet monitor, KV token store, zero Node built-ins.', 'cloudflare-worker'],
    ]
      .map(
        ([t, d, dir]) =>
          `<a class="card" href="${repo}/tree/main/examples/${dir}" target="_blank" rel="noopener">
            <div class="card-t">${t}</div><div class="card-d">${d}</div></a>`,
      )
      .join('')}
  </div>

  <h2 id="snippets">Snippets</h2>
  <div class="grid">
    ${[
      ['Auth', 8, 'auth'],
      ['Vehicles', 8, 'vehicles'],
      ['Commands', 9, 'commands'],
      ['Energy', 6, 'energy'],
      ['Telemetry', 4, 'telemetry'],
      ['Errors', 4, 'errors'],
      ['Patterns', 6, 'patterns'],
    ]
      .map(
        ([t, n, dir]) =>
          `<a class="card" href="${repo}/tree/main/examples/code-snippets/${dir}" target="_blank" rel="noopener">
            <div class="card-t">${t}<span class="nav-count">${n}</span></div></a>`,
      )
      .join('')}
  </div>`
}

/* ── Router ────────────────────────────────────────────────────────────── */

const ROUTES = [
  { path: '/', title: 'Overview', render: pageHome },
  { path: '/quickstart', title: 'Quickstart', render: pageQuickstart },
  { path: '/auth', title: 'Authentication', render: pageAuth },
  { path: '/guides', title: 'Guides', render: pageGuides },
  { path: '/errors', title: 'Errors', render: pageErrors },
  { path: '/api', title: 'API reference', render: pageApiIndex },
  { path: '/types', title: 'Types', render: pageTypes },
  { path: '/examples', title: 'Examples', render: pageExamples },
]

function renderSidebar(active) {
  const link = (href, label, count) =>
    `<a class="nav-link${href === active ? ' active' : ''}" href="#${href}">${label}${
      count ? `<span class="nav-count">${count}</span>` : ''
    }</a>`

  return `
    <div class="nav-group">
      <div class="nav-title">Getting started</div>
      ${link('/', 'Overview')}
      ${link('/quickstart', 'Quickstart')}
      ${link('/auth', 'Authentication')}
      ${link('/guides', 'Guides')}
      ${link('/errors', 'Errors')}
    </div>
    <div class="nav-group">
      <div class="nav-title">Reference</div>
      ${link('/api', 'Overview')}
      ${API.namespaces
        .map((ns) => link(`/api/${ns.key}`, `<code>${ns.key}</code>`, ns.members.filter((m) => m.kind === 'method').length))
        .join('')}
      ${link('/types', 'Types', API.shapes.length)}
    </div>
    <div class="nav-group">
      <div class="nav-title">Resources</div>
      ${link('/examples', 'Examples')}
      <a class="nav-link" href="${API.package.repository}" target="_blank" rel="noopener">GitHub</a>
      <a class="nav-link" href="https://www.npmjs.com/package/${API.package.name}" target="_blank" rel="noopener">npm</a>
      <a class="nav-link" href="https://developer.tesla.com/docs/fleet-api" target="_blank" rel="noopener">Fleet API docs</a>
    </div>`
}

/** Builds the right-hand table of contents from rendered headings. */
function renderToc() {
  const heads = [...$('.main').querySelectorAll('h2[id], h3[id]')]
  if (heads.length < 2) return ''
  return `<div class="toc-title">On this page</div>${heads
    .map((h) => `<a class="lvl-${h.tagName[1]}" href="#${h.id}">${h.textContent.replace(/\s*\d+$/, '')}</a>`)
    .join('')}`
}

function route() {
  const hash = location.hash.replace(/^#/, '') || '/'
  const nsMatch = /^\/api\/(\w+)$/.exec(hash)

  const page = nsMatch
    ? { title: `client.${nsMatch[1]}`, render: () => pageNamespace(nsMatch[1]) }
    : (ROUTES.find((r) => r.path === hash) ?? ROUTES[0])

  $('.main').innerHTML = page.render()
  $('.sidebar').innerHTML = renderSidebar(hash)
  $('.toc').innerHTML = renderToc()

  document.title = `${page.title} · ${API.package.name}`
  window.scrollTo({ top: 0 })

  $('.sidebar').classList.remove('open')
  $('.scrim').classList.remove('open')

  wireCopy()
  wireScrollSpy()
}

function wireCopy() {
  for (const btn of document.querySelectorAll('.code-copy')) {
    btn.addEventListener('click', async () => {
      const code = btn.parentElement.querySelector('code').textContent
      try {
        await navigator.clipboard.writeText(code)
        btn.innerHTML = ICON.check
        btn.classList.add('done')
        setTimeout(() => {
          btn.innerHTML = ICON.copy
          btn.classList.remove('done')
        }, 1400)
      } catch {
        // Clipboard access can be denied; leaving the icon unchanged is the
        // honest signal that nothing was copied.
      }
    })
  }
}

/** Highlights the table-of-contents entry for the heading in view. */
function wireScrollSpy() {
  const links = [...document.querySelectorAll('.toc a')]
  if (!links.length) return

  const observer = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue
        for (const l of links) l.classList.toggle('active', l.getAttribute('href') === `#${e.target.id}`)
      }
    },
    { rootMargin: '-80px 0px -70% 0px' },
  )

  for (const h of document.querySelectorAll('.main h2[id], .main h3[id]')) observer.observe(h)
}

/* ── Search ────────────────────────────────────────────────────────────── */

function buildIndex() {
  const items = []
  for (const ns of API.namespaces) {
    items.push({ name: `client.${ns.key}`, ns: 'namespace', doc: ns.blurb, href: `#/api/${ns.key}` })
    for (const m of ns.members) {
      items.push({ name: m.name, ns: `client.${ns.key}`, doc: m.doc.split('\n')[0], href: `#/api/${ns.key}` })
    }
  }
  for (const e of API.errors) items.push({ name: e.name, ns: 'error', doc: e.doc.split('\n')[0], href: '#/errors' })
  for (const t of API.shapes) items.push({ name: t.name, ns: t.kind, doc: t.doc.split('\n')[0], href: `#/types` })
  for (const r of ROUTES) items.push({ name: r.title, ns: 'page', doc: '', href: `#${r.path}` })
  return items
}

function wireSearch() {
  const index = buildIndex()
  const overlay = $('.overlay')
  const input = $('.search-field input')
  const results = $('.search-results')
  let selected = 0

  const open = () => {
    overlay.classList.add('open')
    input.value = ''
    input.focus()
    render('')
  }
  const close = () => overlay.classList.remove('open')

  function render(q) {
    const query = q.trim().toLowerCase()
    const hits = (
      query
        ? index
            .map((i) => {
              const name = i.name.toLowerCase()
              let score = 0
              if (name === query) score = 100
              else if (name.startsWith(query)) score = 80
              else if (name.includes(query)) score = 60
              else if (i.doc.toLowerCase().includes(query)) score = 20
              return { ...i, score }
            })
            .filter((i) => i.score > 0)
            .sort((a, b) => b.score - a.score || a.name.length - b.name.length)
        : index.filter((i) => i.ns === 'page' || i.ns === 'namespace')
    ).slice(0, 24)

    selected = 0
    results.innerHTML = hits.length
      ? hits
          .map(
            (h, i) =>
              `<div class="sr${i === 0 ? ' sel' : ''}" data-href="${h.href}">
                <span class="sr-name">${esc(h.name)}</span>
                <span class="sr-ns">${esc(h.ns)}</span>
                ${h.doc ? `<span class="sr-d">${esc(h.doc)}</span>` : ''}
              </div>`,
          )
          .join('')
      : '<div class="search-empty">No matches</div>'

    for (const el of results.querySelectorAll('.sr')) {
      el.addEventListener('click', () => {
        location.hash = el.dataset.href
        close()
      })
    }
  }

  const move = (delta) => {
    const items = [...results.querySelectorAll('.sr')]
    if (!items.length) return
    items[selected]?.classList.remove('sel')
    selected = (selected + delta + items.length) % items.length
    items[selected].classList.add('sel')
    items[selected].scrollIntoView({ block: 'nearest' })
  }

  input.addEventListener('input', () => render(input.value))

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault()
      overlay.classList.contains('open') ? close() : open()
      return
    }
    if (e.key === '/' && !/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)) {
      e.preventDefault()
      open()
      return
    }
    if (!overlay.classList.contains('open')) return

    if (e.key === 'Escape') close()
    else if (e.key === 'ArrowDown') { e.preventDefault(); move(1) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1) }
    else if (e.key === 'Enter') {
      const el = results.querySelectorAll('.sr')[selected]
      if (el) { location.hash = el.dataset.href; close() }
    }
  })

  $('.search-open').addEventListener('click', open)
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close() })
}

/* ── Boot ──────────────────────────────────────────────────────────────── */

async function boot() {
  API = await fetch('assets/api.json').then((r) => r.json())

  $('.brand-ver').textContent = `v${API.package.version}`
  $('.gh-link').href = API.package.repository
  $('.npm-link').href = `https://www.npmjs.com/package/${API.package.name}`
  $('.foot-repo').href = API.package.repository

  const themeBtn = $('.theme-btn')
  const paintTheme = () => {
    themeBtn.innerHTML = document.documentElement.classList.contains('dark') ? ICON.sun : ICON.moon
  }
  themeBtn.addEventListener('click', () => {
    const dark = document.documentElement.classList.toggle('dark')
    localStorage.setItem('theme', dark ? 'dark' : 'light')
    paintTheme()
  })
  paintTheme()

  $('.menu-btn').innerHTML = ICON.menu
  $('.menu-btn').addEventListener('click', () => {
    $('.sidebar').classList.toggle('open')
    $('.scrim').classList.toggle('open')
  })
  $('.scrim').addEventListener('click', () => {
    $('.sidebar').classList.remove('open')
    $('.scrim').classList.remove('open')
  })

  $('.search-open').insertAdjacentHTML('afterbegin', ICON.search)
  $('.search-field').insertAdjacentHTML('afterbegin', ICON.search)
  $('.gh-link').innerHTML = ICON.github
  $('.npm-link').innerHTML = ICON.npm

  wireSearch()
  window.addEventListener('hashchange', route)
  route()
}

boot()
