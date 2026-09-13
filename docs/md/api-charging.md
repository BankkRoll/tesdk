# client.charging

> Charging history, sessions, and PDF invoices.

Charging history and invoices for the authenticated account.

Accessed as `client.charging`.

See: https://developer.tesla.com/docs/fleet-api/endpoints/charging-endpoints

## Methods

### `history`

```ts
history(options?: PageOptions & RequestOverrides): Promise<ChargingHistoryPage>
```


### `sessions`

```ts
sessions(options?: PageOptions & RequestOverrides): Promise<ChargingSessionPage>
```

Returns session detail including pricing and energy.

Available only to business accounts that own a fleet of vehicles.


### `invoice`

```ts
invoice(invoiceId: string, options?: RequestOverrides): Promise<ArrayBuffer>
```

Downloads the PDF invoice for a charging event.

**Parameters**

- `invoiceId` - Invoice identifier taken from a history entry.

**Returns** — Raw PDF bytes, not a parsed object.


