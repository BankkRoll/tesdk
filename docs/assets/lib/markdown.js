/**
 * @file A deliberately small Markdown renderer.
 *
 * Only the subset TSDoc comments actually contain is supported — inline code,
 * bold, bare URLs, and paragraphs — rather than shipping a full parser for
 * syntax the source never produces.
 */

import { esc } from './dom.js'

/**
 * Renders the supported Markdown subset to HTML.
 *
 * Input is escaped before any markup is inserted, so comment text cannot
 * inject elements into the page.
 *
 * @param text - Raw comment text.
 * @returns HTML, as one or more paragraphs.
 */
export function md(text = '') {
  if (!text) return ''

  return text
    .split(/\n\n+/)
    .map((para) => {
      const html = esc(para)
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(
          /\bhttps?:\/\/[^\s<)]+/g,
          (u) => `<a href="${u}" target="_blank" rel="noopener">${u}</a>`,
        )
        .replace(/\n/g, ' ')
      return `<p>${html}</p>`
    })
    .join('')
}
