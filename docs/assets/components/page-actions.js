/**
 * @file Page actions: copy the page as Markdown, or hand it to an AI tool.
 *
 * Each destination receives the page's Markdown URL rather than its body, so
 * the assistant fetches canonical source instead of a stale paste.
 */

import { $ } from '../lib/dom.js'
import { getApi } from '../lib/data.js'
import { BRAND, BRAND_COLOR, ICON } from '../icons.js'

/**
 * Destinations offered by the page-action menu.
 *
 * Each builds a prompt around the page's Markdown URL rather than pasting the
 * body, so the assistant fetches canonical source instead of a stale copy.
 */
const AI_TARGETS = [
  { id: 'claude', brand: 'claude', label: 'Open in Claude', url: (p) => `https://claude.ai/new?q=${p}` },
  { id: 'chatgpt', brand: 'openai', label: 'Open in ChatGPT', url: (p) => `https://chatgpt.com/?q=${p}` },
  { id: 'gemini', brand: 'gemini', label: 'Open in Gemini', url: (p) => `https://gemini.google.com/app?q=${p}` },
  { id: 'perplexity', brand: 'perplexity', label: 'Open in Perplexity', url: (p) => `https://www.perplexity.ai/search?q=${p}` },
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

/**
 * Renders one menu row.
 *
 * Every row shares the same three-slot grid — icon, label, external hint — so
 * labels stay on one optical column whether or not a row has a trailing hint.
 *
 * @param options.tag - `a` by default; `button` for rows that act in place.
 * @param options.attrs - Attributes spliced onto the element.
 * @param options.icon - Icon markup for the leading slot.
 * @param options.brand - Brand key, which tints the icon its official colour.
 * @param options.label - Row text.
 * @param options.ext - Shows the trailing external-link hint.
 * @returns HTML string.
 */
function item({ tag = 'a', attrs = '', icon = '', brand = '', label, ext = false }) {
  const rel = tag === 'a' ? ' target="_blank" rel="noopener"' : ' type="button"'
  const tint = brand ? ` style="color:${BRAND_COLOR[brand]}"` : ''
  return `<${tag} class="pg-item" role="menuitem" ${attrs}${rel}>
    <span class="pg-item-icon${brand ? ' brand-ink' : ''}"${tint}>${icon}</span>
    <span class="pg-item-label">${label}</span>
    ${ext ? `<span class="ext">${ICON.external}</span>` : ''}
  </${tag}>`
}

/** Renders the actions control that sits in the page masthead. */
export function pageActions() {
  return `
    <button class="pg-btn pg-copy" type="button">
      <span class="pg-btn-icon">${ICON.copy}</span><span class="pg-btn-label">Copy page</span>
    </button>
    <div class="pg-menu-wrap">
      <button class="pg-btn pg-more" type="button" aria-haspopup="menu" aria-expanded="false" aria-label="More page actions">
        ${ICON.chevron}
      </button>
      <div class="pg-menu" role="menu" hidden>
        <div class="pg-group">This page</div>
        ${item({ tag: 'button', attrs: 'data-act="copy"', icon: ICON.copy, label: 'Copy as Markdown' })}
        ${item({ attrs: 'data-act="view" href="#"', icon: ICON.markdown, label: 'View as Markdown', ext: true })}
        <div class="pg-sep"></div>
        <div class="pg-group">Open in</div>
        ${AI_TARGETS.map((t) =>
          item({
            attrs: `data-ai="${t.id}" href="#"`,
            icon: BRAND[t.brand],
            brand: t.brand,
            label: t.label,
            ext: true,
          }),
        ).join('')}
        <div class="pg-sep"></div>
        <div class="pg-group">Whole site</div>
        ${item({ attrs: 'href="llms.txt"', icon: ICON.markdown, label: 'llms.txt', ext: true })}
        ${item({ attrs: 'href="llms-full.txt"', icon: ICON.markdown, label: 'llms-full.txt', ext: true })}
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

  const icon = $('.pg-btn-icon', copyBtn)
  const label = $('.pg-btn-label', copyBtn)

  /**
   * Copies the page Markdown, reporting the outcome on the button.
   *
   * Only the icon and label are swapped, never the button's own markup, so the
   * control keeps its width and the row does not reflow mid-feedback.
   */
  let revert
  const copy = async () => {
    let ok = true
    try {
      await navigator.clipboard.writeText(await fetchMarkdown())
    } catch {
      ok = false
    }

    icon.innerHTML = ok ? ICON.check : ICON.copy
    label.textContent = ok ? 'Copied' : 'Copy failed'
    copyBtn.classList.toggle('done', ok)

    clearTimeout(revert)
    revert = setTimeout(() => {
      icon.innerHTML = ICON.copy
      label.textContent = 'Copy page'
      copyBtn.classList.remove('done')
    }, 1600)
  }

  copyBtn.addEventListener('click', copy)
  menu.querySelector('[data-act="copy"]').addEventListener('click', (e) => {
    e.preventDefault()
    closeMenu()
    copy()
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
