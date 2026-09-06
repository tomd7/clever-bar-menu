/**
 * The manufacturer's barcode of a product, and the one thing it must agree on:
 * what « the same bottle » means.
 *
 * A barcode looks like a string and behaves like one everywhere except where it
 * matters. The same Coca-Cola carries a 12-digit UPC-A in the United States and
 * a 13-digit EAN-13 in Europe, and those two strings differ by a leading zero
 * while naming the same object. Stored raw, one bottle pairs twice — once from
 * the camera, once from a manual entry — and neither pairing resolves reliably
 * afterwards. Nothing in the UI would show the mistake: the scanner would just
 * credit the wrong beer.
 *
 * So every code entering the application — read by the camera or typed by hand
 * — passes through `normalizeBarcode` first, and what reaches the database is
 * always the same shape: **a 14-digit GTIN**. That is GS1's own canonical form,
 * it holds GTIN-8, GTIN-12 and GTIN-13 without loss, and it leaves room for the
 * ITF-14 case code the day a delivery is scanned by the crate rather than by
 * the bottle.
 *
 * The check digit is verified here rather than trusted. On a camera read it
 * costs nothing — the scanner already validated it. On a typed entry it is the
 * whole point: a mistyped digit fails under the manager's thumb instead of
 * pairing a code that no bottle in the world carries.
 *
 * Sibling of `price.ts`, `size.ts` and `stock.ts`: what the manager types on one
 * side, what the column holds on the other, and the conversion in one file. The
 * `check` constraint in `src/db/schema.ts` restates the resulting shape, in the
 * same way `products_stock_quantity_non_negative` restates `parseOptionalStock`
 * — a backstop, never the validation itself.
 *
 * **Known gap: UPC-E.** The compressed 8-digit form found on small packages is
 * deliberately absent from `SCAN_FORMATS` (`scanner.ts`). Its check digit is
 * computed over its *expanded* UPC-A, so treating it as a GTIN-8 would reject
 * every one of them — a silent « nothing happens » in front of the camera.
 * Supporting it means writing the expansion, not widening the format list.
 */

/** Canonical length of a stored barcode. GS1's GTIN-14, zero-padded. */
export const BARCODE_LENGTH = 14

/** Input error, meant to be displayed as-is. */
export class BarcodeFormatError extends Error {}

/**
 * Brings a barcode to its canonical form, or explains why it cannot.
 *
 * Separators are dropped first: a code read off a delivery note is copied with
 * spaces or hyphens as often as not, and `\s` in JavaScript covers the
 * non-breaking spaces a spreadsheet paste leaves behind.
 *
 * Lengths are then restricted to the four GTIN sizes. Padding anything shorter
 * would accept a four-digit typo as a valid product code, and there is no
 * recovering from a pairing made on one.
 */
export function normalizeBarcode(input: string): string {
  const cleaned = input.replace(/[\s-]/g, '')

  if (!cleaned) {
    throw new BarcodeFormatError('Indiquez un code-barres.')
  }

  if (!/^\d+$/.test(cleaned)) {
    throw new BarcodeFormatError(
      'Code-barres invalide. Un code-barres ne contient que des chiffres.',
    )
  }

  if (![8, 12, 13, 14].includes(cleaned.length)) {
    throw new BarcodeFormatError(
      'Code-barres invalide. Il doit compter 8, 12, 13 ou 14 chiffres.',
    )
  }

  const gtin = cleaned.padStart(BARCODE_LENGTH, '0')

  if (!hasValidCheckDigit(gtin)) {
    throw new BarcodeFormatError(
      'Code-barres invalide : le chiffre de contrôle ne correspond pas. Vérifiez la saisie.',
    )
  }

  return gtin
}

/**
 * Same conversion, silent on failure.
 *
 * For the detection loop, which reads several frames a second and has nothing
 * to say about the ones that decode to nothing usable. The throwing variant is
 * for the manual field, where a rejection is an answer the manager needs.
 */
export function tryNormalizeBarcode(input: string): string | null {
  try {
    return normalizeBarcode(input)
  } catch {
    return null
  }
}

/**
 * Renders a stored code the way it is printed on the product.
 *
 * The padding is an internal convention, not something to show back: a manager
 * checking a pairing against a bottle expects the thirteen digits under the
 * bars, not ours. Only the padding we added comes off — a code that genuinely
 * starts with a zero keeps it, since the four GTIN lengths are what the trim
 * stops at.
 */
export function displayBarcode(barcode: string): string {
  for (const length of [8, 12, 13]) {
    if (barcode.length > length && /^0+$/.test(barcode.slice(0, -length))) {
      return barcode.slice(-length)
    }
  }

  return barcode
}

/**
 * The GS1 check digit: weights of 3 and 1 alternating from the left of a
 * zero-padded GTIN-14, the total completed to the next multiple of ten.
 *
 * Written on the padded form rather than per barcode length, which is what
 * makes one function answer for GTIN-8, 12, 13 and 14 alike: leading zeros
 * contribute nothing to the sum, so padding cannot change the result.
 */
function hasValidCheckDigit(gtin: string): boolean {
  let sum = 0

  for (let index = 0; index < BARCODE_LENGTH - 1; index += 1) {
    sum += Number(gtin[index]) * (index % 2 === 0 ? 3 : 1)
  }

  return (10 - (sum % 10)) % 10 === Number(gtin[BARCODE_LENGTH - 1])
}
