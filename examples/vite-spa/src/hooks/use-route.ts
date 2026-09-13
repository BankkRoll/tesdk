/**
 * @file A two-screen router over the History API.
 *
 * The app has one list and one detail view, so a routing library would be more
 * configuration than code. `useSyncExternalStore` subscribes to `popstate`,
 * which keeps the back button working; `navigate` pushes and then dispatches
 * the same event, since `pushState` deliberately does not fire one.
 */

import { useCallback, useSyncExternalStore } from 'react'

/** The screen currently addressed by the URL. */
export type Route = { name: 'vehicles' } | { name: 'vehicle'; vin: string }

/** Path prefix for the detail screen. */
const VEHICLE_PREFIX = '/vehicles/'

/** Parses the current path into a {@link Route}. */
function currentRoute(): Route {
  const path = location.pathname
  if (path.startsWith(VEHICLE_PREFIX)) {
    const vin = path.slice(VEHICLE_PREFIX.length)
    if (vin) return { name: 'vehicle', vin: decodeURIComponent(vin) }
  }
  return { name: 'vehicles' }
}

/** Subscribes to history changes, including the synthetic ones `navigate` emits. */
function subscribe(onChange: () => void): () => void {
  addEventListener('popstate', onChange)
  return () => {
    removeEventListener('popstate', onChange)
  }
}

// `useSyncExternalStore` compares snapshots by identity, so parsing on every
// call would report a change on every render. Reparse only when the path moves.
let snapshotPath = ''
let snapshot: Route = { name: 'vehicles' }

/** Returns a stable {@link Route} for the current path. */
function getSnapshot(): Route {
  if (location.pathname !== snapshotPath) {
    snapshotPath = location.pathname
    snapshot = currentRoute()
  }
  return snapshot
}

/** The current route and a function that changes it. */
export interface Router {
  route: Route
  /** Pushes a path and re-renders subscribers. */
  navigate: (path: string) => void
}

/**
 * Tracks the current route.
 *
 * @returns The active {@link Route} and a `navigate` function.
 *
 * @example
 * ```ts
 * const { route, navigate } = useRoute()
 * if (route.name === 'vehicle') return <VehiclePage vin={route.vin} />
 * ```
 */
export function useRoute(): Router {
  const route = useSyncExternalStore(subscribe, getSnapshot)

  const navigate = useCallback((path: string) => {
    if (path === location.pathname) return
    history.pushState(null, '', path)
    dispatchEvent(new PopStateEvent('popstate'))
  }, [])

  return { route, navigate }
}

/**
 * Builds the detail path for a vehicle.
 *
 * @param vin - Vehicle identification number.
 */
export function vehiclePath(vin: string): string {
  return `${VEHICLE_PREFIX}${encodeURIComponent(vin)}`
}
