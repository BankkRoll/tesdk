/**
 * @file Starting, stopping, and tuning a charging session.
 *
 * Prerequisites: a token with `vehicle_charging_cmds`.
 */

import { TeslaClient, type ChargeState, type CommandResult } from '@bankkroll/tesdk'

/**
 * Starts charging if the vehicle is plugged in and not already charging.
 *
 * The pre-flight read makes the outcome legible: `charge_start` on an unplugged
 * vehicle resolves with `result: false` and a reason, which is easy to miss.
 *
 * @param client - Authenticated client.
 * @param vin - Vehicle identification number.
 * @returns The command result, or `undefined` when there was nothing to do.
 */
export async function startCharging(
  client: TeslaClient,
  vin: string,
): Promise<CommandResult | undefined> {
  const data = await client.vehicles.withWake(vin, () =>
    client.vehicles.data(vin, { endpoints: ['charge_state'] }),
  )
  const state: ChargeState | undefined = data.charge_state

  if (state?.charging_state === 'Disconnected') {
    throw new Error(`Vehicle ${vin} is not plugged in.`)
  }
  if (state?.charging_state === 'Charging') return undefined

  return await client.commands.chargeStart(vin)
}

/** Stops an active charging session. */
export async function stopCharging(client: TeslaClient, vin: string): Promise<CommandResult> {
  return await client.commands.chargeStop(vin)
}

/**
 * Sets the charge limit.
 *
 * @param client - Authenticated client.
 * @param vin - Vehicle identification number.
 * @param percent - Target state of charge, from 50 to 100.
 * @throws {RangeError} When the percentage is outside the accepted range.
 */
export async function setChargeLimit(
  client: TeslaClient,
  vin: string,
  percent: number,
): Promise<CommandResult> {
  if (!Number.isInteger(percent) || percent < 50 || percent > 100) {
    throw new RangeError(`Charge limit must be an integer from 50 to 100 (received ${percent}).`)
  }
  return await client.commands.setChargeLimit(vin, percent)
}

/**
 * Throttles charging current, for example to stay under a shared circuit's
 * capacity.
 *
 * The vehicle clamps the request to what the connected equipment supports, so
 * the value that takes effect can be lower than the one requested. Read
 * `charge_amps` back to see what actually applied.
 *
 * @param client - Authenticated client.
 * @param vin - Vehicle identification number.
 * @param amps - Requested amperage.
 * @returns The amperage the vehicle settled on.
 */
export async function throttleCharging(
  client: TeslaClient,
  vin: string,
  amps: number,
): Promise<number | undefined> {
  await client.commands.setChargingAmps(vin, amps)
  const data = await client.vehicles.data(vin, { endpoints: ['charge_state'] })
  return data.charge_state?.charge_amps
}

/** Opens the charge port door, or unlocks the cable when the port is already open. */
export async function openChargePort(client: TeslaClient, vin: string): Promise<CommandResult> {
  return await client.commands.chargePortDoorOpen(vin)
}
