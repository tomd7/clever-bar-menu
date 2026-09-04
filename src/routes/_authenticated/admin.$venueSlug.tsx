import { createFileRoute } from '@tanstack/react-router'

import { MenuEditor } from '#/features/menu/components/menu-editor'

export const Route = createFileRoute('/_authenticated/admin/$venueSlug')({
  component: MenuEditorRoute,
})

function MenuEditorRoute() {
  const { venueSlug } = Route.useParams()

  return <MenuEditor venueSlug={venueSlug} />
}
