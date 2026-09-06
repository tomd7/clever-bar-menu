import {
  Outlet,
  createFileRoute,
  redirect,
  useParams,
  useRouter,
} from '@tanstack/react-router'

import { BackOfficeShell } from '#/components/back-office/back-office-shell'
import { VenueNav } from '#/features/venues/components/venue-nav'
import { VenueTrashRailLink } from '#/features/venues/components/venue-trash-link'
import { supabase } from '#/lib/supabase'

/**
 * Frontière d'authentification du back-office.
 *
 * Route sans segment d'URL (`_authenticated`) : elle n'ajoute rien au chemin,
 * elle enveloppe. Toute route placée dans `src/routes/_authenticated/` hérite
 * donc de cette garde et de cette coquille visuelle.
 *
 * À garder en tête : cette garde protège l'**écran**, pas les données. La
 * barrière réelle est le RLS de Postgres, qui s'applique à chaque requête quoi
 * qu'il arrive côté navigateur. Contourner cette garde ne donne accès à rien.
 */
export const Route = createFileRoute('/_authenticated')({
  /**
   * La session Supabase est conservée dans le navigateur. Exécuter cette garde
   * pendant le rendu serveur conclurait « non connecté » à chaque requête et
   * renverrait tout le monde vers /login. `ssr: false` bascule `beforeLoad` et
   * le rendu côté client ; les routes enfants en héritent.
   */
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getSession()

    if (!data.session) {
      throw redirect({ to: '/login', search: { redirect: location.href } })
    }

    return { user: data.session.user }
  },
  component: BackOfficeLayout,
})

function BackOfficeLayout() {
  const router = useRouter()
  const { user } = Route.useRouteContext()

  /*
    `strict: false` : cette route n'a pas de `$venueSlug` à elle, elle lit
    celui de la route enfant courante — et `undefined` sur `/admin`, où aucun
    établissement n'est ouvert. C'est la route qui répond à « où sommes-nous »,
    pas la barre latérale, qui reste une fonction de ses props.
  */
  const venueSlug = useParams({
    strict: false,
    select: (params) => params.venueSlug,
  })

  async function handleSignOut() {
    await supabase.auth.signOut()
    await router.invalidate()
    await router.navigate({ to: '/login', search: {} })
  }

  return (
    <BackOfficeShell
      email={user.email}
      onSignOut={handleSignOut}
      nav={<VenueNav ownerId={user.id} activeVenueSlug={venueSlug} />}
      navFooter={<VenueTrashRailLink ownerId={user.id} />}
    >
      <Outlet />
    </BackOfficeShell>
  )
}
