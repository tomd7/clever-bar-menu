import { createFileRoute } from '@tanstack/react-router'

import { OrdersPage } from '#/features/orders/components/orders-page'

export const Route = createFileRoute(
  '/_authenticated/admin/$venueSlug/commandes',
)({
  component: OrdersRoute,
})

function OrdersRoute() {
  const { venueSlug } = Route.useParams()

  return <OrdersPage venueSlug={venueSlug} />
}
