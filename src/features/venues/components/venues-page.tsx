import { useQueryClient } from '@tanstack/react-query'

import { AddVenueForm } from '#/features/venues/components/add-venue-form'
import { VenueList } from '#/features/venues/components/venue-list'
import { venuesQueryOptions } from '#/features/venues/api'

/** Écran d'accueil du back-office : les établissements du gérant connecté. */
export function VenuesPage({ ownerId }: { ownerId: string }) {
  const queryClient = useQueryClient()

  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: venuesQueryOptions(ownerId).queryKey,
    })

  return (
    <div className="page-wrap px-0">
      <header>
        <p className="island-kicker">Vos établissements</p>
        <h1 className="display-title mt-1 text-2xl leading-tight sm:text-3xl">
          Établissements
        </h1>
        <p className="mt-2 max-w-prose text-sm text-ink-soft">
          Chaque établissement porte sa propre carte et sa propre adresse
          publique.
        </p>
      </header>

      <AddVenueForm onDone={refresh} />

      <section className="mt-6">
        <VenueList ownerId={ownerId} />
      </section>
    </div>
  )
}
