import { createFileRoute } from '@tanstack/react-router'

import { ScanPage } from '#/features/menu/components/scan-page'

export const Route = createFileRoute(
  '/_authenticated/admin/$venueSlug/stock/scan',
)({
  component: ScanRoute,
})

function ScanRoute() {
  const { venueSlug } = Route.useParams()

  return <ScanPage venueSlug={venueSlug} />
}
