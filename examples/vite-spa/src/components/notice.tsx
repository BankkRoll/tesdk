/**
 * @file Status and failure notices.
 *
 * One component for both outcomes so that the success and error paths cannot
 * drift apart visually, and so `role="status"` is applied consistently — the
 * result of a command is exactly the kind of change a screen reader should
 * announce without stealing focus.
 */

import type { Failure } from '../lib/errors.ts'

/** Props for {@link Notice}. */
export interface NoticeProps {
  /** Renders with the success accent when `true`. */
  ok?: boolean
  /** Headline text. */
  message: string
  /** Second line, typically the remedy. */
  detail?: string | undefined
  /** Optional action rendered below the text, such as a wake button. */
  children?: React.ReactNode
}

/**
 * Renders a single status line.
 *
 * @param props - See {@link NoticeProps}.
 */
export function Notice({ ok = false, message, detail, children }: NoticeProps): React.JSX.Element {
  return (
    <div className={`notice ${ok ? 'ok' : ''}`} role="status">
      <p>{message}</p>
      {detail ? <p>{detail}</p> : null}
      {children}
    </div>
  )
}

/**
 * Renders a {@link Failure}, or nothing when there is none.
 *
 * @param props.failure - The failure to show.
 * @param props.children - Optional remedy action.
 */
export function FailureNotice({
  failure,
  children,
}: {
  failure: Failure | undefined
  children?: React.ReactNode
}): React.JSX.Element | null {
  if (!failure) return null
  return (
    <Notice message={failure.message} detail={failure.detail}>
      {children}
    </Notice>
  )
}
