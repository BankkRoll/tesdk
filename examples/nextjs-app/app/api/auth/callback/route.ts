/**
 * @file Completes the authorization-code flow.
 *
 * Validates the CSRF state, exchanges the code with the stored PKCE verifier,
 * and writes the resulting tokens to the session cookie.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { TeslaError } from 'tesdk'
import { createClient, setSession, takeOAuthState } from '../../../../lib/session.ts'

/** Redirects home with a message the UI can surface. */
function withError(request: NextRequest, message: string): NextResponse {
  const url = new URL('/', request.nextUrl.origin)
  url.searchParams.set('error', message)
  return NextResponse.redirect(url)
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const params = request.nextUrl.searchParams

  const denied = params.get('error')
  if (denied) return withError(request, denied)

  const code = params.get('code')
  const state = params.get('state')
  const pending = await takeOAuthState()

  if (!code || !pending) return withError(request, 'Login session expired. Try again.')

  // A mismatched state means this callback does not belong to the request we
  // started, so the code must not be exchanged.
  if (state !== pending.state) return withError(request, 'State mismatch.')

  try {
    const tokens = await createClient().oauth.exchangeCode({
      code,
      codeVerifier: pending.verifier,
    })
    await setSession(tokens)
  } catch (error) {
    const message = error instanceof TeslaError ? error.message : 'Token exchange failed.'
    return withError(request, message)
  }

  return NextResponse.redirect(new URL('/', request.nextUrl.origin))
}
