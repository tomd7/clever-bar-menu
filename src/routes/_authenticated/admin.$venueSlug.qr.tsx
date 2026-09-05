import { createFileRoute } from '@tanstack/react-router'

import { VenueQr } from '#/features/venues/components/venue-qr'

export const Route = createFileRoute('/_authenticated/admin/$venueSlug/qr')({
  component: VenueQrRoute,
})

function VenueQrRoute() {
  const { venueSlug } = Route.useParams()

  return <VenueQr venueSlug={venueSlug} />
}
