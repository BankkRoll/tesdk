/**
 * @file Generates the docs site icon module.
 *
 * Brand marks come from `simple-icons`, which tracks each company's official
 * artwork and colour. Hand-drawing a third party's logo produces something
 * subtly wrong, so the only marks authored here are the generic UI glyphs that
 * belong to no brand.
 *
 * The output is committed so the site has no build-time dependency and Pages
 * serves plain static files.
 */

import { createRequire } from 'node:module'
import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const here = dirname(fileURLToPath(import.meta.url))
const si = require('simple-icons')

/** Brand marks to embed, keyed by the name the site uses. */
const BRANDS = {
  github: 'siGithub',
  npm: 'siNpm',
  node: 'siNodedotjs',
  typescript: 'siTypescript',
  react: 'siReact',
  nextjs: 'siNextdotjs',
  vite: 'siVite',
  cloudflare: 'siCloudflareworkers',
  deno: 'siDeno',
  bun: 'siBun',
  vercel: 'siVercel',
  tesla: 'siTesla',
  claude: 'siClaude',
  gemini: 'siGooglegemini',
  perplexity: 'siPerplexity',
  cursor: 'siCursor',
  chrome: 'siGooglechrome',
  markdown: 'siMarkdown',
}

/**
 * Brand marks simple-icons does not carry.
 *
 * simple-icons removed the OpenAI mark at the company's request, so ChatGPT
 * would otherwise fall back to a generic glyph in the AI destination menu.
 * These still flow through the generator below, so every mark reaches the site
 * the same way.
 */
const EXTRA_BRANDS = {
  openai: {
    hex: '412991',
    path: 'M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z',
  },
}

/**
 * Generic interface glyphs.
 *
 * Stroked on a 24-unit grid at 2px so they align optically at the 17px render
 * size. Brand marks are filled and keep their own geometry.
 */
const UI = {
  logo: '<path d="M3 6h18M12 6v13"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
  check: '<path d="m5 13 4 4L19 7"/>',
  sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  issue: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5M12 16.2v.1"/>',
  external: '<path d="M13 5h6v6M19 5l-8 8M18 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/>',
  book: '<path d="M4 4.5A2 2 0 0 1 6 3h13v15H6a2 2 0 0 0-2 2V4.5Z"/><path d="M4 19.5A2 2 0 0 1 6 18h13v3H6a2 2 0 0 1-2-2Z"/>',
  bolt: '<path d="M13 2 4.5 13.5H11l-1 8.5 8.5-11.5H12l1-8.5Z"/>',
  shield: '<path d="M12 2.5 20 6v6c0 4.5-3.2 8.4-8 9.5-4.8-1.1-8-5-8-9.5V6l8-3.5Z"/>',
  terminal: '<rect x="2.5" y="3.5" width="19" height="17" rx="2.5"/><path d="M6.5 9 9.5 12l-3 3M13 16h4.5"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13 9 5 9-5M3 17l9 5 9-5"/>',
  key: '<circle cx="8" cy="15" r="4.5"/><path d="m11.5 11.5 8-8M17 6l2.5 2.5M14.5 8.5 17 11"/>',
  car: '<path d="M4.5 16.5h15M6 16.5v2M18 16.5v2"/><path d="M3.5 16.5v-4l2-5h13l2 5v4Z"/><path d="M7 12.5h.1M17 12.5h.1"/>',
  battery: '<rect x="2.5" y="7" width="16" height="10" rx="2.5"/><path d="M21.5 10.5v3"/><path d="M6 10.5v3M9.5 10.5v3"/>',
}

const stroke =
  'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"'

const lines = [
  '/**',
  ' * @file Icon set for the documentation site.',
  ' *',
  ' * GENERATED by scripts/build-icons.mjs. Do not edit by hand.',
  ' *',
  " * Brand marks come from simple-icons, so each is the company's official",
  ' * artwork rather than an approximation, and each carries its official colour',
  ' * for the places that render brands in full colour.',
  ' */',
  '',
  '/** Official brand colour per mark. */',
  'export const BRAND_COLOR = {',
  ...Object.entries(BRANDS).map(([name, key]) => `  ${name}: '#${si[key].hex}',`),
  ...Object.entries(EXTRA_BRANDS).map(([name, b]) => `  ${name}: '#${b.hex}',`),
  '}',
  '',
  '/** Brand marks. Filled, on their own 24-unit viewBox. */',
  'export const BRAND = {',
  ...Object.entries(BRANDS).map(
    ([name, key]) =>
      `  ${name}:\n    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="${si[key].path}"/></svg>',`,
  ),
  ...Object.entries(EXTRA_BRANDS).map(
    ([name, b]) =>
      `  ${name}:\n    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="${b.path}"/></svg>',`,
  ),
  '}',
  '',
  '/** Generic interface glyphs, stroked on a shared 24-unit grid. */',
  'export const UI = {',
  ...Object.entries(UI).map(
    ([name, body]) =>
      `  ${name}: '<svg viewBox="0 0 24 24" ${stroke} aria-hidden="true">${body}</svg>',`,
  ),
  '}',
  '',
  '/** Every icon, brands and glyphs together. */',
  'export const ICON = { ...UI, ...BRAND }',
  '',
]

writeFileSync(resolve(here, '../assets/icons.js'), lines.join('\n'))

console.log('icons.js written')
console.log(`  brand marks : ${Object.keys(BRANDS).length + Object.keys(EXTRA_BRANDS).length}`)
console.log(`  ui glyphs   : ${Object.keys(UI).length}`)
