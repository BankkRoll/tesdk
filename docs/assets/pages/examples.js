/**
 * @file Runnable applications and focused snippets.
 */

import { getApi } from '../lib/data.js'
import { pageHeader } from '../components/page-header.js'
import { BRAND, BRAND_COLOR, ICON } from '../icons.js'

export function pageExamples() {
  const repo = getApi().package.repository
  return `
  ${pageHeader({
    section: 'Resources',
    title: 'Examples',
    lede: 'Four runnable applications and 45 focused snippets, all typechecked in CI against the built SDK.',
    meta: [{ label: '4 apps', icon: ICON.terminal }, { label: '45 snippets', icon: ICON.book }],
  })}

  <h2 id="apps">Applications</h2>
  <div class="grid">
    ${[
      ['node', 'Node CLI', 'Browser OAuth with a loopback server, file-backed tokens, wake handling.', 'node-cli'],
      ['nextjs', 'Next.js 16', 'Server Actions, httpOnly cookie sessions, streaming with Suspense.', 'nextjs-app'],
      ['vite', 'Vite SPA', 'PKCE in the browser, and the dev proxy Tesla&rsquo;s missing CORS headers force.', 'vite-spa'],
      ['cloudflare', 'Cloudflare Worker', 'Cron fleet monitor, KV token store, zero Node built-ins.', 'cloudflare-worker'],
    ]
      .map(
        ([brand, t, d, dir]) =>
          `<a class="card card-brand" href="${repo}/tree/main/examples/${dir}" target="_blank" rel="noopener">
            <span class="card-mark" style="color:${BRAND_COLOR[brand]}">${BRAND[brand]}</span>
            <div class="card-t">${t}<span class="ext">${ICON.external}</span></div>
            <div class="card-d">${d}</div></a>`,
      )
      .join('')}
  </div>

  <h2 id="snippets">Snippets</h2>
  <div class="grid">
    ${[
      ['Auth', 8, 'auth'],
      ['Vehicles', 8, 'vehicles'],
      ['Commands', 9, 'commands'],
      ['Energy', 6, 'energy'],
      ['Telemetry', 4, 'telemetry'],
      ['Errors', 4, 'errors'],
      ['Patterns', 6, 'patterns'],
    ]
      .map(
        ([t, n, dir]) =>
          `<a class="card" href="${repo}/tree/main/examples/code-snippets/${dir}" target="_blank" rel="noopener">
            <div class="card-t">${t}<span class="nav-count">${n}</span></div></a>`,
      )
      .join('')}
  </div>`
}
