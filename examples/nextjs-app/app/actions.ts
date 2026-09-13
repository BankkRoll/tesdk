'use server'

/**
 * @file Server Actions.
 *
 * Every mutation the UI performs lives here. Actions are public endpoints, so
 * each one re-checks the session rather than trusting a page-level guard, and
 * the set of runnable vehicle commands is a closed allowlist rather than a
 * name forwarded from the client.
 */

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { SigningRequiredError, TeslaError, createPkcePair, randomString } from 'tesdk'
import type { TeslaClient } from 'tesdk'
import {
  appConfig,
  clearSession,
  clientFromSession,
  createClient,
  setOAuthState,
} from '../lib/session.ts'

/** Scopes requested at login. Ask only for what the dashboard reads. */
const SCOPES = [
  'user_data',
  'vehicle_device_data',
  'vehicle_location',
  'vehicle_cmds',
  'vehicle_charging_cmds',
] as const

/**
 * Vehicle commands the dashboard can run.
 *
 * The allowlist is the security boundary: without it, a caller could invoke
 * any Fleet API command the session's scopes permit.
 */
const COMMANDS = {
  lock: (client: TeslaClient, vin: string) => client.commands.doorLock(vin),
  unlock: (client: TeslaClient, vin: string) => client.commands.doorUnlock(vin),
  flash: (client: TeslaClient, vin: string) => client.commands.flashLights(vin),
  honk: (client: TeslaClient, vin: string) => client.commands.honkHorn(vin),
  climateOn: (client: TeslaClient, vin: string) => client.commands.climateStart(vin),
  climateOff: (client: TeslaClient, vin: string) => client.commands.climateStop(vin),
  chargeStart: (client: TeslaClient, vin: string) => client.commands.chargeStart(vin),
  chargeStop: (client: TeslaClient, vin: string) => client.commands.chargeStop(vin),
  wake: (client: TeslaClient, vin: string) => client.vehicles.wakeUp(vin),
} as const

/** Name of a command the dashboard exposes. */
export type CommandName = keyof typeof COMMANDS

/** Outcome returned to the client, rendered as a status line. */
export interface ActionResult {
  ok: boolean
  message: string
}

/** Converts an SDK failure into a message safe to show a visitor. */
function describe(error: unknown): string {
  if (error instanceof SigningRequiredError) {
    return 'This vehicle requires signed commands. Route the app through a Vehicle Command Proxy.'
  }
  if (error instanceof TeslaError) return error.message
  return 'Something went wrong.'
}

/** Begins the OAuth flow and redirects to Tesla's consent screen. */
export async function signIn(): Promise<never> {
  const pkce = await createPkcePair()
  const state = randomString()

  await setOAuthState({ state, verifier: pkce.verifier })

  const authorizeUrl = createClient().oauth.authorizeUrl({
    scopes: [...SCOPES],
    state,
    pkce,
    redirectUri: appConfig().redirectUri,
  })

  // `typedRoutes` narrows `redirect` to internal routes; Tesla's consent
  // screen is external, so the URL is passed through as an unchecked route.
  redirect(authorizeUrl as Parameters<typeof redirect>[0])
}

/** Clears the session and returns to the sign-in screen. */
export async function signOut(): Promise<never> {
  await clearSession()
  redirect('/')
}

/**
 * Runs a vehicle command.
 *
 * Wakes the vehicle first: a dashboard button is a deliberate user action, so
 * the battery cost of waking is expected here even though the SDK never wakes
 * implicitly.
 *
 * @param vin - Target vehicle.
 * @param name - Command to run; rejected unless it is in {@link COMMANDS}.
 */
export async function runCommand(vin: string, name: CommandName): Promise<ActionResult> {
  const client = await clientFromSession()
  if (!client) return { ok: false, message: 'Your session expired. Sign in again.' }

  const command = COMMANDS[name]
  if (!command) return { ok: false, message: 'Unsupported command.' }

  try {
    const result = await client.vehicles.withWake(vin, () => command(client, vin))

    if (result.result === false) {
      return { ok: false, message: result.reason ?? 'The vehicle declined the command.' }
    }
  } catch (error) {
    return { ok: false, message: describe(error) }
  }

  revalidatePath(`/vehicles/${vin}`)
  return { ok: true, message: `${name} sent.` }
}

/**
 * Sets the charge limit.
 *
 * @param percent - Target state of charge, from 50 to 100.
 */
export async function setChargeLimit(vin: string, percent: number): Promise<ActionResult> {
  if (!Number.isInteger(percent) || percent < 50 || percent > 100) {
    return { ok: false, message: 'Charge limit must be a whole number between 50 and 100.' }
  }

  const client = await clientFromSession()
  if (!client) return { ok: false, message: 'Your session expired. Sign in again.' }

  try {
    await client.vehicles.withWake(vin, () => client.commands.setChargeLimit(vin, percent))
  } catch (error) {
    return { ok: false, message: describe(error) }
  }

  revalidatePath(`/vehicles/${vin}`)
  return { ok: true, message: `Charge limit set to ${percent}%.` }
}
