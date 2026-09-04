import { useMutation, useQueryClient } from '@tanstack/react-query'

import {
  VENUES_QUERY_KEY,
  archiveVenue,
  createVenue,
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
