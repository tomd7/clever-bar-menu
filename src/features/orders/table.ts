/**
 * The customer's table, for the visit.
 *
 * A table-mode venue needs to know where the order goes. The table comes from
 * the QR code (`?table=<public id>`, adopted by `OrderBar` once it resolves),
 * or from the picker in the cart sheet when the code was the venue-wide one or
 * points at a table that no longer exists. Either way it is kept here, so the
 * second round ordered from the same phone does not ask again.
 *
 * **`sessionStorage`, not `localStorage`** — the cart's store. A cart left in
 * a tab is still what the customer meant to order; a table is only true for
 * the visit. Next week the same phone sits somewhere else, and a table
 * remembered from last time would send the order across the room without a
 * word. A fresh scan opens a fresh tab anyway, carrying its own table.
 *
 * Same module store and same reasons as `cart.ts`: the page is server-rendered,
 * so nothing may read storage during render, and the store fills after mount.
 * The snapshot is a string or `null` — a primitive, so there is no stable
 * reference to keep.
 */

import { useCallback, useEffect, useSyncExternalStore } from 'react'

const chosen = new Map<string, string | null>()
const listeners = new Map<string, Set<() => void>>()

function storageKey(venueSlug: string): string {
  return `clever-bar-menu:table:${venueSlug}`
}

export function getChosenTable(venueSlug: string): string | null {
  return chosen.get(venueSlug) ?? null
}

function subscribe(venueSlug: string, listener: () => void): () => void {
  const bucket = listeners.get(venueSlug) ?? new Set()
  listeners.set(venueSlug, bucket)
  bucket.add(listener)

  return () => {
    bucket.delete(listener)
  }
}

function notify(venueSlug: string): void {
  for (const listener of listeners.get(venueSlug) ?? []) listener()
}

/**
 * Remembers the table the customer is at — a table's public id, or `null` to
 * forget it.
 *
 * Nothing is validated here beyond the shape: whether the id belongs to the
 * venue is the table list's question on screen, and `place_order`'s in SQL.
 */
export function chooseTable(venueSlug: string, publicId: string | null): void {
  if (getChosenTable(venueSlug) === publicId && chosen.has(venueSlug)) return
  chosen.set(venueSlug, publicId)

  try {
    if (publicId === null) sessionStorage.removeItem(storageKey(venueSlug))
    else sessionStorage.setItem(storageKey(venueSlug), publicId)
  } catch {
    /* Without storage the table lasts as long as the page: still enough to send. */
  }

  notify(venueSlug)
}

/** À appeler après le montage, jamais pendant le rendu. */
function hydrateChosenTable(venueSlug: string): void {
  if (chosen.has(venueSlug)) return

  let stored: string | null = null
  try {
    const raw = sessionStorage.getItem(storageKey(venueSlug))
    /* Sanitised, not trusted: anything but a short token is dropped. */
    stored = raw && /^[A-Za-z0-9_-]{1,64}$/.test(raw) ? raw : null
  } catch {
    stored = null
  }

  chosen.set(venueSlug, stored)
  notify(venueSlug)
}

/**
 * The public id of the table chosen for this venue, or `null`.
 *
 * `null` on the server and on the first client render, like the cart — the
 * sheet that reads it is closed at that point anyway.
 */
export function useChosenTable(venueSlug: string): string | null {
  const subscribeToVenue = useCallback(
    (listener: () => void) => subscribe(venueSlug, listener),
    [venueSlug],
  )

  const value = useSyncExternalStore(
    subscribeToVenue,
    () => getChosenTable(venueSlug),
    () => null,
  )

  useEffect(() => {
    hydrateChosenTable(venueSlug)
  }, [venueSlug])

  return value
}
