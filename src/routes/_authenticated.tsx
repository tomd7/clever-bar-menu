import {
  Link,
  Outlet,
  createFileRoute,
  redirect,
  useRouter,
} from '@tanstack/react-router'
import { LogOut, Store } from 'lucide-react'

import { Button } from '#/components/ui/button'
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
    <div className="min-h-dvh lg:flex">
      {/*
        Mobile : barre supérieure. À partir de lg : colonne latérale persistante.
        Le back-office n'est pas une colonne téléphone étirée — un gérant le
        consulte aussi bien derrière le comptoir que sur un écran large.
      */}
      <header className="island-shell sticky top-0 z-10 lg:static lg:z-auto lg:h-dvh lg:w-64 lg:shrink-0 lg:border-y-0 lg:border-l-0">
        <div className="flex items-center justify-between gap-3 px-4 py-3 lg:h-full lg:flex-col lg:items-stretch lg:px-4 lg:py-6">
          <div className="lg:flex-1">
            <p className="island-kicker">Back-office</p>
            <p className="display-title text-lg leading-tight">
              Clever Bar Menu
            </p>

            <nav className="mt-6 hidden lg:block">
              <Link
                to="/admin"
                className="nav-link flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-medium"
                activeProps={{ className: 'is-active' }}
              >
                <Store className="size-4" />
                Établissements
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-2 lg:flex-col lg:items-stretch lg:gap-3">
            <p className="hidden truncate text-xs text-[var(--sea-ink-soft)] lg:block">
              {user.email}
            </p>
            <Button
              variant="ghost"
              onClick={handleSignOut}
              className="h-11 gap-2 transition-transform duration-150 ease-out active:scale-[0.97] lg:h-10 lg:justify-start"
            >
              <LogOut className="size-4" />
              <span className="hidden sm:inline">Déconnexion</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 lg:px-10 lg:py-10">
        <Outlet />
      </main>
    </div>
  )
}
