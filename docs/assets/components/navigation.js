/**
 * @file Sidebar navigation and the on-this-page table of contents.
 */

import { $ } from '../lib/dom.js'
import { getApi } from '../lib/data.js'

export function renderSidebar(active) {
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
      ${getApi().namespaces
        .map((ns) => link(`/api/${ns.key}`, `<code>${ns.key}</code>`, ns.members.filter((m) => m.kind === 'method').length))
        .join('')}
      ${link('/types', 'Types', getApi().shapes.length)}
    </div>
    <div class="nav-group">
      <div class="nav-title">Resources</div>
      ${link('/examples', 'Examples')}
      <a class="nav-link" href="${getApi().package.repository}" target="_blank" rel="noopener">GitHub</a>
      <a class="nav-link" href="https://www.npmjs.com/package/${getApi().package.name}" target="_blank" rel="noopener">npm</a>
      <a class="nav-link" href="https://developer.tesla.com/docs/fleet-api" target="_blank" rel="noopener">Fleet API docs</a>
    </div>`
}

/** Builds the right-hand table of contents from rendered headings. */
export function renderToc() {
  const heads = [...$('.main').querySelectorAll('h2[id], h3[id]')]
  if (heads.length < 2) return ''
  return `<div class="toc-title">On this page</div>${heads
    .map((h) => `<a class="lvl-${h.tagName[1]}" href="#${h.id}">${h.textContent.replace(/\s*\d+$/, '')}</a>`)
    .join('')}`
}
