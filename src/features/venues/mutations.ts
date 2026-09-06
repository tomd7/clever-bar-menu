import { useMutation, useQueryClient } from '@tanstack/react-query'

import { VENUES_QUERY_KEY } from '#/lib/query-keys'
import {
  archiveVenue,
  createVenue,
  purgeArchivedVenues,
  restoreVenue,
} from '#/features/venues/api'

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
