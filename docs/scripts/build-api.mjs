/**
 * @file Generates the docs site's API data from the emitted declarations.
 *
 * Reads `dist/index.d.ts` rather than source, so the reference describes
 * exactly what consumers can import. Run after `npm run build`.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../..')

const dts = readFileSync(resolve(root, 'dist/index.d.ts'), 'utf8')
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
const lines = dts.split('\n')

/**
 * Reads the JSDoc block directly above a line.
 *
 * @param {number} index - Line the declaration starts on.
 * @returns {{summary: string, tags: Record<string, string[]>}}
 */
function docAbove(index) {
  let end = index - 1
  if ((lines[end] ?? '').trim() !== '*/') return { summary: '', tags: {} }

  let start = end
  while (start >= 0 && !(lines[start] ?? '').trim().startsWith('/**')) start--

  const body = lines
    .slice(start + 1, end)
    .map((l) => l.replace(/^\s*\*\s?/, ''))
    .join('\n')

  /** @type {Record<string, string[]>} */
  const tags = {}
  const summary = []
  let currentTag = null

  for (const line of body.split('\n')) {
    const tag = /^@(\w+)\s*(.*)$/.exec(line.trim())
    if (tag) {
      currentTag = tag[1]
      tags[currentTag] ??= []
      tags[currentTag].push(tag[2])
    } else if (currentTag) {
      const last = tags[currentTag].length - 1
      tags[currentTag][last] += `\n${line}`
    } else {
      summary.push(line)
    }
  }

  return { summary: summary.join('\n').trim(), tags }
}

/** Strips TSDoc link syntax and normalizes whitespace for display. */
function clean(text) {
  return text
    .replace(/\{@link\s+([^}|]+)(?:\|[^}]+)?\}/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Parses `@example` blocks into title plus fenced code. */
function parseExamples(raw = []) {
  return raw.map((block) => {
    const fence = /```ts\n([\s\S]*?)```/.exec(block)
    const title = block.split('\n')[0].trim()
    return {
      title: title.startsWith('```') ? '' : title,
      code: (fence?.[1] ?? '').trim(),
    }
  })
}

const classes = {}
let currentClass = null
let depth = 0

lines.forEach((line, i) => {
  const declared = /^declare class (\w+)(?:\s+extends\s+(\w+))?/.exec(line)
  if (declared) {
    currentClass = declared[1]
    const { summary, tags } = docAbove(i)
    classes[currentClass] = {
      name: currentClass,
      extends: declared[2] ?? null,
      doc: clean(summary),
      examples: parseExamples(tags.example),
      see: (tags.see ?? []).map(clean),
      members: [],
    }
    depth = 1
    return
  }

  if (!currentClass) return

  depth += (line.match(/\{/g) ?? []).length - (line.match(/\}/g) ?? []).length
  if (depth <= 0) {
    currentClass = null
    return
  }

  const member = /^\s{2}(?:readonly\s+)?(?:get\s+)?(\w+)(\??)\s*[(<:]/.exec(line)
  if (!member || line.includes('private ') || member[1] === 'constructor') return

  const { summary, tags } = docAbove(i)
  classes[currentClass].members.push({
    name: member[1],
    signature: line.trim().replace(/;$/, ''),
    kind: line.includes('(') && !line.includes(': (') ? 'method' : 'property',
    doc: clean(summary),
    params: (tags.param ?? []).map(clean),
    returns: clean((tags.returns ?? [])[0] ?? ''),
    throws: (tags.throws ?? []).map(clean),
    examples: parseExamples(tags.example),
    see: (tags.see ?? []).map(clean),
    deprecated: clean((tags.deprecated ?? [])[0] ?? '') || null,
  })
})

/** Collects `interface` and `type` declarations with their fields. */
function collectShapes() {
  const out = []
  lines.forEach((line, i) => {
    const iface = /^(?:declare )?interface (\w+)(?:<[^>]*>)?(?:\s+extends\s+([\w,\s<>]+))?/.exec(line)
    const alias = /^(?:declare )?type (\w+)(?:<[^>]*>)?\s*=\s*(.+?);?$/.exec(line)

    if (iface) {
      const { summary } = docAbove(i)
      const fields = []
      let d = 1
      for (let j = i + 1; j < lines.length && d > 0; j++) {
        d += (lines[j].match(/\{/g) ?? []).length - (lines[j].match(/\}/g) ?? []).length
        const f = /^\s{2}(?:readonly\s+)?(\w+)(\??):\s*(.+?);?$/.exec(lines[j])
        if (f) {
          fields.push({
            name: f[1],
            optional: f[2] === '?',
            type: f[3].replace(/;$/, ''),
            doc: clean(docAbove(j).summary),
          })
        }
      }
      out.push({ kind: 'interface', name: iface[1], extends: iface[2]?.trim() ?? null, doc: clean(summary), fields })
    } else if (alias) {
      const { summary } = docAbove(i)
      out.push({ kind: 'type', name: alias[1], definition: alias[2].replace(/;$/, ''), doc: clean(summary), fields: [] })
    }
  })
  return out
}

/** Namespaces exposed on the client, in the order the docs present them. */
const NAMESPACES = [
  ['vehicles', 'VehiclesResource', 'Listing, live data, wake handling, drivers, and share invites.'],
  ['commands', 'CommandsResource', 'Every actuating command, from locks to navigation.'],
  ['energy', 'EnergyResource', 'Powerwall, Solar, and Wall Connector sites.'],
  ['charging', 'ChargingResource', 'Charging history, sessions, and PDF invoices.'],
  ['telemetry', 'TelemetryResource', 'Fleet Telemetry streaming configuration.'],
  ['partner', 'PartnerResource', 'Partner registration and telemetry diagnostics.'],
  ['fleet', 'FleetResource', 'Specs, options, pricing, warranty, and eligibility.'],
  ['user', 'UserResource', 'Account profile, region discovery, and orders.'],
  ['ocpi', 'OcpiResource', 'Tesla Charging API locations and tariffs (OCPI 2.2.1).'],
  ['oauth', 'OAuthClient', 'Token flows and credential lifecycle.'],
]

const ERRORS = [
  'TeslaError',
  'InvalidRequestError',
  'AuthenticationError',
  'PermissionError',
  'SigningRequiredError',
  'NotFoundError',
  'VehicleAsleepError',
  'RateLimitError',
  'ServerError',
  'ConnectionError',
  'TimeoutError',
]

const shapes = collectShapes()

const data = {
  package: {
    name: pkg.name,
    version: pkg.version,
    description: pkg.description,
    repository: pkg.repository.url.replace(/^git\+/, '').replace(/\.git$/, ''),
    license: pkg.license,
  },
  client: classes.TeslaClient ?? null,
  namespaces: NAMESPACES.filter(([, cls]) => classes[cls]).map(([key, cls, blurb]) => ({
    key,
    className: cls,
    blurb,
    ...classes[cls],
    members: classes[cls].members.filter((m) => m.name !== 'send' || key !== 'commands').length
      ? classes[cls].members
      : classes[cls].members,
  })),
  errors: ERRORS.filter((n) => classes[n]).map((n) => classes[n]),
  shapes: shapes.filter((s) => !ERRORS.includes(s.name)),
  stats: {
    methods: Object.values(classes).reduce((n, c) => n + c.members.filter((m) => m.kind === 'method').length, 0),
    namespaces: NAMESPACES.length,
    interfaces: shapes.filter((s) => s.kind === 'interface').length,
    errors: ERRORS.length,
  },
}

mkdirSync(resolve(here, '../assets'), { recursive: true })
writeFileSync(resolve(here, '../assets/api.json'), JSON.stringify(data))

console.log(`api.json written`)
console.log(`  namespaces : ${data.namespaces.length}`)
console.log(`  methods    : ${data.stats.methods}`)
console.log(`  errors     : ${data.errors.length}`)
console.log(`  shapes     : ${data.shapes.length}`)
