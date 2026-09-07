import { PRODUCT_PHOTOS_BUCKET } from '#/lib/product-photos'
import { supabase } from '#/lib/supabase'

/**
 * Photos des produits : préparation, envoi et suppression.
 *
 * Le bucket `product-photos` est public en lecture — la carte est ouverte au QR
 * code, sur données mobiles, et une URL publique se met en cache dans le CDN.
 * L'écriture est restreinte par des policies sur `storage.objects` : le premier
 * segment du chemin est l'identifiant de l'établissement, et seul son
 * propriétaire peut y déposer quoi que ce soit.
 */
const BUCKET = PRODUCT_PHOTOS_BUCKET

/** Côté le plus long, en pixels, après réduction. */
const MAX_SIDE = 1200

/** Qualité d'encodage avec perte. 0,82 : la compression cesse de se voir au-delà. */
const QUALITY = 0.82

/**
 * Formats acceptés à la sortie, et leur extension.
 *
 * Doit rester aligné sur `allowed_mime_types` du bucket (migration 0004) :
 * le serveur refuse tout le reste, et l'échec surviendrait à l'envoi plutôt
 * qu'à la sélection.
 */
const EXTENSIONS: Record<string, string> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png',
}

/** Échec imputable à l'image choisie, à afficher tel quel au gérant. */
export class PhotoError extends Error {}

/**
 * Réduit une image avant l'envoi.
 *
 * Une photo prise au téléphone pèse plusieurs mégaoctets pour 4000 pixels de
 * côté, quand la carte n'en affiche que quelques centaines. Réduire dans le
 * navigateur économise l'envoi — souvent depuis le réseau mobile du bar — et le
 * stockage, sans rien ajouter au serveur.
 *
 * `imageOrientation: 'from-image'` applique la rotation EXIF. Sans elle, les
 * photos prises en tenant le téléphone de côté arrivent couchées : le capteur
 * enregistre toujours dans le même sens et note l'orientation à part, que le
 * canvas ignore par défaut.
 */
async function shrink(file: File): Promise<{ blob: Blob; extension: string }> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new PhotoError(
      "Ce fichier n'a pas pu être lu comme une image. Essayez un JPEG ou un PNG.",
    )
  }

  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)

  const context = canvas.getContext('2d')
  if (!context) {
    throw new PhotoError("L'image n'a pas pu être préparée par le navigateur.")
  }

  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  /*
    WebP d'abord, nettement plus léger à qualité égale. Un navigateur qui ne
    sait pas l'encoder ne lève pas d'erreur : il renvoie silencieusement du PNG.
    On lit donc le type réellement obtenu plutôt que celui demandé, et on
    retombe sur JPEG si ce type n'est pas accepté par le bucket.
  */
  let blob = await encode(canvas, 'image/webp')
  if (!blob || !(blob.type in EXTENSIONS)) {
    blob = await encode(canvas, 'image/jpeg')
  }

  if (!blob || !(blob.type in EXTENSIONS)) {
    throw new PhotoError("L'image n'a pas pu être convertie.")
  }

  return { blob, extension: EXTENSIONS[blob.type] }
}

function encode(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, QUALITY))
}

/**
 * Envoie la photo d'un produit et renvoie son chemin de stockage.
 *
 * Le nom de fichier est tiré au sort plutôt que dérivé de l'identifiant du
 * produit, pour deux raisons. Il n'oblige pas à connaître cet identifiant, qui
 * n'existe pas encore lors d'une création. Et surtout, remplacer une photo
 * écrit un nouveau chemin : le CDN sert les URL publiques en cache, et
 * réutiliser le même chemin continuerait de servir l'ancienne image.
 *
 * Seul le premier segment compte pour les policies — c'est lui qui rattache le
 * fichier à son établissement.
 */
export async function uploadProductPhoto(
  venueId: string,
  file: File,
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new PhotoError('Choisissez un fichier image.')
  }

  const { blob, extension } = await shrink(file)
  const path = `${venueId}/${crypto.randomUUID()}.${extension}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: blob.type,
    cacheControl: '31536000',
  })

  if (error) {
    throw new PhotoError(`L'envoi de la photo a échoué : ${error.message}`)
  }

  return path
}

/** Au-delà, c'est qu'on ne télécharge pas ce qu'on croit. */
const REMOTE_PHOTO_MAX_BYTES = 8_000_000

/**
 * Recopie une photo distante dans le bucket de l'établissement.
 *
 * Utilisée par l'écran de scan quand le gérant ajoute à sa carte une boisson
 * trouvée au catalogue : l'image vient d'Open Food Facts, et elle doit devenir
 * la sienne. La carte publique est la seule page SSR à données du projet, et
 * faire dépendre l'image d'une bouteille du CDN d'un tiers — qui peut la
 * remplacer ou la retirer — n'est pas une dépendance que le bar a choisie.
 *
 * Elle passe par `uploadProductPhoto`, donc par `shrink` : l'image arrive
 * réduite et réencodée comme n'importe quelle photo prise au téléphone. Un seul
 * chemin d'envoi, un seul format, un seul `allowed_mime_types` à tenir aligné
 * avec la migration `0004`.
 *
 * **Elle ne lève jamais** et renvoie `null` si quoi que ce soit échoue. Le
 * gérant voulait un produit, pas une photo : refuser de créer une bière parce
 * qu'un CDN a hoqueté serait le pire arbitrage possible derrière un comptoir.
 */
export async function copyRemotePhoto(
  venueId: string,
  url: string,
): Promise<string | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!response.ok) return null

    const blob = await response.blob()
    if (!blob.type.startsWith('image/')) return null
    if (blob.size > REMOTE_PHOTO_MAX_BYTES) return null

    return await uploadProductPhoto(
      venueId,
      new File([blob], 'catalogue', { type: blob.type }),
    )
  } catch {
    return null
  }
}

/**
 * Supprime une photo, sans jamais faire échouer l'appelant.
 *
 * Elle n'est appelée qu'après que la base a été mise à jour : à ce stade, plus
 * rien ne référence le fichier. Laisser remonter l'erreur ferait apparaître un
 * échec alors que l'opération demandée — supprimer le produit, remplacer sa
 * photo — a bien eu lieu. Le pire cas est un fichier orphelin dans le bucket,
 * invisible et sans effet.
 */
export async function removeProductPhoto(path: string): Promise<void> {
  await supabase.storage.from(BUCKET).remove([path])
}

/** URL publique d'une photo, telle qu'un client la charge depuis la carte. */
export function productPhotoUrl(path: string): string {
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}
