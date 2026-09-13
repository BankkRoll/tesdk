/**
 * @file Application shell.
 *
 * Owns the two decisions the rest of the tree depends on: whether there is a
 * session, and which screen the URL names. Everything below receives an
 * already-authenticated client, so no component repeats the signed-out check.
 */

import { SignIn } from './components/sign-in.tsx'
import { VehicleDetail } from './components/vehicle-detail.tsx'
import { VehicleList } from './components/vehicle-list.tsx'
import { useAuth } from './hooks/use-auth.ts'
import { useRoute, vehiclePath } from './hooks/use-route.ts'

/** Renders the whole application. */
export function App(): React.JSX.Element {
  const { client, exchanging, failure, signIn, signOut } = useAuth()
  const { route, navigate } = useRoute()

  if (!client) {
    return (
      <div className="shell">
        <SignIn
          onSignIn={() => {
            void signIn()
          }}
          exchanging={exchanging}
          failure={failure}
        />
      </div>
    )
  }

  return (
    <div className="shell">
      <header className="topbar">
        <span className="wordmark">Fleet</span>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            signOut()
            navigate('/')
          }}
        >
          Sign out
        </button>
      </header>

      {route.name === 'vehicle' ? (
        <VehicleDetail
          client={client}
          vin={route.vin}
          onBack={() => {
            navigate('/')
          }}
        />
      ) : (
        <VehicleList
          client={client}
          onOpen={(vin) => {
            navigate(vehiclePath(vin))
          }}
        />
      )}
    </div>
  )
}
