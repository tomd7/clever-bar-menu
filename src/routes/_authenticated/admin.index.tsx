import { createFileRoute } from '@tanstack/react-router'

import { VenuesPage } from '#/features/venues/components/venues-page'

export const Route = createFileRoute('/_authenticated/admin/')({
  component: VenuesRoute,
})

function VenuesRoute() {
  const { user } = Route.useRouteContext()

  return <VenuesPage ownerId={user.id} />
}
