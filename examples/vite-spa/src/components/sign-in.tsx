/**
 * @file Sign-in screen.
 *
 * States the scopes in plain language before the redirect, so the consent
 * screen confirms an expectation rather than introducing one.
 */

import { FailureNotice } from './notice.tsx'
import type { Failure } from '../lib/errors.ts'

/** Human-readable summary of the scopes in `lib/config.ts`, in the same order. */
const SCOPE_LABELS = [
  'Profile information',
  'Vehicle information',
  'Vehicle commands',
  'Charging management',
] as const

/** Props for {@link SignIn}. */
export interface SignInProps {
  /** Starts the PKCE authorization flow. */
  onSignIn: () => void
  /** Whether an authorization code is being exchanged. */
  exchanging: boolean
  /** Failure from a previous attempt. */
  failure: Failure | undefined
}

/**
 * Renders the unauthenticated landing screen.
 *
 * @param props - See {@link SignInProps}.
 */
export function SignIn({ onSignIn, exchanging, failure }: SignInProps): React.JSX.Element {
  return (
    <div className="signin">
      <div className="signin-inner">
        <h1>Fleet</h1>
        <p>Connect your Tesla account to view and control your vehicles.</p>

        <FailureNotice failure={failure} />

        <button type="button" className="btn btn-primary" disabled={exchanging} onClick={onSignIn}>
          {exchanging ? 'Signing in…' : 'Sign in with Tesla'}
        </button>

        <ul className="scopes">
          {SCOPE_LABELS.map((label) => (
            <li key={label}>{label}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}
