/**
 * @file Page actions: copy the page as Markdown, or hand it to an AI tool.
 *
 * Each destination receives the page's Markdown URL rather than its body, so
 * the assistant fetches canonical source instead of a stale paste.
 */

import { $ } from '../lib/dom.js'
import { getApi } from '../lib/data.js'
import { ICON } from '../icons.js'

/**
 * Destinations offered by the page-action menu.
 *
 * Each builds a prompt around the page's Markdown URL rather than pasting the
 * body, so the assistant fetches canonical source instead of a stale copy.
 */
const AI_TARGETS = [
  {
    id: 'claude',
    label: 'Open in Claude',
    url: (p) => `https://claude.ai/new?q=${p}`,
  },
  {
    id: 'chatgpt',
    label: 'Open in ChatGPT',
    url: (p) => `https://chatgpt.com/?q=${p}`,
  },
]

/** Markdown URL for the current route. */
export function markdownUrl(hash = location.hash) {
  const route = hash.replace(/^#/, '') || '/'
  const slug = route === '/' ? 'index' : route.slice(1).replace(/\//g, '-')
  return new URL(`md/${slug}.md`, location.href.split('#')[0]).toString()
}

/** Fetches the current page as Markdown. */
async function fetchMarkdown() {
  const res = await fetch(markdownUrl())
  if (!res.ok) throw new Error(`${res.status}`)
  return await res.text()
}

/** Renders the actions control that sits above each page title. */
export function pageActions() {
  return `
    <button class="pg-btn pg-copy" type="button">
      ${ICON.markdown}<span>Copy page</span>
    </button>
    <div class="pg-menu-wrap">
      <button class="pg-btn pg-more" type="button" aria-haspopup="menu" aria-expanded="false" aria-label="More page actions">
        ${ICON.chevron}
      </button>
      <div class="pg-menu" role="menu" hidden>
        <button class="pg-item" role="menuitem" data-act="copy">${ICON.copy}Copy as Markdown</button>
        <a class="pg-item" role="menuitem" data-act="view" href="#" target="_blank" rel="noopener">${ICON.markdown}View as Markdown${ICON.external}</a>
        <div class="pg-sep"></div>
        ${AI_TARGETS.map(
          (t) =>
            `<a class="pg-item" role="menuitem" data-ai="${t.id}" href="#" target="_blank" rel="noopener">${ICON.sparkle}${t.label}${ICON.external}</a>`,
        ).join('')}
        <div class="pg-sep"></div>
        <a class="pg-item" role="menuitem" href="llms.txt" target="_blank" rel="noopener">${ICON.markdown}llms.txt${ICON.external}</a>
        <a class="pg-item" role="menuitem" href="llms-full.txt" target="_blank" rel="noopener">${ICON.markdown}llms-full.txt${ICON.external}</a>
      </div>
    </div>`
}

/** Wires the copy button, the dropdown, and the AI destinations. */
export function wirePageActions() {
  const root = $('.pg-actions')
  if (!root) return

  const copyBtn = $('.pg-copy', root)
  const moreBtn = $('.pg-more', root)
  const menu = $('.pg-menu', root)
  const mdUrl = markdownUrl()

  const prompt = encodeURIComponent(
    `Read ${mdUrl} — documentation for the ${getApi().package.name} TypeScript SDK — and help me use it.`,
  )

  for (const a of menu.querySelectorAll('[data-ai]')) {
    a.href = AI_TARGETS.find((t) => t.id === a.dataset.ai).url(prompt)
  }
  menu.querySelector('[data-act="view"]').href = mdUrl

  /** Copies the page Markdown, reporting the outcome on the button. */
  const copy = async (btn, label) => {
    const original = btn.innerHTML
    try {
      await navigator.clipboard.writeText(await fetchMarkdown())
      btn.innerHTML = `${ICON.check}<span>Copied</span>`
      btn.classList.add('done')
    } catch {
      btn.innerHTML = `<span>${label} failed</span>`
    }
    setTimeout(() => {
      btn.innerHTML = original
      btn.classList.remove('done')
    }, 1600)
  }

  copyBtn.addEventListener('click', () => copy(copyBtn, 'Copy'))
  menu.querySelector('[data-act="copy"]').addEventListener('click', (e) => {
    e.preventDefault()
    closeMenu()
    copy(copyBtn, 'Copy')
  })

  const openMenu = () => {
    menu.hidden = false
    moreBtn.setAttribute('aria-expanded', 'true')
  }
  const closeMenu = () => {
    menu.hidden = true
    moreBtn.setAttribute('aria-expanded', 'false')
  }

  moreBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    menu.hidden ? openMenu() : closeMenu()
  })

  document.addEventListener('click', (e) => {
    if (!root.contains(e.target)) closeMenu()
  })
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMenu()
  })
}
