/**
 * @file Uploading a time-of-use tariff so the site can arbitrage against it.
 *
 * Prerequisites: a token with `energy_cmds`, and the site in `autonomous` mode —
 * a tariff has no effect in `self_consumption` or `backup`.
 */

import { TeslaClient, type EnergyCommandResult } from 'tesdk'

/**
 * A two-rate weekday tariff with a flat weekend.
 *
 * Tesla validates the structure strictly: every season must cover all 24 hours
 * of every day with no gaps and no overlaps, and prices must be non-negative.
 * A gap is rejected outright rather than defaulted.
 */
const SUMMER_PEAK_TARIFF: Record<string, unknown> = {
  code: 'EXAMPLE-TOU',
  utility: 'Example Utility',
  name: 'Summer peak',
  daily_charges: [{ name: 'Charge', amount: 0 }],
  demand_charges: { ALL: { ALL: 0 } },
  energy_charges: {
    ALL: { ALL: 0 },
    Summer: { ON_PEAK: 0.42, OFF_PEAK: 0.18 },
    Winter: { ALL: 0.21 },
  },
  seasons: {
    Summer: {
      fromMonth: 6,
      fromDay: 1,
      toMonth: 9,
      toDay: 30,
      tou_periods: {
        ON_PEAK: [{ fromDayOfWeek: 1, toDayOfWeek: 5, fromHour: 16, toHour: 21 }],
        OFF_PEAK: [
          { fromDayOfWeek: 1, toDayOfWeek: 5, fromHour: 21, toHour: 16 },
          { fromDayOfWeek: 6, toDayOfWeek: 0, fromHour: 0, toHour: 24 },
        ],
      },
    },
    Winter: {
      fromMonth: 10,
      fromDay: 1,
      toMonth: 5,
      toDay: 31,
      tou_periods: { ALL: [{ fromDayOfWeek: 0, toDayOfWeek: 6, fromHour: 0, toHour: 24 }] },
    },
  },
}

/**
 * Applies a tariff to a site.
 *
 * @param client - Authenticated client.
 * @param siteId - Energy site identifier.
 * @param tariff - Tariff structure, sent as `tou_settings.tariff_content_v2`.
 * @throws {InvalidRequestError} When the tariff leaves a period uncovered or
 * prices a period twice.
 */
export async function applyTariff(
  client: TeslaClient,
  siteId: number,
  tariff: Record<string, unknown>,
): Promise<EnergyCommandResult> {
  return await client.energy.setTimeOfUseSettings(siteId, tariff)
}

/**
 * Puts the site on the example tariff and switches it to the mode that uses one.
 *
 * @param client - Authenticated client.
 * @param siteId - Energy site identifier.
 */
export async function enableTimeOfUseArbitrage(
  client: TeslaClient,
  siteId: number,
): Promise<EnergyCommandResult> {
  await client.energy.setTimeOfUseSettings(siteId, SUMMER_PEAK_TARIFF)
  return await client.energy.setOperationMode(siteId, 'autonomous')
}
