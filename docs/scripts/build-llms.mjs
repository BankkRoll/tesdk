/**
 * @file Generates the machine-readable surface of the docs site.
 *
 * Emits one Markdown file per page, an `llms.txt` index following the
 * llmstxt.org convention, and an `llms-full.txt` single-document dump. Coding
 * agents and RAG pipelines read these instead of scraping rendered HTML, which
 * removes the markup from their context budget.
 *
 * Everything derives from `api.json`, so the Markdown cannot drift from the
 * shipped type declarations.
 *
 * @see {@link https://llmstxt.org}
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const docs = resolve(here, '..')
const API = JSON.parse(readFileSync(resolve(docs, 'assets/api.json'), 'utf8'))

const SITE = 'https://bankkroll.github.io/tesdk'
const PKG = API.package.name

/** Wraps code in a fenced block. */
const fence = (code, lang = 'ts') => `\`\`\`${lang}\n${code}\n\`\`\``

/** Renders one class member as Markdown. */
function memberMd(m) {
  const out = [`### \`${m.name}\``, '']

  if (m.deprecated) out.push(`> **Deprecated.** ${m.deprecated}`, '')
  out.push(fence(m.signature), '')
  if (m.doc) out.push(m.doc, '')

  if (m.params.length) {
    out.push('**Parameters**', '')
    for (const p of m.params) out.push(`- ${p.replace(/^(\S+)/, '`$1`')}`)
    out.push('')
  }
  if (m.returns) out.push(`**Returns** — ${m.returns}`, '')
  if (m.throws.length) {
    out.push('**Throws**', '')
    for (const t of m.throws) out.push(`- ${t}`)
    out.push('')
  }
  for (const ex of m.examples) {
    if (ex.title) out.push(`**${ex.title}**`, '')
    if (ex.code) out.push(fence(ex.code), '')
  }
  for (const s of m.see) out.push(`See: ${s}`, '')

  return out.join('\n')
}

/** Builds the Markdown body for one namespace. */
function namespaceMd(ns) {
  const methods = ns.members.filter((m) => m.kind === 'method')
  const props = ns.members.filter((m) => m.kind !== 'method')

  const out = [`# client.${ns.key}`, '', `> ${ns.blurb}`, '']
  if (ns.doc) out.push(ns.doc, '')
  for (const ex of ns.examples) if (ex.code) out.push(fence(ex.code), '')
  for (const s of ns.see) out.push(`See: ${s}`, '')

  if (props.length) {
    out.push('## Properties', '')
    for (const p of props) out.push(memberMd(p), '')
  }

  out.push(`## Methods`, '')
  for (const m of methods) out.push(memberMd(m), '')

  return out.join('\n')
}

/** Builds the Markdown for the exported types. */
function typesMd() {
  const interfaces = API.shapes.filter((s) => s.kind === 'interface')
  const aliases = API.shapes.filter((s) => s.kind === 'type')

  const out = [
    '# Types',
    '',
    `> ${interfaces.length} interfaces and ${aliases.length} type aliases exported from \`${PKG}\`.`,
    '',
    '## Type aliases',
    '',
  ]

  for (const t of aliases) {
    out.push(`### \`${t.name}\``, '')
    out.push(fence(`type ${t.name} = ${t.definition}`), '')
    if (t.doc) out.push(t.doc, '')
  }

  out.push('## Interfaces', '')
  for (const t of interfaces) {
    out.push(`### \`${t.name}\``, '')
    if (t.doc) out.push(t.doc, '')
    if (t.fields.length) {
      out.push('| Field | Type | Description |', '| --- | --- | --- |')
      for (const f of t.fields) {
        const doc = (f.doc || '').replace(/\n+/g, ' ').replace(/\|/g, '\\|')
        out.push(`| \`${f.name}${f.optional ? '?' : ''}\` | \`${f.type.replace(/\|/g, '\\|')}\` | ${doc} |`)
      }
      out.push('')
    }
  }

  return out.join('\n')
}

/** Errors table plus handling guidance. */
function errorsMd() {
  const rows = [
    ['InvalidRequestError', 'invalid_request', '400, 422', 'Malformed or rejected parameters'],
    ['AuthenticationError', 'authentication_error', '401', 'Token missing, expired, or rejected'],
    ['PermissionError', 'permission_error', '403', 'Missing scope or no access'],
    ['SigningRequiredError', 'signing_required', '403', 'Command needs the Vehicle Command Proxy'],
    ['NotFoundError', 'not_found', '404', 'Unknown VIN, site, or route'],
    ['VehicleAsleepError', 'vehicle_asleep', '408', 'Vehicle asleep or out of coverage'],
    ['RateLimitError', 'rate_limit', '429', 'Throttled; carries `retryAfter`'],
    ['ServerError', 'server_error', '5xx', 'Tesla-side failure'],
    ['ConnectionError', 'connection_error', '—', 'DNS, TLS, socket, or CORS'],
    ['TimeoutError', 'timeout', '—', 'Deadline exceeded or caller aborted'],
  ]

  return [
    '# Errors',
    '',
    '> Every failure is a `TeslaError` subclass, discriminable by class or by a stable `code`.',
    '',
    fence(`try {
  await client.commands.doorLock(vin)
} catch (error) {
  if (error instanceof VehicleAsleepError) await client.vehicles.ensureAwake(vin)
  else if (error instanceof RateLimitError) console.warn(\`retry in \${error.retryAfter}s\`)
  else if (error instanceof TeslaError) console.error(error.code, error.requestId)
}`),
    '',
    '| Class | Code | HTTP | Meaning |',
    '| --- | --- | --- | --- |',
    ...rows.map(([c, code, http, m]) => `| \`${c}\` | \`${code}\` | ${http} | ${m} |`),
    '',
    '## Request ids',
    '',
    "Every error carries `requestId`, read from Tesla's `x-txid` response header. It is",
    'the identifier Tesla support asks for, and unlike a token it is safe to include in',
    'a public bug report.',
    '',
    '## Cancellation',
    '',
    'Every method accepts a per-call `signal` and `timeoutMs`, composed with the client',
    'default. A caller-initiated abort is never retried, since it was deliberate.',
    '',
    fence(`const controller = new AbortController()
setTimeout(() => controller.abort(), 5_000)

await client.vehicles.list({ signal: controller.signal })`),
  ].join('\n')
}

/** Overview page. */
function overviewMd() {
  const s = API.stats
  return [
    `# ${PKG}`,
    '',
    `> ${API.package.description}`,
    '',
    `Version ${API.package.version}. ${s.methods} typed methods across ${s.namespaces}`,
    'namespaces, zero runtime dependencies, MIT licensed.',
    '',
    '## Install',
    '',
    fence(`npm install ${PKG}`, 'sh'),
    '',
    fence(`import { TeslaClient } from '${PKG}'

const client = new TeslaClient({ region: 'na', accessToken: process.env.TESLA_TOKEN })

const [vehicle] = await client.vehicles.list()
const data = await client.vehicles.data(vehicle.vin, { endpoints: ['charge_state'] })

console.log(\`\${data.charge_state?.battery_level}%\`)`),
    '',
    '## Why this SDK',
    '',
    '- **Runs everywhere.** Web Standards only: fetch, AbortSignal, URL, Web Crypto.',
    '  Node 20+, browsers, Deno, Bun, Cloudflare Workers, Vercel Edge.',
    '- **Zero runtime dependencies.**',
    '- **Fully typed.** Every endpoint, payload, and error. No `any`.',
    '- **Safe commands.** Commands with a visible physical effect are never retried,',
    '  so a transient failure cannot honk the horn twice.',
    '- **Honest about Tesla.** Regional token binding, sleeping vehicles, and command',
    '  signing are modelled rather than hidden.',
    '',
    '## Namespaces',
    '',
    ...API.namespaces.map(
      (ns) =>
        `- \`client.${ns.key}\` (${ns.members.filter((m) => m.kind === 'method').length} methods) — ${ns.blurb}`,
    ),
  ].join('\n')
}

/** Quickstart page. */
function quickstartMd() {
  return [
    '# Quickstart',
    '',
    '> From an empty project to reading live vehicle data.',
    '',
    '## 1. Install',
    '',
    fence(`npm install ${PKG}`, 'sh'),
    '',
    '## 2. Register an application',
    '',
    'Create an application at https://developer.tesla.com. You need a client ID, a',
    'client secret for confidential clients, and at least one allowed redirect URI.',
    '',
    'Registration is per-region: a token minted for one region is rejected by the',
    'others, and so is a partner registration.',
    '',
    '## 3. Authorize a user',
    '',
    fence(`import { TeslaClient, createPkcePair, randomString } from '${PKG}'

const client = new TeslaClient({
  region: 'na',
  clientId: process.env.TESLA_CLIENT_ID,
  clientSecret: process.env.TESLA_CLIENT_SECRET,
  redirectUri: 'https://example.com/callback',
})

const pkce = await createPkcePair()
const state = randomString()

// Persist both against the user's session before redirecting.
const url = client.oauth.authorizeUrl({
  scopes: ['vehicle_device_data', 'vehicle_cmds'],
  state,
  pkce,
})`),
    '',
    'Then exchange the code your callback receives:',
    '',
    fence(`const tokens = await client.oauth.exchangeCode({ code, codeVerifier: pkce.verifier })`),
    '',
    '## 4. Read vehicle data',
    '',
    fence(`const vehicles = await client.vehicles.list()

// Requesting only the subtrees you need keeps the payload small and
// shortens how long the vehicle stays awake.
const data = await client.vehicles.data(vehicles[0].vin, {
  endpoints: ['charge_state', 'climate_state'],
})`),
    '',
    '## 5. Send a command',
    '',
    fence(`await client.vehicles.withWake(vin, () => client.commands.doorLock(vin))`),
    '',
    '`withWake` runs the operation and, if the vehicle turns out to be asleep, wakes it',
    'and retries exactly once.',
  ].join('\n')
}

/** Authentication page. */
function authMd() {
  return [
    '# Authentication',
    '',
    '> Three token types, each for a different relationship between your application',
    '> and the vehicles it reaches.',
    '',
    '| Token | Represents | Grant |',
    '| --- | --- | --- |',
    '| Third-party | A person who granted your app access | `authorization_code` + PKCE |',
    '| Partner | Your application itself | `client_credentials` |',
    '| Third-party business | A business fleet | `client_credentials` + `auth_code` |',
    '',
    '## Authorization code with PKCE',
    '',
    fence(`const pkce = await createPkcePair()
const state = randomString()

// Persist both against the user's session before redirecting.
const url = client.oauth.authorizeUrl({ scopes: ['vehicle_device_data'], state, pkce })

// In your callback, after checking that state matches:
const tokens = await client.oauth.exchangeCode({ code, codeVerifier: pkce.verifier })`),
    '',
    '## Partner tokens',
    '',
    'Partner tokens represent the application rather than a user. Required for every',
    '`client.partner` endpoint and for the partner-only `vehicle_specs` and',
    '`vehicle_pricing_info` scopes. They carry no user context, so `client.user`',
    'rejects them.',
    '',
    fence(`await client.oauth.clientCredentials(['openid', 'vehicle_specs'])
await client.partner.register('example.com')`),
    '',
    '## Business tokens',
    '',
    'No browser redirect: a business administrator grants consent once in Tesla for',
    'Business and hands over an authorization code.',
    '',
    fence(`await client.oauth.businessToken(authCode, ['vehicle_device_data', 'vehicle_cmds'])`),
    '',
    '## Refresh',
    '',
    'Give the client a token set and it refreshes on demand, one minute before expiry.',
    'Concurrent requests share a single in-flight refresh rather than stampeding the',
    'token endpoint.',
    '',
    fence(`const client = new TeslaClient({
  clientId,
  clientSecret,
  tokens: { accessToken, refreshToken, expiresAt },
})`),
    '',
    '## Token stores',
    '',
    fence(`import { createTokenStore } from '${PKG}'

const tokenStore = createTokenStore({
  get: () => db.tokens.find(userId),
  set: (tokens) => db.tokens.upsert(userId, tokens),
})`),
    '',
    'A refresh token grants the same access as a password until revoked. Encrypt it at',
    'rest, and never log it.',
    '',
    '## Scopes',
    '',
    '| Scope | Grants |',
    '| --- | --- |',
    '| `openid` | Sign in with Tesla |',
    '| `offline_access` | A refresh token |',
    '| `user_data` | Contact information, address, profile |',
    '| `vehicle_device_data` | Live vehicle data, service history, upgrades |',
    '| `vehicle_location` | Precise and coarse location |',
    '| `vehicle_cmds` | Driver management, unlock, wake, remote start |',
    '| `vehicle_charging_cmds` | Charging history and start, stop, schedule |',
    '| `energy_device_data` | Energy live status, site info, history |',
    '| `energy_cmds` | Backup reserve, operation mode, storm mode |',
    '| `vehicle_specs` | Detailed specifications. Partner tokens only |',
    '| `vehicle_pricing_info` | Pricing by market and model. Partner tokens only |',
    '| `enterprise_management` | Enterprise functions for business accounts |',
    '',
    '## Virtual keys',
    '',
    'Commanding a 2021+ vehicle requires a virtual key paired to the car. Host your',
    'public key, register the domain, then send the user to the pairing link.',
    '',
    fence(`import { virtualKeyPairingUrl, publicKeyUrl } from '${PKG}'

publicKeyUrl('example.com')
// https://example.com/.well-known/appspecific/com.tesla.3p.public-key.pem

virtualKeyPairingUrl({ domain: 'example.com', vin })
// https://tesla.com/_ak/example.com?vin=...`),
  ].join('\n')
}

/** Guides page. */
function guidesMd() {
  return [
    '# Guides',
    '',
    '> The parts of the Fleet API that surprise people, and how this SDK models them.',
    '',
    '## Regions',
    '',
    'Fleet API is partitioned into three isolated deployments. A token minted for one',
    'is rejected by the others, so the region is a correctness concern rather than a',
    'latency optimization.',
    '',
    '| Region | Host | Coverage |',
    '| --- | --- | --- |',
    '| `na` | `fleet-api.prd.na.vn.cloud.tesla.com` | North America, Asia-Pacific |',
    '| `eu` | `fleet-api.prd.eu.vn.cloud.tesla.com` | Europe, Middle East, Africa |',
    '| `cn` | `fleet-api.prd.cn.vn.cloud.tesla.cn` | China |',
    '',
    fence(`const client = await new TeslaClient({ accessToken }).forUserRegion()`),
    '',
    '## Command signing',
    '',
    'Vehicles from 2021 onward reject unsigned commands. Signing is not something an',
    'HTTP layer can do for you: commands are re-encoded as protobuf and signed with',
    'your private key over the Vehicle Command Protocol, and the car verifies that',
    'signature against its stored virtual key.',
    '',
    fence(`const status = await client.vehicles.fleetStatus([vin])
status.vehicle_info?.[vin]?.vehicle_command_protocol_required`),
    '',
    "Run Tesla's Vehicle Command Proxy (https://github.com/teslamotors/vehicle-command)",
    'as a sidecar and point the client at it. Nothing else changes:',
    '',
    fence(`const client = new TeslaClient({ baseUrl: 'https://localhost:4443', accessToken })`),
    '',
    'Never put the private key in your application process. Only the public key is ever',
    'hosted, at `/.well-known/appspecific/com.tesla.3p.public-key.pem`.',
    '',
    '## Waking vehicles',
    '',
    'Waking draws down the traction battery, so the SDK never does it implicitly.',
    '',
    fence(`await client.vehicles.ensureAwake(vin)

// Or run an operation and retry once if the vehicle turns out to be asleep:
const data = await client.vehicles.withWake(vin, () => client.vehicles.data(vin))`),
    '',
    'A sleeping vehicle surfaces as `VehicleAsleepError`, which maps to HTTP 408. That',
    'status is deliberately excluded from retries: without an explicit wake, no retry',
    'can succeed.',
    '',
    '## Retries and idempotency',
    '',
    'Idempotent requests retry on 429, 425, and 5xx using exponential backoff with full',
    'jitter, honouring `Retry-After` when present.',
    '',
    'Commands with a visible physical effect are never retried:',
    '',
    '| Never retried | Retried |',
    '| --- | --- |',
    '| `honkHorn`, `flashLights`, `actuateTrunk`, media controls, `remoteBoombox`, `createShareInvite` | `doorLock`, `setChargeLimit`, `climateStart`, and other state-setting commands |',
    '',
    '## Fleet Telemetry',
    '',
    'Streaming beats polling `vehicle_data` on both cost and battery drain.',
    '',
    fence(`await client.telemetry.createConfig([vin], {
  hostname: 'telemetry.example.com',
  ca: caPem,
  fields: {
    Soc: { interval_seconds: 60 },
    Location: { interval_seconds: 10, minimum_delta: 50 },
  },
})`),
    '',
    '## Browsers and CORS',
    '',
    'Tesla sends no permissive CORS headers, so a browser cannot call Fleet API',
    'directly. Proxy through your own backend. The SDK runs fine in a browser; the',
    'network policy is the obstacle.',
    '',
    '## Observability',
    '',
    fence(`const client = new TeslaClient({
  accessToken,
  onRequest: ({ method, url, status, attempt, durationMs }) => {
    logger.info({ method, url, status, attempt, durationMs })
  },
})`),
  ].join('\n')
}

/** Every generated page, in navigation order. */
const PAGES = [
  { slug: 'index', route: '/', title: 'Overview', body: overviewMd },
  { slug: 'quickstart', route: '/quickstart', title: 'Quickstart', body: quickstartMd },
  { slug: 'auth', route: '/auth', title: 'Authentication', body: authMd },
  { slug: 'guides', route: '/guides', title: 'Guides', body: guidesMd },
  { slug: 'errors', route: '/errors', title: 'Errors', body: errorsMd },
  ...API.namespaces.map((ns) => ({
    slug: `api-${ns.key}`,
    route: `/api/${ns.key}`,
    title: `client.${ns.key}`,
    body: () => namespaceMd(ns),
  })),
  { slug: 'types', route: '/types', title: 'Types', body: typesMd },
]

mkdirSync(resolve(docs, 'md'), { recursive: true })

const rendered = PAGES.map((p) => ({ ...p, text: p.body() }))
for (const p of rendered) writeFileSync(resolve(docs, `md/${p.slug}.md`), `${p.text}\n`)

const llms = [
  `# ${PKG}`,
  '',
  `> ${API.package.description} ${API.stats.methods} typed methods across`,
  `> ${API.stats.namespaces} namespaces, zero runtime dependencies, MIT licensed.`,
  '',
  'Every page below is available as Markdown. Fetch these instead of the rendered',
  'HTML: they carry the same content without the markup.',
  '',
  '## Docs',
  '',
  ...rendered
    .filter((p) => !p.slug.startsWith('api-'))
    .map((p) => `- [${p.title}](${SITE}/md/${p.slug}.md): ${firstLine(p.text)}`),
  '',
  '## API reference',
  '',
  ...rendered
    .filter((p) => p.slug.startsWith('api-'))
    .map((p) => `- [${p.title}](${SITE}/md/${p.slug}.md): ${firstLine(p.text)}`),
  '',
  '## Optional',
  '',
  `- [Full documentation](${SITE}/llms-full.txt): Every page concatenated into one document`,
  `- [Repository](${API.package.repository}): Source, examples, and issue tracker`,
  `- [Tesla Fleet API](https://developer.tesla.com/docs/fleet-api): The upstream API this wraps`,
  '',
].join('\n')

writeFileSync(resolve(docs, 'llms.txt'), llms)

const full = [
  `# ${PKG} — complete documentation`,
  '',
  `> Version ${API.package.version}. Generated from the shipped type declarations.`,
  '',
  '---',
  '',
  ...rendered.flatMap((p) => [p.text, '', '---', '']),
].join('\n')

writeFileSync(resolve(docs, 'llms-full.txt'), full)

/** Pulls the blockquote summary out of a page for the index annotation. */
function firstLine(text) {
  const quote = /^> (.+)$/m.exec(text)
  return (quote?.[1] ?? '').replace(/\s+/g, ' ').trim()
}

console.log(`markdown pages : ${rendered.length}`)
console.log(`llms.txt       : ${(llms.length / 1024).toFixed(1)} kB`)
console.log(`llms-full.txt  : ${(full.length / 1024).toFixed(1)} kB`)
