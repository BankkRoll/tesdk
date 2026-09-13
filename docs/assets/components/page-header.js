/**
 * @file The masthead every documentation page opens with.
 *
 * Carries the breadcrumb, eyebrow, title, lede, and the page actions, so a
 * reader landing on a deep link knows which section they are in and can hand
 * the page to a tool without hunting for the control. Pages pass content; the
 * layout lives here so every page matches.
 */

import { esc } from '../lib/dom.js'
import { ICON } from '../icons.js'

/**
 * Renders a page masthead.
 *
 * The actions container is left empty here and filled by the router once the
 * route is known, because the Markdown URL those controls point at is derived
 * from the current hash rather than from anything the page can pass in.
 *
 * @param options.title - Page title. Pass `code: true` to set it in monospace.
 * @param options.lede - One-sentence summary shown under the title. Trusted
 * HTML, so pages can mark up inline code.
 * @param options.section - Section the page belongs to, shown as an eyebrow.
 * @param options.crumbs - Breadcrumb trail as `{ label, href }`, excluding the
 * current page, which is appended from `title`.
 * @param options.meta - Chips shown under the lede, as `{ label, icon, tone }`.
 * @param options.code - Renders the title in monospace, for API pages.
 * @returns HTML string.
 */
export function pageHeader({ title, lede = '', section = '', crumbs = [], meta = [], code = false }) {
  const trail = [{ label: 'Docs', href: '#/' }, ...crumbs]

  const breadcrumb = `<nav class="crumbs" aria-label="Breadcrumb">${trail
    .map(
      (c) =>
        `<a href="${c.href}">${esc(c.label)}</a><span class="crumb-sep" aria-hidden="true">${ICON.chevron}</span>`,
    )
    .join('')}<span class="crumb-now" aria-current="page">${esc(title)}</span></nav>`

  const chips = meta.length
    ? `<div class="pg-meta">${meta
        .map(
          (m) =>
            `<span class="chip${m.tone ? ` chip-${m.tone}` : ''}">${
              m.icon ? `<span class="chip-icon">${m.icon}</span>` : ''
            }${esc(m.label)}</span>`,
        )
        .join('')}</div>`
    : ''

  return `<header class="pg-head">
    <div class="pg-head-top">
      ${breadcrumb}
      <div class="pg-actions"></div>
    </div>
    ${section ? `<div class="pg-eyebrow">${esc(section)}</div>` : ''}
    <h1${code ? ' class="pg-title-code"' : ''}>${esc(title)}</h1>
    ${lede ? `<p class="lede">${lede}</p>` : ''}
    ${chips}
  </header>`
}
