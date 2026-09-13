/**
 * @file Command-palette search across every method, type, and page.
 */

import { $, esc } from '../lib/dom.js'
import { getApi } from '../lib/data.js'
import { ROUTES } from '../router.js'

export function buildIndex() {
  const items = []
  for (const ns of getApi().namespaces) {
    items.push({ name: `client.${ns.key}`, ns: 'namespace', doc: ns.blurb, href: `#/api/${ns.key}` })
    for (const m of ns.members) {
      items.push({ name: m.name, ns: `client.${ns.key}`, doc: m.doc.split('\n')[0], href: `#/api/${ns.key}` })
    }
  }
  for (const e of getApi().errors) items.push({ name: e.name, ns: 'error', doc: e.doc.split('\n')[0], href: '#/errors' })
  for (const t of getApi().shapes) items.push({ name: t.name, ns: t.kind, doc: t.doc.split('\n')[0], href: `#/types` })
  for (const r of ROUTES) items.push({ name: r.title, ns: 'page', doc: '', href: `#${r.path}` })
  return items
}

export function wireSearch() {
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
