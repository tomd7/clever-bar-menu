import { createFileRoute } from '@tanstack/react-router'

import { VenueSettings } from '#/features/venues/components/venue-settings'
import { useOpenOrdersCount } from '#/features/orders/components/open-orders-count'

export const Route = createFileRoute(
  '/_authenticated/admin/$venueSlug/reglages',
)({
  component: VenueSettingsRoute,
})

function VenueSettingsRoute() {
  const { venueSlug } = Route.useParams()

  /*
    Where the two features meet: the settings screen belongs to
    `features/venues`, counting open orders to `features/orders`, and neither
    may import the other. The count only feeds the confirmation asked before
    switching the order reference or the service mode — the same assembly as
    `ordersBadge` in `_authenticated.tsx`, on the orders queue's own cache.
  */
  const openOrdersCount = useOpenOrdersCount(venueSlug)

  return (
    <VenueSettings venueSlug={venueSlug} openOrdersCount={openOrdersCount} />
  )
}
