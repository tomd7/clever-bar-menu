import { useMutation, useQueryClient } from '@tanstack/react-query'

import { MENU_QUERY_KEY, VENUES_QUERY_KEY } from '#/lib/query-keys'
import { removeVenueImage } from '#/lib/venue-images'
import { uploadVenueLogo } from '#/features/venues/logo'
import {
  archiveVenue,
  createVenue,
  purgeArchivedVenues,
  restoreVenue,
  updateVenue,
} from '#/features/venues/api'

import type { VenueSettings } from '#/features/venues/api'

/**
 * Création d'un établissement, suivie du rechargement de la liste.
 *
 * L'invalidation vise `['venues']` plutôt que `['venues', ownerId]` : le
 * formulaire n'a pas à connaître l'identifiant du gérant pour savoir quoi
 * rafraîchir, et une seule session est ouverte à la fois.
 */
export function useCreateVenue() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createVenue,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: VENUES_QUERY_KEY }),
  })
}

/**
 * Archivage et restauration.
 *
 * Les deux invalident la même clé que la création : la liste des actifs et
 * celle de la corbeille sortent d'une seule requête, un établissement qui
 * change d'état les traverse donc toutes les deux.
 */
export function useArchiveVenue() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: archiveVenue,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: VENUES_QUERY_KEY }),
  })
}

export function useRestoreVenue() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: restoreVenue,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: VENUES_QUERY_KEY }),
  })
}

/**
 * Vidage de la corbeille.
 *
 * Même clé que le reste : la liste, la corbeille et le lien de la colonne
 * sortent tous de `venuesQueryOptions`, et le compte tombé à zéro fait
 * disparaître les deux accès à la corbeille par la même invalidation.
 *
 * Rien d'optimiste ici, contrairement aux compteurs de stock : la suppression
 * définitive passe par le stockage avant la base, elle peut prendre une
 * seconde, et retirer les lignes d'avance ferait croire à un succès qu'une
 * erreur de stockage devrait ensuite reprendre.
 */
export function usePurgeVenueTrash() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: purgeArchivedVenues,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: VENUES_QUERY_KEY }),
  })
}

/**
 * Réglages d'un établissement — nom, description, thème, logo.
 *
 * **Deux clés invalidées, et la seconde n'est pas de trop.** `menuQueryOptions`
 * renvoie `{ venue, categories }`, et `MenuEditor` affiche `venue.name` dans son
 * en-tête : sans `MENU_QUERY_KEY`, renommer un établissement laisserait le titre
 * de l'éditeur sur l'ancien nom jusqu'au prochain rechargement. C'est le
 * symétrique exact de ce que fait `features/orders`, qui invalide la carte parce
 * qu'accepter une commande décompte le stock.
 *
 * `PUBLIC_MENU_QUERY_KEY` reste chez `features/menu` et n'est pas visée : c'est
 * le cache du client sur son téléphone, qui par construction n'a aucun lecteur
 * dans cet onglet. La faire descendre dans `query-keys.ts` contredirait la règle
 * que ce fichier énonce lui-même.
 *
 * **The logo follows the order a product's photo does** (`useSaveProduct`):
 * upload first, then the row; if the row refuses, the file just uploaded goes;
 * and the previous logo is removed only once the row no longer points at it.
 * A failed save must leave the venue exactly as it was, logo included. The
 * resolved path is returned so the form can drop the picked file and stop
 * being dirty — without it, a second click would upload the same logo again.
 */
export function useUpdateVenue() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      venueId,
      logoFile,
      previousLogoPath,
      ...settings
    }: {
      venueId: string
      /** Logo picked a moment ago, not yet uploaded. */
      logoFile: File | null
      /** Logo path before the edit, to know which file becomes useless. */
      previousLogoPath: string | null
    } & VenueSettings): Promise<{ logoPath: string | null }> => {
      const uploadedPath = logoFile
        ? await uploadVenueLogo(venueId, logoFile)
        : null
      const logoPath = uploadedPath ?? settings.logoPath

      try {
        await updateVenue(venueId, { ...settings, logoPath })
      } catch (cause) {
        if (uploadedPath) await removeVenueImage(uploadedPath)
        throw cause
      }

      if (previousLogoPath && previousLogoPath !== logoPath) {
        await removeVenueImage(previousLogoPath)
      }

      return { logoPath }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: VENUES_QUERY_KEY })
      await queryClient.invalidateQueries({ queryKey: MENU_QUERY_KEY })
    },
  })
}
