/**
 * How a venue identifies and serves its orders — the browser's copy of the
 * whitelists in `src/db/schema.ts`.
 *
 * It lives in `lib/` because three places read it and none of them may import
 * another: the settings screen (`features/venues`), the cart, the tracker and
 * the bar card (`features/orders`), and the QR sheet. Importing `schema.ts`
 * into the bundle would drag Drizzle in with it, which is why `menu-theme.ts`
 * is a copy too.
 *
 * The values move together in three places: here, the checks on `venues`, and
 * the branches of `place_order`.
 */

/** `name`: the first name is the reference. `table`: the table is. */
export type OrderReference = 'name' | 'table'

/** `counter`: the customer collects. `table`: the staff bring it. */
export type ServiceMode = 'counter' | 'table'

/** Whether a table-mode venue still asks for a first name. */
export type FirstNameMode = 'none' | 'optional'

/** A venue's three settings, as the screens read them. */
export type OrderSettings = {
  reference: OrderReference
  service: ServiceMode
  firstName: FirstNameMode
}

export const ORDER_REFERENCES: ReadonlyArray<OrderReference> = ['name', 'table']
export const SERVICE_MODES: ReadonlyArray<ServiceMode> = ['counter', 'table']
export const FIRST_NAME_MODES: ReadonlyArray<FirstNameMode> = [
  'none',
  'optional',
]

/**
 * Reads the three columns of a venue row, trusting nothing.
 *
 * An unknown value falls back to today's behaviour — name, counter, no name
 * asked — rather than throwing: a stray value in a row (a hand fix in Studio,
 * a deploy running ahead of its migration, where the columns are `undefined`)
 * must leave the customer menu working the way it did before tables existed.
 *
 * **The service is `counter` whenever the reference is `name`**, whatever the
 * column holds: a name-mode venue has no table to bring an order to. The
 * column keeps its value so switching back to tables restores the choice.
 */
export function parseOrderSettings(venue: {
  order_reference?: string | null
  service_mode?: string | null
  first_name_mode?: string | null
}): OrderSettings {
  const reference: OrderReference =
    venue.order_reference === 'table' ? 'table' : 'name'
  const storedService: ServiceMode =
    venue.service_mode === 'table' ? 'table' : 'counter'
  const firstName: FirstNameMode =
    venue.first_name_mode === 'optional' ? 'optional' : 'none'

  return {
    reference,
    service: reference === 'table' ? storedService : 'counter',
    firstName,
  }
}

/**
 * How a table is written everywhere: « Table 12 », or « Terrasse · 12 » when it
 * carries a label.
 *
 * One function, because the same table is drawn on the QR sheet, in the
 * back-office list, in the customer's cart and tracker, and on the bar's card —
 * and a customer told « Terrasse 12 » by their phone while the counter reads
 * « Table 12 (Terrasse) » would wonder whether it is the same table.
 */
export function tableName(number: number, label: string | null): string {
  return label ? `${label} · ${number}` : `Table ${number}`
}
