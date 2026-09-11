import { uploadVenueImage } from '#/lib/venue-images'

import type { ShrinkOptions } from '#/lib/venue-images'

/**
 * A venue's logo: how it is shrunk, and whether it needs a plate on the board.
 *
 * Storage, file names and the bucket are `lib/venue-images.ts`, shared with the
 * product photos. Two things differ for a logo, and both are here.
 */

/**
 * The carte draws a logo 64px tall at most and about 14rem wide, so 600px
 * covers a wide wordmark on a high-density screen. Transparency is the point of
 * most logo files, hence `keep-alpha`: without WebP, the fallback is PNG
 * whenever a pixel is transparent.
 */
const LOGO: ShrinkOptions = { maxSide: 600, fallback: 'keep-alpha' }

/** Uploads a venue's logo and returns its storage path. */
export function uploadVenueLogo(venueId: string, file: File): Promise<string> {
  return uploadVenueImage(venueId, file, LOGO)
}

/** Side of the thumbnail the guess reads: enough to tell ink from ground, cheap on every pick. */
const SAMPLE_SIDE = 48

/** Under this share of transparent pixels, the image carries its own background. */
const TRANSPARENT_SHARE = 0.05

/**
 * Mean relative luminance under which the ink counts as dark. Every board sits
 * at 20% lightness or less (`styles/menu-theme.css`), and ink this dark is lost
 * on it.
 */
const DARK_INK = 0.18

/**
 * Guesses whether a logo needs the light plate to be read on the board.
 *
 * The board is dark in every theme and at every hour, and the commonest logo
 * file is dark ink on a transparent background — which, laid bare on the board,
 * simply vanishes. Two readings decide:
 *
 * - an image that is essentially opaque carries its own background, and needs
 *   nothing behind it;
 * - a transparent one is judged by the mean luminance of its visible pixels,
 *   weighted by their opacity so antialiased edges don't count as ink.
 *
 * A guess, not a verdict: a two-tone logo averages out, and the manager sees
 * the result in the preview with a switch next to it. An image the browser
 * can't decode returns `false` — the upload refuses it with a proper message
 * anyway.
 */
export async function guessLogoPlate(file: File): Promise<boolean> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return false
  }

  const canvas = document.createElement('canvas')
  canvas.width = SAMPLE_SIDE
  canvas.height = SAMPLE_SIDE

  const context = canvas.getContext('2d')
  if (!context) {
    bitmap.close()
    return false
  }

  context.drawImage(bitmap, 0, 0, SAMPLE_SIDE, SAMPLE_SIDE)
  bitmap.close()

  const { data } = context.getImageData(0, 0, SAMPLE_SIDE, SAMPLE_SIDE)

  let transparent = 0
  let weight = 0
  let luminance = 0

  for (let index = 0; index < data.length; index += 4) {
    const alpha = data[index + 3] / 255
    if (alpha < 0.5) transparent += 1
    if (alpha === 0) continue

    luminance +=
      relativeLuminance(data[index], data[index + 1], data[index + 2]) * alpha
    weight += alpha
  }

  if (transparent / (data.length / 4) < TRANSPARENT_SHARE) return false
  return weight > 0 && luminance / weight < DARK_INK
}

/** WCAG relative luminance of an sRGB colour, channels in 0–255. */
function relativeLuminance(red: number, green: number, blue: number): number {
  const linear = (channel: number) => {
    const value = channel / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  }

  return 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue)
}
