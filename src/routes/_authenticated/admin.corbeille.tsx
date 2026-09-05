import { createFileRoute } from '@tanstack/react-router'

import { VenueTrash } from '#/features/venues/components/venue-trash'

/**
 * Segment statique, donc prioritaire sur `/admin/$venueSlug` : un établissement
 * dont le slug vaudrait `corbeille` deviendrait inatteignable. `createVenue`
 * refuse ce slug pour cette raison.
 */
export const Route = createFileRoute('/_authenticated/admin/corbeille')({
  component: VenueTrashRoute,
})

function VenueTrashRoute() {
  const { user } = Route.useRouteContext()

  return <VenueTrash ownerId={user.id} />
}
