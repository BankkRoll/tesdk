/**
 * @file Route table and hash-based routing.
 *
 * Hash routing keeps the site a plain static file set, so GitHub Pages serves
 * it without rewrite rules and a deep link survives a hard refresh.
 */

import { $ } from './lib/dom.js'
import { renderSidebar, renderToc } from './components/navigation.js'
import { pageActions, wirePageActions } from './components/page-actions.js'
import { wireCopy } from './components/clipboard.js'
import { wireScrollSpy } from './components/scroll-spy.js'

import { pageHome } from './pages/home.js'
import { pageQuickstart } from './pages/quickstart.js'
import { pageAuth } from './pages/auth.js'
import { pageGuides } from './pages/guides.js'
import { pageErrors } from './pages/errors.js'
import { pageApiIndex, pageNamespace } from './pages/api.js'
import { pageTypes } from './pages/types.js'
import { pageExamples } from './pages/examples.js'

/** Static routes, in sidebar order. */
export const ROUTES = [
  { path: '/', title: 'Overview', render: pageHome },
  { path: '/quickstart', title: 'Quickstart', render: pageQuickstart },
  { path: '/auth', title: 'Authentication', render: pageAuth },
  { path: '/guides', title: 'Guides', render: pageGuides },
  { path: '/errors', title: 'Errors', render: pageErrors },
  { path: '/api', title: 'API reference', render: pageApiIndex },
  { path: '/types', title: 'Types', render: pageTypes },
  { path: '/examples', title: 'Examples', render: pageExamples },
]

/**
 * Resolves a hash to the page that renders it.
 *
 * @param hash - Location hash, with or without the leading `#`.
 * @returns The matched route, falling back to the overview.
 */
export function resolve(hash) {
  const path = hash.replace(/^#/, '') || '/'
  const ns = /^\/api\/(\w+)$/.exec(path)

  if (ns) return { path, title: `client.${ns[1]}`, render: () => pageNamespace(ns[1]) }
  return ROUTES.find((r) => r.path === path) ?? ROUTES[0]
}

/**
 * Renders the current route and rewires everything that depends on it.
 *
 * @param onNavigate - Called after render, so the shell can close the drawer.
 */
export function route(onNavigate = () => {}) {
  const page = resolve(location.hash)

  $('.main').innerHTML = page.render()
  $('.sidebar').innerHTML = renderSidebar(page.path)
  $('.toc').innerHTML = renderToc()
  // Rendered into the page masthead, which the home page does not have.
  const actions = $('.pg-actions')
  if (actions) actions.innerHTML = pageActions()

  document.title = `${page.title} · tesdk`
  window.scrollTo({ top: 0 })

  onNavigate()
  wireCopy()
  wirePageActions()
  wireScrollSpy()
}

/** Starts routing and keeps rendering in step with the hash. */
export function startRouter(onNavigate) {
  window.addEventListener('hashchange', () => route(onNavigate))
  route(onNavigate)
}
