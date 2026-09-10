import { supabase } from '#/lib/supabase'

/**
 * A venue's images in Storage — product photos and the logo, in one bucket,
 * one folder per venue.
 *
 * Every path is `<venue_id>/<random>.<ext>`. That first segment is what the
 * `storage.objects` policies join back to `venues.owner_id` (migration `0004`),
 * and it is also what makes a venue a folder: something that can be emptied in
 * one go.
 *
 * **Flat, never a sub-folder.** `<venue_id>/logo/<random>.png` would pass the
 * policies just as well, but `removeVenueImages` lists one level only: a
 * sub-folder comes back from `list()` as an entry with no file behind it, its
 * removal deletes nothing, and the purge raises — the bin could never be
 * emptied again.
 *
 * The bucket is still named `product-photos`, which is all it held when `0004`
 * created it. Renaming a bucket means copying every object, for a name nobody
 * outside this module reads.
 *
 * This module is in `lib/` because two features use it: `features/menu` puts
 * and removes product photos one at a time, `features/venues` does the same
 * for the logo and wipes the whole folder when a venue is destroyed. Copying
 * the bucket name into both would let a rename fix only one of them.
 */
export const VENUE_IMAGES_BUCKET = 'product-photos'

/** Page size when listing a folder — the most one round trip usefully returns. */
const PAGE_SIZE = 100

/** Lossy encoding quality. Past 0.82 the compression stops being visible. */
const QUALITY = 0.82

/**
 * Output formats, and their extension.
 *
 * Must stay aligned with the bucket's `allowed_mime_types` (migration `0004`):
 * the server refuses anything else — SVG included, which is what keeps a
 * script-carrying image off our storage domain — and the failure would surface
 * at upload rather than at selection.
 */
const EXTENSIONS: Record<string, string> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png',
}

/** A failure caused by the chosen image, worded to be shown to the manager as is. */
export class ImageError extends Error {}

export type ShrinkOptions = {
  /** Longest side, in pixels, after reduction. */
  maxSide: number
  /**
   * What to encode when the browser can't produce WebP.
   *
   * `'jpeg'` suits a photo. `'keep-alpha'` is for a logo: PNG as soon as one
   * pixel is transparent, JPEG otherwise — JPEG has no alpha channel, and a
   * transparent logo would come back on a black rectangle.
   */
  fallback: 'jpeg' | 'keep-alpha'
}

/**
 * Shrinks an image before upload.
 *
 * A photo taken on a phone weighs several megabytes for 4000 pixels a side,
 * where the carte shows a few hundred. Shrinking in the browser saves the
 * upload — often over the bar's mobile network — and the storage, without
 * adding anything to the server.
 *
 * `imageOrientation: 'from-image'` applies the EXIF rotation. Without it,
 * photos taken holding the phone sideways arrive lying down: the sensor always
 * records the same way round and notes the orientation apart, which a canvas
 * ignores by default.
 */
export async function shrinkImage(
  file: File,
  { maxSide, fallback }: ShrinkOptions,
): Promise<{ blob: Blob; extension: string }> {
  if (!file.type.startsWith('image/')) {
    throw new ImageError('Choisissez un fichier image.')
  }

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new ImageError(
      "Ce fichier n'a pas pu être lu comme une image. Essayez un JPEG ou un PNG.",
    )
  }

  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)

  const context = canvas.getContext('2d')
  if (!context) {
    bitmap.close()
    throw new ImageError("L'image n'a pas pu être préparée par le navigateur.")
  }

  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  /*
    WebP first, clearly lighter at equal quality. A browser that can't encode it
    raises nothing: it silently hands back a PNG. So the type actually obtained
    is compared to WebP itself — not to the accepted list, which PNG is on. That
    looser test let a browser without a WebP encoder upload every product photo
    as a PNG several times the size.
  */
  let blob = await encode(canvas, 'image/webp')
  if (blob?.type !== 'image/webp') {
    const type =
      fallback === 'keep-alpha' && hasTransparency(context, canvas)
        ? 'image/png'
        : 'image/jpeg'
    blob = await encode(canvas, type)
  }

  if (!blob || !(blob.type in EXTENSIONS)) {
    throw new ImageError("L'image n'a pas pu être convertie.")
  }

  return { blob, extension: EXTENSIONS[blob.type] }
}

/** Whether any pixel of the drawn image is less than fully opaque. */
function hasTransparency(
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
): boolean {
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height)
  for (let index = 3; index < data.length; index += 4) {
    if (data[index] < 255) return true
  }
  return false
}

function encode(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, QUALITY))
}

/**
 * Shrinks and uploads one of a venue's images, and returns its storage path.
 *
 * The file name is drawn at random rather than derived from what it
 * illustrates, for two reasons. It needs no identifier — a product being
 * created has none yet. And above all, replacing an image writes a new path:
 * the CDN serves public URLs from cache, and reusing a path would keep serving
 * the old image.
 */
export async function uploadVenueImage(
  venueId: string,
  file: File,
  options: ShrinkOptions,
): Promise<string> {
  const { blob, extension } = await shrinkImage(file, options)
  const path = `${venueId}/${crypto.randomUUID()}.${extension}`

  const { error } = await supabase.storage
    .from(VENUE_IMAGES_BUCKET)
    .upload(path, blob, { contentType: blob.type, cacheControl: '31536000' })

  if (error) {
    /*
      Storage answers in English, and this message is shown as is. The one
      failure worth naming is the policy refusal — the venue isn't the signed-in
      account's, or the session went stale — which Storage words as a
      row-level security violation, a phrase no manager should have to read.
      Found in the browser: a non-owner saving a logo got exactly that.
    */
    throw new ImageError(
      /row-level security/i.test(error.message)
        ? 'L’envoi de l’image a été refusé : cet établissement n’est pas rattaché à votre compte.'
        : 'L’envoi de l’image a échoué. Vérifiez la connexion et réessayez.',
    )
  }

  return path
}

/**
 * Removes one image, without ever failing the caller.
 *
 * It is only called once the database has been written: at that point nothing
 * references the file any more. Letting the error surface would report a
 * failure when the operation asked for — replacing a photo, removing a logo —
 * did happen. The worst case is an orphan file in the bucket, invisible and
 * harmless.
 */
export async function removeVenueImage(path: string): Promise<void> {
  await supabase.storage.from(VENUE_IMAGES_BUCKET).remove([path])
}

/** Public URL of an image, as a customer's phone loads it from the carte. */
export function venueImageUrl(path: string): string {
  return supabase.storage.from(VENUE_IMAGES_BUCKET).getPublicUrl(path).data
    .publicUrl
}

/**
 * Wipes every image of a venue — product photos and logo alike.
 *
 * **Call it before deleting the `venues` row, never after.** The write
 * policies on `storage.objects` find the owner by joining the path's first
 * segment to `public.venues`: once the venue is gone the join finds nothing and
 * the files become indestructible — while still served by the CDN, the bucket
 * being public for reads. It is the reverse of the order followed for a
 * product, whose row goes first because its venue stays.
 *
 * The error surfaces, unlike `removeVenueImage`: here it stops the purge before
 * the row is destroyed, the venue stays in the bin and the manager can retry. A
 * silent failure would leave images online with no way left to remove them.
 *
 * The paging has no `offset`: each page is removed before the next is listed,
 * so the next page is always the first. An `offset` walking a shrinking list
 * would skip every other file.
 */
export async function removeVenueImages(venueId: string): Promise<void> {
  const bucket = supabase.storage.from(VENUE_IMAGES_BUCKET)

  for (;;) {
    const { data, error } = await bucket.list(venueId, { limit: PAGE_SIZE })

    if (error) {
      throw new Error(`Les images n'ont pas pu être listées : ${error.message}`)
    }
    if (data.length === 0) return

    const { data: removed, error: removeError } = await bucket.remove(
      data.map((file) => `${venueId}/${file.name}`),
    )

    if (removeError) {
      throw new Error(
        `Les images n'ont pas pu être supprimées : ${removeError.message}`,
      )
    }

    /*
      A policy refusal raises no error: the removal simply returns the — empty —
      list of what it removed. Without this guard, a page that resists would
      spin the loop forever.
    */
    if (removed.length === 0) {
      throw new Error("Les images n'ont pas pu être supprimées.")
    }

    if (data.length < PAGE_SIZE) return
  }
}
