/**
 * @file Seat heater levels, using the `SeatPosition` constants.
 *
 * Prerequisites: a token with `vehicle_cmds`. Seat heaters respond only while
 * climate control is running.
 */

import { SeatPosition, TeslaClient, type CommandResult } from 'tesdk'

/** Heater level: `0` off through `3` maximum. */
export type HeaterLevel = 0 | 1 | 2 | 3

/**
 * Sets one seat's heater level.
 *
 * `SeatPosition` is a const object rather than an enum, so it erases at compile
 * time and the numeric codes stay readable at the call site.
 *
 * @param client - Authenticated client.
 * @param vin - Vehicle identification number.
 * @param seat - Seat to heat.
 * @param level - Heater level.
 *
 * @example
 * ```ts
 * await setSeat(client, vin, SeatPosition.FrontLeft, 2)
 * ```
 */
export async function setSeat(
  client: TeslaClient,
  vin: string,
  seat: SeatPosition,
  level: HeaterLevel,
): Promise<CommandResult> {
  return await client.commands.setSeatHeater(vin, seat, level)
}

/**
 * Warms both front seats before a cold-morning departure.
 *
 * Climate must already be running, so this starts it first. Seats warm faster
 * than the cabin, which is why it is worth the extra command.
 *
 * @param client - Authenticated client.
 * @param vin - Vehicle identification number.
 * @param level - Heater level to apply to both seats.
 */
export async function warmFrontSeats(
  client: TeslaClient,
  vin: string,
  level: HeaterLevel = 3,
): Promise<void> {
  await client.vehicles.ensureAwake(vin)
  await client.commands.climateStart(vin)
  await Promise.all([
    client.commands.setSeatHeater(vin, SeatPosition.FrontLeft, level),
    client.commands.setSeatHeater(vin, SeatPosition.FrontRight, level),
  ])
}

/**
 * Turns every seat heater off.
 *
 * @param client - Authenticated client.
 * @param vin - Vehicle identification number.
 */
export async function allSeatsOff(client: TeslaClient, vin: string): Promise<void> {
  const seats: SeatPosition[] = Object.values(SeatPosition)
  await Promise.all(seats.map((seat) => client.commands.setSeatHeater(vin, seat, 0)))
}
