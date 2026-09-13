/**
 * @file Environment configuration and on-disk token persistence.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { createTokenStore, type Region, type TokenSet, type TokenStore } from 'tesdk'

/** Credentials and defaults read from the environment. */
export interface CliConfig {
  clientId: string
  clientSecret: string | undefined
  redirectUri: string
  region: Region
  /** Vehicle Command Proxy address, when one is running. */
  proxyUrl: string | undefined
}

/** Where tokens are cached between invocations. */
const TOKEN_PATH = join(homedir(), '.config', 'tesdk-cli', 'tokens.json')

/**
 * Reads configuration from the environment.
 *
 * @throws {Error} When `TESLA_CLIENT_ID` is not set.
 */
export function loadConfig(): CliConfig {
  const clientId = process.env['TESLA_CLIENT_ID']
  if (!clientId) {
    throw new Error('TESLA_CLIENT_ID is required. Copy .env.example to .env and fill it in.')
  }

  const region = (process.env['TESLA_REGION'] ?? 'na') as Region
  if (!['na', 'eu', 'cn'].includes(region)) {
    throw new Error(`TESLA_REGION must be na, eu, or cn (received "${region}").`)
  }

  return {
    clientId,
    clientSecret: process.env['TESLA_CLIENT_SECRET'],
    redirectUri: process.env['TESLA_REDIRECT_URI'] ?? 'http://localhost:8788/callback',
    region,
    proxyUrl: process.env['TESLA_PROXY_URL'],
  }
}

/**
 * Creates a token store backed by a file under the user's config directory.
 *
 * Written with mode 600 so the refresh token is not world-readable. A refresh
 * token grants the same access as a password until revoked.
 */
export function fileTokenStore(path = TOKEN_PATH): TokenStore {
  return createTokenStore({
    async get(): Promise<TokenSet | undefined> {
      try {
        return JSON.parse(await readFile(path, 'utf8')) as TokenSet
      } catch {
        return undefined
      }
    },
    async set(tokens: TokenSet): Promise<void> {
      await mkdir(dirname(path), { recursive: true })
      await writeFile(path, JSON.stringify(tokens, null, 2), { mode: 0o600 })
    },
    async clear(): Promise<void> {
      await writeFile(path, '', { mode: 0o600 })
    },
  })
}

/** Absolute path of the token cache, shown in help output. */
export const tokenPath = TOKEN_PATH
