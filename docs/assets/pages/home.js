/**
 * @file Landing page: hero, install, and the namespace index.
 */

import { getApi } from '../lib/data.js'
import { esc } from '../lib/dom.js'

import { codeBlock } from '../components/ui.js'
import { ICON } from '../icons.js'

export function pageHome() {
  const p = getApi().package
  const s = getApi().stats

  return `
  <div class="hero">
    <h1>${esc(p.name.split('/').pop())}</h1>
    <p class="lede">${esc(p.description)}</p>
    <div class="hero-actions">
      <a class="btn btn-primary" href="#/quickstart">Get started</a>
      <a class="btn btn-ghost" href="#/api">API reference</a>
      <a class="btn btn-ghost" href="${p.repository}" target="_blank" rel="noopener"><span class="btn-icon">${ICON.github}</span>GitHub</a>
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
    ${getApi().namespaces
      .map(
        (ns) => `<a class="card" href="#/api/${ns.key}">
          <div class="card-t"><code>client.${ns.key}</code><span class="nav-count">${ns.members.filter((m) => m.kind === 'method').length}</span></div>
          <div class="card-d">${esc(ns.blurb)}</div>
        </a>`,
      )
      .join('')}
  </div>`
}
