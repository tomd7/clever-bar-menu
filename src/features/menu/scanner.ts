/**
 * Reading a barcode off a camera frame — and the only file that knows how.
 *
 * The detection itself is `BarcodeDetector`, a browser API, which means the
 * feature's reach is the API's reach: **Chrome on Android**, ChromeOS and
 * Chrome on macOS. Not Safari — every browser on iOS is WebKit, and WebKit has
 * never shipped the Shape Detection API — not Firefox, and not Chrome on
 * Windows or Linux. The scan screen therefore always carries a manual field,
 * and `isScannerAvailable()` is what decides whether it is the fallback or the
 * whole screen.
 *
 * That reach is the reason this file exists as a seam rather than as three
 * lines inlined in the component. Swapping in a WebAssembly decoder — a lazy
 * `import()` of a zxing build, which is what would make the screen work on an
 * iPhone — has to be a change to `createScanner` and to nothing else. Hence the
 * **asynchronous factory**: a synchronous constructor would have to be widened
 * on the day of the swap, and widening it means touching the caller.
 *
 * What comes out is a canonical GTIN, never a raw read. The screen's two entry
 * points — the camera and the typed field — have to agree on what a code *is*,
 * and two paths that disagree there disagree in production. `barcode.ts` holds
 * that rule; this file applies it before returning.
 */

import { tryNormalizeBarcode } from '#/features/menu/barcode'

/**
 * The symbologies a bar actually meets, and no more.
 *
 * EAN-13 covers Europe, UPC-A the American imports on a cocktail shelf, EAN-8
 * the small formats. Widening the list is not free: every extra symbology is
 * more work per frame on a phone that is already the slow part, and a decoder
 * told to look for everything finds a false positive on a printed pattern.
 *
 * **UPC-E is deliberately absent.** Its check digit is computed over the
 * expanded UPC-A, so `normalizeBarcode` would reject every one of them as a
 * malformed GTIN-8 — the code would be read and then silently dropped, which
 * looks exactly like a camera that does not work. Supporting it means writing
 * the expansion in `barcode.ts` first, not adding a string here.
 */
export const SCAN_FORMATS = ['ean_13', 'ean_8', 'upc_a'] as const

/** Raised by `createScanner` when the browser cannot decode a barcode. */
export class ScannerUnavailableError extends Error {}

export type Scanner = {
  /**
   * The canonical GTIN visible in this frame, or `null` — no code, an
   * unreadable one, or one whose check digit does not hold.
   */
  detect: (source: HTMLVideoElement) => Promise<string | null>
}

/**
 * Can this browser decode a barcode at all?
 *
 * Synchronous, and therefore approximate: it answers for the constructor, not
 * for the formats, which only `getSupportedFormats()` knows and which it will
 * not wait for. That is the right trade for a first render — the screen has to
 * decide immediately whether to show a camera or a text field, and
 * `createScanner` re-checks properly a moment later.
 */
export function isScannerAvailable(): boolean {
  return nativeDetector() !== undefined
}

/**
 * Opens a decoder, or explains why it cannot.
 *
 * The format check is not ceremony: a browser may expose the constructor and
 * support none of the symbologies asked of it, in which case every frame would
 * come back empty and the screen would show a camera that never reads
 * anything. Failing here turns that into a sentence a manager can act on.
 */
export async function createScanner(): Promise<Scanner> {
  const BarcodeDetector = nativeDetector()

  if (!BarcodeDetector) {
    throw new ScannerUnavailableError(
      'Ce navigateur ne sait pas lire un code-barres. Saisissez le code à la main.',
    )
  }

  const supported = await BarcodeDetector.getSupportedFormats()
  const formats = SCAN_FORMATS.filter((format) => supported.includes(format))

  if (formats.length === 0) {
    throw new ScannerUnavailableError(
      'Ce navigateur ne reconnaît aucun format de code-barres. Saisissez le code à la main.',
    )
  }

  const detector = new BarcodeDetector({ formats })

  return {
    async detect(source) {
      let found: Array<DetectedBarcode>

      try {
        found = await detector.detect(source)
      } catch {
        /*
          Une image que le décodeur refuse — la vidéo n'a pas encore de
          dimensions, l'onglet vient de repasser au premier plan — n'est pas
          une panne : c'est une image de moins. La panne systémique, elle, est
          attrapée plus haut, à l'ouverture.
        */
        return null
      }

      for (const barcode of found) {
        const gtin = tryNormalizeBarcode(barcode.rawValue)
        if (gtin) return gtin
      }

      return null
    },
  }
}

/*
  `BarcodeDetector` n'est pas dans `lib.dom` : les types sont déclarés ici, au
  plus près du seul appel, plutôt qu'en `declare global`. Un type global
  laisserait croire que l'API existe partout, ce qui est précisément le
  contraire de ce que ce fichier raconte.
*/
type DetectedBarcode = { rawValue: string }

type BarcodeDetectorConstructor = {
  new (options?: { formats?: Array<string> }): {
    detect: (source: HTMLVideoElement) => Promise<Array<DetectedBarcode>>
  }
  getSupportedFormats: () => Promise<Array<string>>
}

function nativeDetector(): BarcodeDetectorConstructor | undefined {
  return (globalThis as { BarcodeDetector?: BarcodeDetectorConstructor })
    .BarcodeDetector
}
