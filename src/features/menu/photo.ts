import {
  removeVenueImage,
  uploadVenueImage,
  venueImageUrl,
} from '#/lib/venue-images'

import type { ShrinkOptions } from '#/lib/venue-images'

/**
 * Product photos: what sets them apart from a venue's other images.
 *
 * The mechanics — shrinking in the browser, random file names, the bucket and
 * its policies — live in `lib/venue-images.ts`, shared with the logo since
 * `features/venues` needed them and may not import from here. What stays is
 * what a photo asks for: its 1200px side, and a JPEG fallback, since a photo
 * has no transparency worth keeping.
 */
const PRODUCT_PHOTO: ShrinkOptions = { maxSide: 1200, fallback: 'jpeg' }

/** Uploads a product's photo and returns its storage path. */
export function uploadProductPhoto(
  venueId: string,
  file: File,
): Promise<string> {
  return uploadVenueImage(venueId, file, PRODUCT_PHOTO)
}

/** Removes a photo nothing references any more; never fails the caller. */
export function removeProductPhoto(path: string): Promise<void> {
  return removeVenueImage(path)
}

/** Public URL of a photo, as a customer loads it from the carte. */
export function productPhotoUrl(path: string): string {
  return venueImageUrl(path)
}
