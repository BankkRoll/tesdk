/**
 * @file A minimal async-data hook, shared by the list and detail screens.
 *
 * Deliberately not a data-fetching library: the point of the example is the
 * SDK, and a bespoke hook keeps the dependency list to React and `tesdk`. What
 * it does provide is the part that is easy to get wrong — an `AbortSignal`
 * threaded into the SDK call, so an unmounted screen cancels its request
 * instead of writing to a dead component.
 */

import { useCallback, useEffect, useState } from 'react'
import { describeError, type Failure } from '../lib/errors.ts'

/** State of one async load. */
export interface AsyncState<T> {
  /** Resolved value, `undefined` until the first success. */
  data: T | undefined
  /** Whether a load is in flight. */
  loading: boolean
  /** Failure from the most recent load, cleared when one succeeds. */
  failure: Failure | undefined
  /** Runs the loader again, for example after waking the vehicle. */
  reload: () => void
}

/**
 * Loads a value, re-running whenever `deps` change.
 *
 * @typeParam T - Resolved value type.
 * @param load - Loader receiving a signal that aborts on unmount or reload.
 * @param deps - Values that identify the request; a change starts a new load.
 * @returns The current {@link AsyncState}.
 *
 * @example
 * ```ts
 * const { data, loading } = useAsync(
 *   (signal) => client.vehicles.list({ signal }),
 *   [client],
 * )
 * ```
 */
export function useAsync<T>(
  load: (signal: AbortSignal) => Promise<T>,
  deps: readonly unknown[],
): AsyncState<T> {
  const [data, setData] = useState<T | undefined>(undefined)
  const [failure, setFailure] = useState<Failure | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [nonce, setNonce] = useState(0)

  const reload = useCallback(() => {
    setNonce((value) => value + 1)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)

    load(controller.signal)
      .then((value) => {
        if (controller.signal.aborted) return
        setData(value)
        setFailure(undefined)
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setFailure(describeError(error))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => {
      controller.abort()
    }
    // `load` is intentionally not a dependency: callers pass an inline closure
    // that is new on every render, so `deps` is their declaration of what
    // actually identifies the request.
  }, [...deps, nonce])

  return { data, loading, failure, reload }
}
