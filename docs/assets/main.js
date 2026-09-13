/**
 * @file Entry point.
 *
 * Loads the generated API data, wires the persistent chrome, then hands control
 * to the router. Each page is a function returning an HTML string; the router
 * swaps that into the article on every hash change.
 *
 * The reference pages come from `api.json`, rebuilt from `dist/index.d.ts` on
 * every docs build, so they cannot drift from the code.
 */

import { $ } from './lib/dom.js'
import { setApi } from './lib/data.js'
import { paintChrome, wireDrawer, wireLinks, wireTheme } from './components/shell.js'
import { wireSearch } from './components/search.js'
import { startRouter } from './router.js'

async function boot() {
  const api = await fetch('assets/api.json').then((r) => r.json())
  setApi(api)

  paintChrome()
  wireLinks()
  wireTheme()

  const setDrawer = wireDrawer()
  wireSearch()

  startRouter(() => setDrawer(false))
}

boot().catch((error) => {
  $('.main').innerHTML =
    '<h1>Could not load the documentation</h1>' +
    '<p class="lede">The generated API data failed to load. Try a refresh.</p>'
  console.error(error)
})
