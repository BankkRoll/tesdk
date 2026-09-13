/**
 * @file The persistent chrome: brand, theme, drawer, and outbound links.
 *
 * Wired once at boot and unaffected by navigation, unlike the article body
 * which the router replaces on every route change.
 */

import { $ } from '../lib/dom.js'
import { getApi } from '../lib/data.js'
import { ICON } from '../icons.js'

/** Paints every static icon in the chrome once, at startup. */
export function paintChrome() {
  const set = (sel, html) => {
    const el = $(sel)
    if (el) el.innerHTML = html
  }

  set('.brand-mark', ICON.logo)
  set('.menu-btn', ICON.menu)
  set('.gh-link', ICON.github)
  set('.npm-link', ICON.npm)
  set('.foot-gh', ICON.github)
  set('.foot-npm', ICON.npm)
  set('.foot-issues', ICON.issue)

  for (const el of document.querySelectorAll('.foot-brand .brand-mark')) el.innerHTML = ICON.logo
  for (const el of document.querySelectorAll('.ext')) el.innerHTML = ICON.external

  $('.search-open').insertAdjacentHTML('afterbegin', ICON.search)
  $('.search-field').insertAdjacentHTML('afterbegin', ICON.search)
}

/** Points every chrome link at the repository read from api.json. */
export function wireLinks() {
  const { repository, name } = getApi().package
  const npm = `https://www.npmjs.com/package/${name}`

  const href = (sel, url) => {
    const el = $(sel)
    if (el) el.href = url
  }

  href('.gh-link', repository)
  href('.npm-link', npm)
  href('.foot-gh', repository)
  href('.foot-npm', npm)
  href('.foot-npm-link', npm)
  href('.foot-repo', repository)
  href('.foot-issues', `${repository}/issues`)
  href('.foot-changelog', `${repository}/blob/main/CHANGELOG.md`)

  $('.brand-ver').textContent = `v${getApi().package.version}`
}

/** Toggles the mobile navigation drawer and keeps ARIA state in sync. */
export function wireDrawer() {
  const btn = $('.menu-btn')
  const sidebar = $('.sidebar')
  const scrim = $('.scrim')

  const setOpen = (open) => {
    sidebar.classList.toggle('open', open)
    scrim.classList.toggle('open', open)
    btn.setAttribute('aria-expanded', String(open))
    btn.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation')
    btn.innerHTML = open ? ICON.close : ICON.menu
  }

  btn.addEventListener('click', () => setOpen(!sidebar.classList.contains('open')))
  scrim.addEventListener('click', () => setOpen(false))

  // Escape closes the drawer only when the search overlay is not on top of it.
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('.overlay').classList.contains('open')) setOpen(false)
  })

  return setOpen
}

/** Applies the saved or system theme and wires the toggle. */
export function wireTheme() {
  const btn = $('.theme-btn')

  const paint = () => {
    const dark = document.documentElement.classList.contains('dark')
    btn.innerHTML = dark ? ICON.sun : ICON.moon
    btn.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme')
  }

  btn.addEventListener('click', () => {
    const dark = document.documentElement.classList.toggle('dark')
    try {
      localStorage.setItem('theme', dark ? 'dark' : 'light')
    } catch {
      // Private browsing can reject writes; the theme still applies for this
      // session, it simply is not remembered.
    }
    paint()
  })

  paint()
}
