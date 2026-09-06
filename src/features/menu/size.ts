/**
 * The serving format of a product — « 25cl », « 50cl », « au fût », « pichet ».
 *
 * Free text, kept deliberately dumb: there is nothing to parse and nothing to
 * validate. A centilitre count, a draught, a carafe and a 4cl measure are the
 * same kind of information for this menu — a qualifier the customer reads next
 * to the name — and the moment the field starts parsing « 50cl » into a number
 * it owes an answer for « au fût », which has none.
 *
 * What lives here is therefore only what the whole feature must agree on: the
 * suggestions the form offers, and the one rule that turns a typed field into a
 * column (blank means `null`, never an empty string). The *display* of a size
 * sits in `components/product-size.tsx`, which `features/orders` shares — a
 * ticket names its lines the way the menu does.
 */

/** Blank input is `null` — « no format stated » — never an empty string. */
export function parseOptionalSize(input: string): string | null {
  return input.trim() || null
}

/**
 * What the form offers in one tap, in the order a bar reads them.
 *
 * Suggestions, not an enumeration: the column takes anything, and this list
 * only exists so that the nine formats out of ten that are the same everywhere
 * cost one tap instead of six characters typed behind a counter. Keep it short
 * — a rail long enough to need reading is slower than the keyboard it saves.
 *
 * Draught and glass close the list on purpose: they are the two formats that
 * are *not* a volume, and having them here is what says the field takes words
 * as readily as centilitres.
 */
export const SIZE_SUGGESTIONS = [
  '25cl',
  '33cl',
  '50cl',
  '75cl',
  '1L',
  'au fût',
  'au verre',
] as const

/** Longest size the form accepts — a format, not a description. */
export const SIZE_MAX_LENGTH = 24
