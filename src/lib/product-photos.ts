import { supabase } from '#/lib/supabase'

/**
 * Le bucket des photos de produits, et ce que sa disposition permet.
 *
 * Le chemin d'un fichier commence par l'identifiant de l'établissement
 * (`<venue_id>/<aléa>.<ext>`) : c'est ce premier segment que les policies de
 * `storage.objects` rejoignent à `venues.owner_id` (migration 0004), et c'est
 * aussi ce qui fait d'un établissement un dossier, donc quelque chose qui se
 * vide d'un bloc.
 *
 * Ce module est dans `lib/` parce que deux domaines le touchent : `features/menu`
 * y dépose et y supprime les photos une par une, `features/venues` y efface le
 * dossier entier quand un établissement est détruit. Recopier le nom du bucket
 * dans les deux aurait suffi à ce qu'un renommage n'en corrige qu'un.
 */
export const PRODUCT_PHOTOS_BUCKET = 'product-photos'

/** Taille d'une page de listing — le maximum utile en un aller-retour. */
const PAGE_SIZE = 100

/**
 * Efface toutes les photos d'un établissement.
 *
 * **À appeler avant de supprimer la ligne `venues`, jamais après.** Les policies
 * d'écriture sur `storage.objects` retrouvent le propriétaire en joignant le
 * premier segment du chemin à `public.venues` : l'établissement disparu, la
 * jointure ne trouve plus rien et les fichiers deviennent indestructibles — tout
 * en restant servis par le CDN, le bucket étant public en lecture. C'est
 * l'inverse de l'ordre suivi pour un produit, où la ligne part d'abord parce que
 * son établissement, lui, reste.
 *
 * L'erreur remonte, contrairement à `removeProductPhoto` : ici elle interrompt
 * la purge avant que la ligne ne soit détruite, l'établissement reste à la
 * corbeille et le gérant peut réessayer. Un échec silencieux, lui, laisserait
 * des photos en ligne sans plus aucun moyen de les retirer.
 *
 * La pagination n'a pas d'`offset` : chaque page est supprimée avant la
 * suivante, donc la page suivante est toujours la première. Un `offset` qui
 * avance sur une liste qui rétrécit sauterait une photo sur deux.
 */
export async function removeVenuePhotos(venueId: string): Promise<void> {
  const bucket = supabase.storage.from(PRODUCT_PHOTOS_BUCKET)

  for (;;) {
    const { data, error } = await bucket.list(venueId, { limit: PAGE_SIZE })

    if (error) {
      throw new Error(`Les photos n'ont pas pu être listées : ${error.message}`)
    }
    if (data.length === 0) return

    const { data: removed, error: removeError } = await bucket.remove(
      data.map((file) => `${venueId}/${file.name}`),
    )

    if (removeError) {
      throw new Error(
        `Les photos n'ont pas pu être supprimées : ${removeError.message}`,
      )
    }

    /*
      Un refus de policy ne lève pas d'erreur : la suppression renvoie
      simplement la liste — vide — de ce qu'elle a effacé. Sans ce garde-fou,
      une page qui résiste ferait tourner la boucle indéfiniment.
    */
    if (removed.length === 0) {
      throw new Error("Les photos n'ont pas pu être supprimées.")
    }

    if (data.length < PAGE_SIZE) return
  }
}
