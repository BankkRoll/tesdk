import { readFileSync } from 'node:fs'
import { defineConfig } from 'tsdown'

const { version } = JSON.parse(readFileSync('./package.json', 'utf8')) as { version: string }

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  treeshake: true,
  target: 'es2022',
  publint: true,
  attw: true,
  // Injected at build time so the User-Agent cannot drift from package.json
  // when changesets bumps the version.
  define: { __TESDK_VERSION__: JSON.stringify(version) },
})
