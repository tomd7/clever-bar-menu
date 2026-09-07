/**
 * The shared drink catalogue: what a barcode names, before any venue has an
 * opinion about it.
 *
 * A GTIN identifies a trade item — brand, recipe, net content, packaging — and
 * that identity is stable: the same 33 cl Coca-Cola carries the same code this
 * year and in three years. So the fact sheet behind a code is worth fetching
 * once and keeping for every bar, rather than making each manager retype what
 * the one down the street already typed.
 *
 * The source is **Open Food Facts**, and this file holds the one thing that
 * must not be spread around: how its answer becomes a fact sheet. The network
 * call and the cache live in `catalog-api.ts`; what a field means lives here.
 *
 * Nothing in this module talks to the network or the database, which is what
 * lets the scan screen import it without dragging the server in.
 */

/** A drink the catalogue knows about, ready to prefill a product form. */
export type CatalogEntry = {
  /** Canonical zero-padded GTIN-14, as `normalizeBarcode` produces it. */
  gtin: string
  name: string
  brand: string | null
  quantity: string | null
  photoUrl: string | null
}

/**
 * What the scan screen learns when it asks about a code.
 *
 * `unknown` and `unavailable` are kept apart on purpose. The first is an
 * answer — Open Food Facts was asked and has no such product — and it is worth
 * remembering. The second is the absence of an answer, and remembering it would
 * turn a four-second outage into a month of silence for that code.
 */
export type CatalogLookup =
  | { status: 'found'; entry: CatalogEntry }
  | { status: 'unknown' }
  | { status: 'unavailable' }

/**
 * The Open Food Facts fields worth asking for, as the API's `fields` parameter.
 *
 * Narrowed deliberately: the full document for a mass-market drink runs to tens
 * of kilobytes of nutrition facts, ingredient analysis and packaging data, none
 * of which a bar menu has any use for.
 */
export const OFF_FIELDS = [
  'product_name',
  'product_name_fr',
  'brands',
  'quantity',
  'image_front_url',
].join(',')

/** The shape `toCatalogEntry` reads. Everything is optional — it's user data. */
type OpenFoodFactsProduct = {
  product_name?: unknown
  product_name_fr?: unknown
  brands?: unknown
  quantity?: unknown
  image_front_url?: unknown
}

/**
 * Reads a string field, or `null` if it is absent, not a string, or blank.
 *
 * Open Food Facts is crowd-sourced, and an empty string is its usual way of
 * saying « nobody filled this in ». Left as-is, one would prefill a product
 * form with a name made of spaces.
 */
function text(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

/**
 * Turns an Open Food Facts product into a fact sheet, or `null` when it carries
 * nothing worth showing.
 *
 * The name is what makes a sheet usable, so its absence rejects the whole
 * thing: a photo and a net content with no name would prefill a form the
 * manager has to fill in anyway, while suggesting the catalogue knew something.
 * The scan screen then treats it exactly like an unknown code.
 *
 * French first, because the managers and the bottles are French, and Open Food
 * Facts stores `product_name` in whichever language the contributor used.
 *
 * `brands` is copied verbatim rather than split on its commas. The field is a
 * free-form list whose order means nothing — Coca-Cola's begins with
 * « COCA-COLA SERVICES SA/NV », a legal entity, not the name on the bottle. No
 * rule extracts the commercial brand reliably, and none needs to: `products`
 * has no brand column, and this only helps a manager recognise the bottle in
 * their hand.
 *
 * `quantity` is copied verbatim too, for the reason `size.ts` gives — a serving
 * format is free text, never a parsed quantity. Open Food Facts writes it in
 * millilitres and a bar reads it in centilitres, so the form offers it as a
 * suggestion the manager corrects in one tap, not as a value to convert here.
 */
export function toCatalogEntry(
  gtin: string,
  product: unknown,
): CatalogEntry | null {
  if (typeof product !== 'object' || product === null) return null

  const fields = product as OpenFoodFactsProduct
  const name = text(fields.product_name_fr) ?? text(fields.product_name)

  if (!name) return null

  return {
    gtin,
    name,
    brand: text(fields.brands),
    quantity: text(fields.quantity),
    photoUrl: text(fields.image_front_url),
  }
}

/**
 * What a photo copied from the catalogue must be credited to, stored in
 * `products.photo_credit`.
 *
 * Open Food Facts photographs are CC-BY-SA. Copying one onto a venue's public
 * menu republishes it, and attribution is due where the work is published — on
 * `/m/$venueSlug`, not only in the back office.
 */
export const CATALOG_PHOTO_CREDIT = 'Open Food Facts'
