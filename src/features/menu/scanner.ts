/**
 * Reading a barcode off a camera frame — and the only file that knows how.
 *
 * Two decoders sit behind one function. The browser's own `BarcodeDetector`
 * when it exists — Chrome on Android, ChromeOS, Chrome on macOS — and a
 * WebAssembly build of ZXing-C++ everywhere else, which in practice means
 * **every iPhone**: all iOS browsers are WebKit, and WebKit has never shipped
 * the Shape Detection API. Firefox and Chrome on Windows or Linux are in the
 * same case.
 *
 * The fallback is a *ponyfill of the same API*, which is what makes this file
 * short. `barcode-detector/ponyfill` exposes the constructor, the static
 * `getSupportedFormats()` and the `detect()` this module already spoke to, so
 * the two branches differ by how they are obtained and by nothing else. That
 * was the point of making `createScanner` asynchronous from the first version:
 * the swap costs an `import()` here and no change anywhere else.
 *
 * **It is loaded lazily, and only when needed.** A phone that has the native
 * detector never fetches a byte of it; a phone that doesn't pays ~430 Ko
 * (brotli) once, on this screen alone. Nothing of it reaches the customer menu.
 *
 * **The `.wasm` is served from our own origin.** `zxing-wasm` defaults to
 * fetching it from a public CDN at run time, which would put a third party
 * between a manager and their stock count — over the cellar wifi that is a
 * failure mode, and it is an outgoing request nobody asked for. Vite's `?url`
 * import hashes the file into our build and `locateFile` points there.
 *
 * What comes out is a canonical GTIN, never a raw read. The screen's two entry
 * points — the camera and the typed field — have to agree on what a code *is*,
 * and two paths that disagree there disagree in production. `barcode.ts` holds
 * that rule; this file applies it before returning.
 */

import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url'

import { tryNormalizeBarcode } from '#/features/menu/barcode'

/**
 * The symbologies a bar actually meets, and no more.
 *
 * EAN-13 covers Europe, UPC-A the American imports on a cocktail shelf, EAN-8
 * the small formats. Widening the list is not free: every extra symbology is
 * more work per frame on a phone that is already the slow part, and a decoder
 * told to look for everything finds a false positive on a printed pattern.
 *
 * **UPC-E is deliberately absent**, and the reason is `barcode.ts`, not the
 * decoder: its check digit is computed over the expanded UPC-A, so
 * `normalizeBarcode` would reject every one of them as a malformed GTIN-8 — the
 * code would be read and then silently dropped, which looks exactly like a
 * camera that does not work. Supporting it means writing the expansion first.
 */
export const SCAN_FORMATS = ['ean_13', 'ean_8', 'upc_a'] as const

type ScanFormat = (typeof SCAN_FORMATS)[number]

/** Raised when no decoder could be obtained at all. */
export class ScannerUnavailableError extends Error {}

export type Scanner = {
  /**
   * The canonical GTIN visible in this frame, or `null` — no code, an
   * unreadable one, or one whose check digit does not hold.
   */
  detect: (source: HTMLVideoElement) => Promise<string | null>
}

/**
 * Can this browser open a camera at all?
 *
 * This is now the only thing worth asking before the first render — the decoder
 * itself is always available. `mediaDevices` is undefined outside a **secure
 * context**, which is the trap of testing from a phone on `http://192.168.x.x`:
 * the API does not fail, it is simply not there.
 */
export function isCameraAvailable(): boolean {
  /* Lu à travers un type plus étroit : `lib.dom` déclare `mediaDevices`
     obligatoire, alors que c'est justement son absence qu'on teste. */
  const api: { mediaDevices?: MediaDevices } = navigator

  return typeof api.mediaDevices?.getUserMedia === 'function'
}

/**
 * Opens a decoder — the browser's if it has one, ZXing otherwise.
 *
 * The format check applies to both: a browser may expose the native
 * constructor and support none of the symbologies asked of it, in which case
 * every frame would come back empty and the screen would show a camera that
 * never reads anything. Falling through to ZXing turns that into a scanner that
 * works.
 */
export async function createScanner(): Promise<Scanner> {
  const native = await createNativeScanner()
  if (native) return native

  let BarcodeDetector: BarcodeDetectorLike

  try {
    const ponyfill = await import('barcode-detector/ponyfill')

    /*
      Pointe le binaire sur notre propre origine, et lance sa compilation sans
      l'attendre : `fireImmediately` fait démarrer le téléchargement pendant
      que la permission caméra est encore à l'écran, ce qui est le seul moment
      creux de cet écran.
    */
    void ponyfill.prepareZXingModule({
      overrides: { locateFile: () => wasmUrl },
      fireImmediately: true,
    })

    BarcodeDetector = ponyfill.BarcodeDetector
  } catch {
    throw new ScannerUnavailableError(
      'Le lecteur de code-barres n’a pas pu être chargé. Vérifiez votre connexion, ou saisissez le code à la main.',
    )
  }

  const scanner = await scannerFrom(BarcodeDetector)

  if (!scanner) {
    throw new ScannerUnavailableError(
      'Aucun format de code-barres n’est reconnu sur cet appareil. Saisissez le code à la main.',
    )
  }

  return scanner
}

async function createNativeScanner(): Promise<Scanner | null> {
  const native = (globalThis as { BarcodeDetector?: BarcodeDetectorLike })
    .BarcodeDetector

  if (!native) return null

  try {
    return await scannerFrom(native)
  } catch {
    /* Un natif présent mais défaillant n'est pas une impasse : ZXing suit. */
    return null
  }
}

/**
 * Wraps either implementation into the one shape this feature speaks.
 *
 * Returns `null` — rather than throwing — when the decoder supports none of our
 * formats, so the native branch can fall through to ZXing instead of failing.
 */
async function scannerFrom(
  Detector: BarcodeDetectorLike,
): Promise<Scanner | null> {
  const supported = await Detector.getSupportedFormats()
  const formats = SCAN_FORMATS.filter((format) => supported.includes(format))

  if (formats.length === 0) return null

  const detector = new Detector({ formats })

  return {
    async detect(source) {
      let found: Array<{ rawValue: string }>

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
  `BarcodeDetector` n'est pas dans `lib.dom` : le type est déclaré ici, au plus
  près des deux seuls appels, plutôt qu'en `declare global`. Un type global
  laisserait croire que l'API existe partout, ce qui est précisément le
  contraire de ce que ce fichier raconte — et c'est la forme structurelle, pas
  la classe native, qui compte : le ponyfill s'y conforme aussi.
*/
type BarcodeDetectorLike = {
  /*
    `formats` est typé sur nos seuls symbologies, et non sur `string`. Le
    ponyfill n'accepte qu'une énumération fermée : un `Array<string>` ici
    rendrait sa classe non assignable à ce type, alors qu'elle en est une
    implémentation parfaitement valide.
  */
  new (options?: { formats?: Array<ScanFormat> }): {
    detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>>
  }
  getSupportedFormats: () => Promise<ReadonlyArray<string>>
}
