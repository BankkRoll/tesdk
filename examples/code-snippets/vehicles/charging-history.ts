/**
 * @file Charging history and PDF invoices for the authenticated account.
 *
 * Prerequisites: a token with `vehicle_charging_cmds`. `sessions` additionally
 * requires a business account that owns the vehicles.
 */

import { TeslaClient, type ChargingHistoryEntry } from 'tesdk'

/**
 * Walks charging history until Tesla stops reporting more.
 *
 * This endpoint paginates on `hasMoreData` rather than the cursor envelope the
 * vehicle endpoints use, so it cannot go through `listAll`.
 *
 * @param client - Authenticated client.
 * @param pageSize - Rows per request.
 * @param maxPages - Upper bound, so a runaway account cannot loop forever.
 * @returns Every charging event, oldest page first.
 */
export async function allChargingHistory(
  client: TeslaClient,
  pageSize = 50,
  maxPages = 100,
): Promise<ChargingHistoryEntry[]> {
  const entries: ChargingHistoryEntry[] = []

  for (let page = 1; page <= maxPages; page++) {
    const result = await client.charging.history({ page, perPage: pageSize })
    entries.push(...(result.data ?? []))
    if (result.hasMoreData !== true) break
  }

  return entries
}

/**
 * Totals the energy drawn by one vehicle.
 *
 * `energyDrawnKwh` arrives as a string, so it is parsed rather than summed
 * directly — adding strings would silently concatenate.
 *
 * @param client - Authenticated client.
 * @param vin - Vehicle identification number.
 * @returns Total kilowatt-hours across every recorded session.
 */
export async function totalEnergyDrawn(client: TeslaClient, vin: string): Promise<number> {
  const history = await allChargingHistory(client)

  return history
    .filter((entry) => entry.vin === vin)
    .reduce((sum, entry) => {
      const kwh = Number(entry.energyDrawnKwh)
      return Number.isFinite(kwh) ? sum + kwh : sum
    }, 0)
}

/**
 * Downloads an invoice as raw PDF bytes.
 *
 * Returned as an `ArrayBuffer` rather than a string: the SDK decodes this
 * endpoint as binary, since text decoding would corrupt the file.
 *
 * @param client - Authenticated client.
 * @param invoiceId - Invoice identifier from a history entry.
 *
 * @example
 * ```ts
 * const pdf = await downloadInvoice(client, invoiceId)
 * await writeFile('invoice.pdf', new Uint8Array(pdf))
 * ```
 */
export async function downloadInvoice(
  client: TeslaClient,
  invoiceId: string,
): Promise<ArrayBuffer> {
  return await client.charging.invoice(invoiceId)
}
