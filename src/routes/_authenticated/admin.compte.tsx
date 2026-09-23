import { createFileRoute } from '@tanstack/react-router'

import { AccountPage } from '#/features/auth/components/account-page'

/**
 * The manager's account. A static segment, so it outranks `/admin/$venueSlug`:
 * a venue whose slug were `compte` would be created and then unreachable from
 * the back office. That is why `compte` is a reserved slug — in
 * `RESERVED_SLUGS` (`features/venues/api.ts`) and in the
 * `venues_slug_not_reserved` check (`src/db/schema.ts`).
 */
export const Route = createFileRoute('/_authenticated/admin/compte')({
  component: AccountRoute,
})

function AccountRoute() {
  const { user } = Route.useRouteContext()

  return <AccountPage email={user.email} />
}
