/**
 * What an order is called by — the words on the bar's card, in the cancel
 * confirmation and in the customer's tracker.
 *
 * A name-mode order is called by its first name. A table order is called by
 * its table (« Table 12 », « Terrasse · 12 »), and carries the first name too
 * when the venue asked for one and the customer gave it. Both come from the
 * copies on the order row, never from the table as it is now: a table
 * renumbered after the order was placed must not rename the order.
 */

import { tableName } from '#/lib/order-settings'

/** The three copies an order carries, in the tracker's camelCase. */
export type OrderReferenceFields = {
  customerName: string | null
  tableNumber: number | null
  tableLabel: string | null
}

/**
 * The order's heading, and the first name that may follow it.
 *
 * `typeof … === 'number'` rather than `!== null`: a row read before the
 * migration ran has no `table_number` at all, and `undefined` must read as
 * « no table », not as « Table undefined ».
 */
export function orderReference(order: OrderReferenceFields): {
  title: string
  name: string | null
} {
  if (typeof order.tableNumber === 'number') {
    return {
      title: tableName(order.tableNumber, order.tableLabel),
      name: order.customerName,
    }
  }

  /*
    `orders_reference_present` guarantees a name here. The fallback only
    exists so a row written from outside the application cannot render an
    empty heading on the bar's screen.
  */
  return { title: order.customerName ?? 'Sans nom', name: null }
}

/** The same, on one line: « Table 12 — Camille », « Table 12 », « Camille ». */
export function orderReferenceText(order: OrderReferenceFields): string {
  const { title, name } = orderReference(order)
  return name ? `${title} — ${name}` : title
}
