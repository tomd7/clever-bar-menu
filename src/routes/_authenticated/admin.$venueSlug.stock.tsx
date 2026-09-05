import { createFileRoute } from '@tanstack/react-router'

import { StockPage } from '#/features/menu/components/stock-page'

export const Route = createFileRoute('/_authenticated/admin/$venueSlug/stock')({
  component: StockRoute,
})

function StockRoute() {
  const { venueSlug } = Route.useParams()

  return <StockPage venueSlug={venueSlug} />
}
