import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'

import { ErrorNote } from '#/components/error-note'
import { VenueQr } from '#/features/venues/components/venue-qr'
import { venueBySlugQueryOptions } from '#/features/venues/api'

export const Route = createFileRoute('/_authenticated/admin/$venueSlug/qr')({
  component: VenueQrRoute,
})

function VenueQrRoute() {
  const { venueSlug } = Route.useParams()
  const venueQuery = useQuery(venueBySlugQueryOptions(venueSlug))

  if (venueQuery.isPending) {
    return <p className="text-sm text-ink-soft">Chargement…</p>
  }

  if (venueQuery.isError) {
    return <ErrorNote>{venueQuery.error.message}</ErrorNote>
  }

  /*
    L'origine est lue au rendu et non stockée : la route hérite de
    `ssr: false` de `_authenticated`, donc ce composant ne s'exécute que dans
    le navigateur, où `window` existe toujours.
  */
  return <VenueQr venue={venueQuery.data} origin={window.location.origin} />
}
