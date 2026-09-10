import { createFileRoute } from '@tanstack/react-router'

import { VenueSettings } from '#/features/venues/components/venue-settings'

export const Route = createFileRoute(
  '/_authenticated/admin/$venueSlug/reglages',
)({
  component: VenueSettingsRoute,
})

function VenueSettingsRoute() {
  const { venueSlug } = Route.useParams()

  return <VenueSettings venueSlug={venueSlug} />
}
