/**
 * @file Terminal formatting helpers.
 *
 * Colour is emitted only when stdout is a TTY and `NO_COLOR` is unset, so
 * piped output stays clean.
 */

/** ASCII escape introducer for SGR sequences. */
const ESC = String.fromCharCode(27)

const useColor = process.stdout.isTTY && !process.env['NO_COLOR']

/** Wraps text in an ANSI SGR code when colour is enabled. */
const paint =
  (code: number) =>
  (text: string): string =>
    useColor ? `${ESC}[${code}m${text}${ESC}[0m` : text

export const bold = paint(1)
export const dim = paint(2)
export const red = paint(31)
export const green = paint(32)
export const yellow = paint(33)
export const cyan = paint(36)

/** Prints a section heading. */
export function heading(text: string): void {
  process.stdout.write(`\n${bold(text)}\n`)
}

/** Prints an aligned `label  value` row. */
export function row(label: string, value: string, width = 18): void {
  process.stdout.write(`  ${dim(label.padEnd(width))}${value}\n`)
}

/** Prints a bare line. */
export function line(text = ''): void {
  process.stdout.write(`${text}\n`)
}

/** Prints an error to stderr. */
export function fail(text: string): void {
  process.stderr.write(`${red('error')} ${text}\n`)
}

/**
 * Renders a proportional bar, used for state of charge.
 *
 * @param percent - Fill level from 0 to 100.
 * @param width - Bar width in characters.
 */
export function bar(percent: number, width = 24): string {
  const filled = Math.round((Math.min(Math.max(percent, 0), 100) / 100) * width)
  const colour = percent <= 20 ? red : percent <= 50 ? yellow : green
  return `${colour('█'.repeat(filled))}${dim('░'.repeat(width - filled))}`
}

/** Renders a coloured dot plus label for a vehicle connectivity state. */
export function stateBadge(state: string): string {
  if (state === 'online') return `${green('●')} online`
  if (state === 'asleep') return `${yellow('●')} asleep`
  return `${dim('●')} ${state}`
}

/**
 * Runs an async task while showing a spinner, clearing it when settled.
 *
 * Falls back to a single status line when stdout is not a TTY.
 *
 * @typeParam T - Result type of the task.
 */
export async function spin<T>(label: string, task: () => Promise<T>): Promise<T> {
  if (!process.stdout.isTTY) {
    line(dim(`… ${label}`))
    return await task()
  }

  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
  let index = 0
  const timer = setInterval(() => {
    process.stdout.write(`\r${cyan(frames[index] ?? '⠋')} ${label}`)
    index = (index + 1) % frames.length
  }, 80)

  try {
    return await task()
  } finally {
    clearInterval(timer)
    process.stdout.write(`\r${' '.repeat(label.length + 4)}\r`)
  }
}
