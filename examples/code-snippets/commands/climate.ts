/**
 * @file Preconditioning, temperature targets, and Climate Keeper.
 *
 * Prerequisites: a token with `vehicle_cmds`.
 */

import { TeslaClient, type ClimateState, type CommandResult } from 'tesdk'

/**
 * Preconditions the cabin to a target temperature.
 *
 * Order matters: setting the temperature first means the vehicle starts heating
 * or cooling toward the right target immediately, instead of running briefly at
 * whatever it last held.
 *
 * @param client - Authenticated client.
 * @param vin - Vehicle identification number.
 * @param celsius - Target cabin temperature.
 */
export async function precondition(
  client: TeslaClient,
  vin: string,
  celsius: number,
): Promise<void> {
  await client.vehicles.ensureAwake(vin)
  await client.commands.setTemps(vin, { driverTemp: celsius })
  await client.commands.climateStart(vin)
}

/**
 * Sets driver and passenger targets independently.
 *
 * `passengerTemp` defaults to `driverTemp`, so pass it only when the two differ.
 *
 * @param client - Authenticated client.
 * @param vin - Vehicle identification number.
 * @param temps - Per-side targets in Celsius.
 */
export async function setSplitTemps(
  client: TeslaClient,
  vin: string,
  temps: { driver: number; passenger: number },
): Promise<CommandResult> {
  return await client.commands.setTemps(vin, {
    driverTemp: temps.driver,
    passengerTemp: temps.passenger,
  })
}

/** Stops climate control. */
export async function climateOff(client: TeslaClient, vin: string): Promise<CommandResult> {
  return await client.commands.climateStop(vin)
}

/**
 * Leaves Dog Mode running for a pet in the vehicle.
 *
 * Mode `2` is Dog; `1` is Keep, `3` is Camp, `0` turns it off.
 *
 * @param client - Authenticated client.
 * @param vin - Vehicle identification number.
 */
export async function dogMode(client: TeslaClient, vin: string): Promise<CommandResult> {
  return await client.commands.setClimateKeeperMode(vin, 2)
}

/**
 * Enables Cabin Overheat Protection in fan-only mode.
 *
 * Fan-only trades some cooling for far less battery drain, which suits a
 * vehicle parked outdoors for days.
 *
 * @param client - Authenticated client.
 * @param vin - Vehicle identification number.
 */
export async function fanOnlyOverheatProtection(
  client: TeslaClient,
  vin: string,
): Promise<CommandResult> {
  return await client.commands.setCabinOverheatProtection(vin, { on: true, fanOnly: true })
}

/**
 * Reads back what climate control is currently doing.
 *
 * @param client - Authenticated client.
 * @param vin - Vehicle identification number.
 */
export async function climateState(
  client: TeslaClient,
  vin: string,
): Promise<ClimateState | undefined> {
  const data = await client.vehicles.data(vin, { endpoints: ['climate_state'] })
  return data.climate_state
}
