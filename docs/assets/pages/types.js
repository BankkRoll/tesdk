/**
 * @file Exported interfaces and type aliases.
 */

import { getApi } from '../lib/data.js'
import { esc } from '../lib/dom.js'
import { md } from '../lib/markdown.js'
import { codeBlock } from '../components/ui.js'

export function pageTypes() {
  const interfaces = getApi().shapes.filter((s) => s.kind === 'interface')
  const aliases = getApi().shapes.filter((s) => s.kind === 'type')

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
