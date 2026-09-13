/**
 * @file API reference: the index, one page per namespace, and the shared
 * renderer for a single method or property.
 */

import { getApi } from '../lib/data.js'
import { esc } from '../lib/dom.js'
import { md } from '../lib/markdown.js'
import { codeBlock } from '../components/ui.js'

/** Renders one class member as an API entry. */
export function member(m, nsKey) {
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

export function pageApiIndex() {
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
    ${getApi().namespaces
      .map(
        (ns) => `<a class="card" href="#/api/${ns.key}">
          <div class="card-t"><code>client.${ns.key}</code><span class="nav-count">${ns.members.filter((m) => m.kind === 'method').length}</span></div>
          <div class="card-d">${esc(ns.blurb)}</div>
        </a>`,
      )
      .join('')}
  </div>

  <h2 id="types">Types</h2>
  <p>${getApi().shapes.length} exported interfaces and type aliases. <a href="#/types">Browse them →</a></p>`
}

export function pageNamespace(key) {
  const ns = getApi().namespaces.find((n) => n.key === key)
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
