/**
 * @file TypeScript syntax highlighting.
 *
 * A span-claiming tokenizer rather than a chain of replacements: each pattern
 * reserves a character range and later patterns skip ranges already taken,
 * which is what stops a keyword inside a string being highlighted as a keyword.
 */

import { esc } from './dom.js'

const KEYWORDS =
  /\b(const|let|var|function|return|await|async|import|export|from|type|interface|class|extends|implements|new|if|else|for|of|in|try|catch|finally|throw|typeof|instanceof|as|declare|readonly|public|private|void|null|undefined|true|false|this)\b/g

/**
 * Tokenizes TypeScript source into highlighted HTML.
 *
 * @param code - Source to highlight.
 * @returns HTML with each token wrapped in a `tok-*` span.
 */
export function highlight(code) {
  /** @type {{start: number, end: number, cls: string}[]} */
  const spans = []

  /** Reserves every match of `re`, skipping ranges another pattern took. */
  const claim = (re, cls) => {
    for (const m of code.matchAll(re)) {
      const start = m.index
      const end = start + m[0].length
      if (spans.some((s) => start < s.end && end > s.start)) continue
      spans.push({ start, end, cls })
    }
  }

  // Order matters: comments and strings claim their range before keywords, so
  // a keyword inside a string is not highlighted as code.
  claim(/\/\/[^\n]*/g, 'tok-com')
  claim(/'[^'\n]*'|"[^"\n]*"|`[^`]*`/g, 'tok-str')
  claim(KEYWORDS, 'tok-key')
  claim(/\b\d[\d_.]*\b/g, 'tok-num')
  claim(/\b[A-Z][A-Za-z0-9]*\b/g, 'tok-type')
  claim(/\b[a-z][A-Za-z0-9]*(?=\()/g, 'tok-fn')

  spans.sort((a, b) => a.start - b.start)

  let out = ''
  let at = 0
  for (const s of spans) {
    if (s.start < at) continue
    out += esc(code.slice(at, s.start))
    out += `<span class="${s.cls}">${esc(code.slice(s.start, s.end))}</span>`
    at = s.end
  }

  return out + esc(code.slice(at))
}
