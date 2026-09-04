import { useMutation, useQueryClient } from '@tanstack/react-query'

import { VENUES_QUERY_KEY, createVenue } from '#/features/venues/api'

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
