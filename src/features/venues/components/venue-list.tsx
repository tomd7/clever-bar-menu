import { useQuery } from '@tanstack/react-query'
import { Store } from 'lucide-react'

import { EmptyState } from '#/components/empty-state'
import { VenueCard } from '#/features/venues/components/venue-card'
import { venuesQueryOptions } from '#/features/venues/api'

/** Liste des établissements du gérant, avec ses états de chargement et de vide. */
export function VenueList({ ownerId }: { ownerId: string }) {
  const venuesQuery = useQuery(venuesQueryOptions(ownerId))

  if (venuesQuery.isPending) {
    return <p className="text-sm text-ink-soft">Chargement…</p>
  }

  if (venuesQuery.isError) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {venuesQuery.error.message}
      </p>
    )
  }

  if (venuesQuery.data.length === 0) {
    return (
      <EmptyState icon={Store} title="Aucun établissement pour l'instant">
        Créez le premier ci-dessus : vous pourrez ensuite y composer vos
        catégories et vos produits.
      </EmptyState>
    )
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {venuesQuery.data.map((venue, position) => (
        <VenueCard key={venue.id} venue={venue} position={position} />
      ))}
    </ul>
  )
}
