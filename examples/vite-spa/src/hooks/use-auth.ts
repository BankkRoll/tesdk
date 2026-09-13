/**
 * @file The authorization-code + PKCE flow, as a hook.
 *
 * Three moments make up the flow, and all of them live here so no component
 * has to know the order:
 *
 * 1. `signIn` mints a PKCE pair and a `state`, stores both, and leaves for
 *    Tesla's consent screen.
 * 2. On return to the redirect URI, the effect trades the code for tokens —
 *    once, guarded against React's development double-invoke.
 * 3. From then on the memoised client refreshes tokens on its own, writing
 *    each rotation back to storage.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPkcePair, randomString, type TeslaClient, type TokenSet } from 'tesdk'
import { createClient } from '../lib/client.ts'
import { SCOPES, appConfig } from '../lib/config.ts'
import { describeError, type Failure } from '../lib/errors.ts'
import {
  clearSession,
  loadSession,
  savePendingAuth,
  saveSession,
  takePendingAuth,
} from '../lib/session.ts'

/** Everything a component needs to sign in, sign out, or make a request. */
export interface Auth {
  /** Client bound to the current session, or `undefined` when signed out. */
  client: TeslaClient | undefined
  /** Whether an authorization code is currently being exchanged. */
  exchanging: boolean
  /** Failure from the last sign-in attempt, if any. */
  failure: Failure | undefined
  /** Redirects to Tesla's consent screen. */
  signIn: () => Promise<void>
  /** Discards the session without notifying Tesla. */
  signOut: () => void
}

/** Query parameters Tesla sends to the redirect URI. */
interface Callback {
  code: string | null
  state: string | null
  /** Set instead of `code` when the visitor declines consent. */
  error: string | null
}

/**
 * Reads the authorization response from the current URL.
 *
 * Tesla can redirect back with `error` instead of `code`, which is a message
 * for the visitor rather than a bug.
 */
function readCallback(): Callback {
  const params = new URLSearchParams(location.search)
  return {
    code: params.get('code'),
    state: params.get('state'),
    error: params.get('error_description') ?? params.get('error'),
  }
}

/** Replaces the callback URL with the app root, dropping the code from history. */
function consumeCallbackUrl(): void {
  history.replaceState(null, '', '/')
}

/**
 * Drives the OAuth session.
 *
 * @returns The current session and the actions that change it.
 *
 * @example
 * ```ts
 * const { client, signIn } = useAuth()
 * if (!client) return <button onClick={signIn}>Sign in</button>
 * ```
 */
export function useAuth(): Auth {
  const [tokens, setTokens] = useState<TokenSet | undefined>(loadSession)
  const [failure, setFailure] = useState<Failure | undefined>(undefined)
  const [exchanging, setExchanging] = useState(() => readCallback().code !== null)

  // Strict Mode runs effects twice in development, and an authorization code
  // is single-use: the second exchange would fail and clear a valid session.
  const exchanged = useRef(false)

  const persist = useCallback((next: TokenSet) => {
    saveSession(next)
    setTokens(next)
  }, [])

  const client = useMemo(
    () => (tokens ? createClient(tokens, persist) : undefined),
    [tokens, persist],
  )

  useEffect(() => {
    if (exchanged.current) return
    const { code, state, error } = readCallback()
    if (code === null && error === null) return

    exchanged.current = true
    const pending = takePendingAuth()
    consumeCallbackUrl()

    if (error !== null) {
      setFailure({ message: error })
      setExchanging(false)
      return
    }

    // A mismatched or missing `state` means the response was not produced by
    // the request this tab made, so the code must not be exchanged.
    if (code === null || !pending || pending.state !== state) {
      setFailure({
        message: 'Sign-in could not be verified.',
        detail: 'The state parameter did not match the one this tab issued. Try again.',
      })
      setExchanging(false)
      return
    }

    createClient(undefined, persist)
      .oauth.exchangeCode({ code, codeVerifier: pending.verifier })
      .then(persist)
      .catch((cause: unknown) => {
        setFailure(describeError(cause))
      })
      .finally(() => {
        setExchanging(false)
      })
  }, [persist])

  const signIn = useCallback(async () => {
    try {
      const pkce = await createPkcePair()
      const state = randomString()
      savePendingAuth({ state, verifier: pkce.verifier })

      location.assign(
        createClient(undefined, persist).oauth.authorizeUrl({
          scopes: [...SCOPES],
          state,
          pkce,
          redirectUri: appConfig().redirectUri,
        }),
      )
    } catch (cause) {
      setFailure(describeError(cause))
    }
  }, [persist])

  const signOut = useCallback(() => {
    clearSession()
    setTokens(undefined)
    setFailure(undefined)
  }, [])

  return { client, exchanging, failure, signIn, signOut }
}
