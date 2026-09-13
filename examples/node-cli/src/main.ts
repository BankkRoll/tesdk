#!/usr/bin/env -S node --experimental-strip-types --env-file-if-exists=.env
/**
 * @file CLI entry point: argument dispatch, client construction, and the
 * single place where SDK errors become exit codes.
 *
 * Run it with `npm start -- <command>`, which loads `.env` and applies the
 * TypeScript loader.
 */

import { TeslaClient, TeslaError } from '@bankkroll/tesdk'
import {
  energy,
  fleetStatus,
  isVehicleAction,
  listVehicles,
  setChargeLimit,
  status,
  vehicleAction,
  watch,
  whoami,
  type Command,
} from './commands.ts'
import { fileTokenStore, loadConfig, tokenPath } from './config.ts'
import { login } from './login.ts'
import { bold, cyan, dim, fail, green, line } from './ui.ts'

/** Non-action commands, keyed by name. */
const COMMANDS: Record<string, Command> = {
  vehicles: listVehicles,
  status,
  watch,
  'charge-limit': setChargeLimit,
  'fleet-status': fleetStatus,
  energy,
  whoami,
}

function usage(): void {
  line(`
${bold('tesla')} ${dim('— Tesla Fleet API command line, built on tesdk')}

${bold('Usage')}
  tesla <command> [vin] [options]

${bold('Account')}
  login                      Authorize in a browser and cache the tokens
  whoami                     Show the signed-in account and its region
  logout                     Discard the cached tokens

${bold('Vehicles')}
  vehicles                   List vehicles and connectivity state
  status [vin] [--wake]      Charge, climate, and location summary
  watch [vin] [--interval=30]  Poll charge state until interrupted
  fleet-status               Report which vehicles need signed commands

${bold('Commands')}
  lock | unlock [vin]        Lock or unlock the doors
  honk | flash [vin]         Sound the horn or flash the lights
  charge-start | charge-stop [vin]
  climate-on | climate-off [vin]
  charge-limit [vin] <50-100>
  wake [vin]                 Wake the vehicle from sleep

${bold('Energy')}
  energy                     Live power flow for each energy site

${bold('Environment')}
  TESLA_CLIENT_ID            Required
  TESLA_CLIENT_SECRET        Required for confidential clients
  TESLA_REGION               na | eu | cn  ${dim('(default: na)')}
  TESLA_REDIRECT_URI         ${dim('(default: http://localhost:8788/callback)')}
  TESLA_PROXY_URL            Vehicle Command Proxy, for signed commands

${dim(`Tokens are cached at ${tokenPath}`)}
`)
}

/** Builds a client from the environment and the on-disk token store. */
function createClient(): TeslaClient {
  const config = loadConfig()

  return new TeslaClient({
    region: config.region,
    // A proxy address replaces the regional host so commands are signed.
    baseUrl: config.proxyUrl,
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    redirectUri: config.redirectUri,
    tokenStore: fileTokenStore(),
    onRequest: process.env['TESLA_DEBUG']
      ? ({ method, url, status: code, attempt, durationMs }) => {
          line(dim(`  → ${method} ${url} ${code ?? '—'} ${durationMs}ms attempt ${attempt}`))
        }
      : undefined,
  })
}

async function main(): Promise<number> {
  const [name = 'help', ...args] = process.argv.slice(2)

  if (name === 'help' || name === '--help' || name === '-h') {
    usage()
    return 0
  }

  const client = createClient()

  if (name === 'login') {
    const tokens = await login(client, loadConfig())
    line(`\n${green('✓')} signed in`)
    line(dim(`  scopes: ${tokens.scopes?.join(', ') ?? 'unknown'}`))
    line(dim(`  tokens: ${tokenPath}`))
    return 0
  }

  if (name === 'logout') {
    await fileTokenStore().clear?.()
    line(`${green('✓')} tokens discarded`)
    return 0
  }

  // Resolve the command before checking credentials, so a typo reports the
  // typo rather than a misleading "not signed in".
  const command = COMMANDS[name] ?? (isVehicleAction(name) ? vehicleAction(name) : undefined)
  if (!command) {
    fail(`Unknown command "${name}". Run ${cyan('tesla help')}.`)
    return 1
  }

  if (!(await client.getTokens())) {
    fail(`Not signed in. Run ${cyan('tesla login')} first.`)
    return 1
  }

  await command(client, args)
  return 0
}

try {
  process.exitCode = await main()
} catch (error) {
  if (error instanceof TeslaError) {
    fail(error.message)
    line(dim(`  code: ${error.code}${error.status ? `  status: ${error.status}` : ''}`))
    if (error.requestId) line(dim(`  request id: ${error.requestId}`))
  } else {
    fail((error as Error).message)
  }
  process.exitCode = 1
}
