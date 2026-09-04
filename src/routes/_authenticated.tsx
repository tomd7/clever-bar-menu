import {
  Outlet,
  createFileRoute,
  redirect,
  useRouter,
} from '@tanstack/react-router'

import { BackOfficeShell } from '#/components/back-office/back-office-shell'
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

  async function handleSignOut() {
    await supabase.auth.signOut()
    await router.invalidate()
    await router.navigate({ to: '/login', search: {} })
  }

  return (
    <BackOfficeShell email={user.email} onSignOut={handleSignOut}>
      <Outlet />
    </BackOfficeShell>
  )
}
