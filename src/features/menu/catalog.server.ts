import '@tanstack/react-start/server-only'

import { eq } from 'drizzle-orm'

import { db } from '#/db/client.server'
import { drinkCatalog } from '#/db/schema'
import { displayBarcode } from '#/features/menu/barcode'
import { OFF_FIELDS, toCatalogEntry } from '#/features/menu/catalog'

import type { CatalogEntry, CatalogLookup } from '#/features/menu/catalog'

/**
 * The catalogue's only door: our table first, Open Food Facts second.
 *
 * **This is the first runtime Drizzle query in the project** — until now it
 * only ran migrations. `src/db/CLAUDE.md` warns that runtime Drizzle silently
 * sidesteps every RLS policy, and that warning is answered rather than ignored:
 * this module touches `drink_catalog` and nothing else. That table is global by
 * design, carries no `venue_id` and no `owner_id`, and therefore has no tenant
 * isolation to sidestep. **The next Drizzle query that reaches a venue-scoped
 * table has to redo that analysis — this one does not cover it.**
 */

const OFF_ENDPOINT = 'https://world.openfoodfacts.org/api/v2/product'

/**
 * Open Food Facts asks callers to identify themselves, and a free service run
 * by a non-profit is entitled to know who is calling. Their documented shape is
 * `Name/Version (contact)`.
 *
 * A constant rather than an environment variable: it is not a secret, it does
 * not vary between deployments, and one more thing to configure is one more
 * thing to get wrong. **Update it if the product is renamed.**
 *
 * It is also why this call cannot live in the browser: `User-Agent` is a
 * forbidden header for `fetch`, so a page physically cannot send one.
 */
const USER_AGENT =
  'CleverBarMenu/1.0 (https://github.com/tomd7/clever-bar-menu)'

/**
 * Two and a half seconds, and no more.
 *
 * A manager is holding a bottle in front of the lens. Past three seconds with
 * nothing on screen the scan looks broken and they scan again, which only adds
 * a request. Giving up is cheap here — the panel opens with empty fields and
 * they carry on typing.
 */
const OFF_TIMEOUT_MS = 2500

/**
 * Thirty days before asking again about a code Open Food Facts did not know.
 *
 * Their catalogue is contributed to daily, so « unknown » is only ever true on
 * a date. Thirty days is the trade: a wine list scanned every evening costs one
 * request per bottle per month, and a freshly contributed sheet shows up within
 * a service cycle.
 *
 * In practice the bound is far lower — after the first miss the manager creates
 * the product with its code, and every later scan resolves it in memory against
 * the menu. This mostly protects a venue's first few days.
 */
const MISS_TTL_MS = 30 * 24 * 60 * 60 * 1000

/**
 * Looks a canonical GTIN up, and never throws for anything Open Food Facts does.
 *
 * The only exception that escapes is our own database failing, which the caller
 * treats like `unavailable` anyway.
 */
export async function lookupCatalog(gtin: string): Promise<CatalogLookup> {
  /*
    `.at(0)` et non `const [row] =` : Drizzle type le retour comme un tableau
    d'éléments présents, si bien qu'une déstructuration donne un type non
    nullable pour une valeur qui vaut `undefined` dès que la table ne connaît
    pas ce code — c'est-à-dire au premier scan de chaque bouteille. Le garde
    ci-dessous serait alors signalé comme inutile par le linter, et le retirer
    ferait planter le cas le plus courant.
  */
  const row = (
    await db()
      .select()
      .from(drinkCatalog)
      .where(eq(drinkCatalog.gtin, gtin))
      .limit(1)
  ).at(0)

  if (row?.name) {
    return {
      status: 'found',
      entry: {
        gtin: row.gtin,
        name: row.name,
        brand: row.brand,
        quantity: row.quantity,
        photoUrl: row.photoUrl,
      },
    }
  }

  /* A remembered miss, still fresh: answered without touching the network. */
  if (row && Date.now() - row.checkedAt.getTime() < MISS_TTL_MS) {
    return { status: 'unknown' }
  }

  const outcome = await askOpenFoodFacts(gtin)

  /* An outage is not an answer, and must never be remembered as one. */
  if (outcome.status === 'unavailable') return outcome

  /*
    A failed write must not turn a good answer into a breakdown: the sheet is
    already in hand, and the next scan will simply ask again.
  */
  try {
    await remember(gtin, outcome.status === 'found' ? outcome.entry : null)
  } catch {
    /* deliberately ignored */
  }

  return outcome
}

/**
 * Asks Open Food Facts about one code.
 *
 * The code goes out **unpadded**, through `displayBarcode`: their database is
 * keyed by what is printed under the bars, and that is the form their own
 * response echoes back. They do normalise leading zeros — a padded GTIN-14
 * resolves too — but relying on that would rest on undocumented behaviour for
 * no gain.
 */
async function askOpenFoodFacts(gtin: string): Promise<CatalogLookup> {
  const url = `${OFF_ENDPOINT}/${displayBarcode(gtin)}.json?lc=fr&fields=${OFF_FIELDS}`

  let response: Response
  try {
    response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: AbortSignal.timeout(OFF_TIMEOUT_MS),
    })
  } catch {
    /* Timeout, DNS, TLS, offline host: we learned nothing. */
    return { status: 'unavailable' }
  }

  if (response.status === 404) return { status: 'unknown' }
  if (!response.ok) return { status: 'unavailable' }

  const body: unknown = await response.json().catch(() => null)

  if (typeof body !== 'object' || body === null) {
    return { status: 'unavailable' }
  }

  const { status, product } = body as { status?: unknown; product?: unknown }
  if (status === 0 || product === undefined) return { status: 'unknown' }

  /*
    Open Food Facts holds thousands of sheets reduced to a bare code. One with
    no name is not a find — offering « Add to the menu » under an empty title
    would be worse than offering nothing — so it counts as unknown, and gets
    remembered as one.
  */
  const entry = toCatalogEntry(gtin, product)
  return entry ? { status: 'found', entry } : { status: 'unknown' }
}

/**
 * Records what Open Food Facts answered, hit or miss.
 *
 * `on conflict do update` rather than a select then an insert: two phones
 * scanning the same bottle at the same moment must not race for a primary key.
 * It is also what promotes a remembered miss to a real sheet the day the
 * product finally exists over there.
 *
 * `updatedAt` is written by hand — the schema's `$onUpdate` fires on Drizzle's
 * `.update()` builder, not on the `set` of an upsert, so leaving it out would
 * make the column lie about every refreshed row.
 */
async function remember(gtin: string, entry: CatalogEntry | null) {
  const now = new Date()
  const values = {
    gtin,
    name: entry?.name ?? null,
    brand: entry?.brand ?? null,
    quantity: entry?.quantity ?? null,
    photoUrl: entry?.photoUrl ?? null,
    checkedAt: now,
  }

  await db()
    .insert(drinkCatalog)
    .values(values)
    .onConflictDoUpdate({
      target: drinkCatalog.gtin,
      set: { ...values, updatedAt: now },
    })
}
