import { createFileRoute } from '@tanstack/react-router'

import { VenueTables } from '#/features/venues/components/venue-tables'

/*
  A static child of `$venueSlug`, not of `/admin`: it needs no reserved slug
  (see `reglages` in `features/venues/CLAUDE.md`).
*/
export const Route = createFileRoute('/_authenticated/admin/$venueSlug/tables')(
  {
    component: VenueTablesRoute,
  },
)

function VenueTablesRoute() {
  const { venueSlug } = Route.useParams()

  return <VenueTables venueSlug={venueSlug} />
}
