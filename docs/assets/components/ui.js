/**
 * @file Reusable UI fragments.
 *
 * Pages compose from these rather than hand-writing markup, so a change to how
 * a code block looks lands everywhere at once.
 */

import { esc } from '../lib/dom.js'
import { highlight } from '../lib/highlight.js'
import { ICON } from '../icons.js'

/** Renders a copyable code block. */
export function codeBlock(code, label = '') {
  return `<div class="code">
    ${label ? `<div class="code-head">${esc(label)}</div>` : ''}
    <button class="code-copy" aria-label="Copy code">${ICON.copy}</button>
    <pre><code>${highlight(code)}</code></pre>
  </div>`
}

/* ── Pages ─────────────────────────────────────────────────────────────── */
