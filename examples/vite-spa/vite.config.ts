/**
 * @file Vite configuration.
 *
 * Wires React fast refresh and the development proxy that lets the browser
 * reach Fleet API at all. See `dev-proxy.ts` for why the hop is mandatory.
 */

import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import type { Region } from '@bankkroll/tesdk'
import { teslaDevProxy } from './dev-proxy.ts'

export default defineConfig(({ mode }) => {
  // The proxy needs TESLA_PROXY_URL, which has no VITE_ prefix and so is
  // absent from `import.meta.env`. Load the raw file with an empty prefix.
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      react(),
      teslaDevProxy({
        region: (env['VITE_TESLA_REGION'] ?? 'na') as Region,
        upstream: env['TESLA_PROXY_URL'],
        insecure: env['TESLA_PROXY_INSECURE'] === '1',
      }),
    ],
    server: { port: 5173 },
    preview: { port: 5173 },
  }
})
