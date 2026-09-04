import { LogOut, Store } from 'lucide-react'

import { ActionButton } from '#/components/buttons/action-button'
import { NavLink } from '#/components/nav-link'

import type { ReactNode } from 'react'

/**
 * Coquille visuelle du back-office.
 *
 * Mobile : barre supérieure. À partir de lg : colonne latérale persistante.
 * Le back-office n'est pas une colonne téléphone étirée — un gérant le
 * consulte aussi bien derrière le comptoir que sur un écran large.
 *
 * Purement présentationnel : la session et la déconnexion restent à la route
 * qui les possède, ce qui rend cette coquille lisible et déplaçable telle
 * quelle.
 */
export function BackOfficeShell({
  email,
  onSignOut,
  children,
}: {
  email: string | undefined
  onSignOut: () => void
  children: ReactNode
}) {
  return (
    <div className="min-h-dvh lg:flex">
      <header className="panel no-print sticky top-0 z-10 lg:static lg:z-auto lg:h-dvh lg:w-64 lg:shrink-0 lg:border-y-0 lg:border-l-0">
        <div className="flex items-center justify-between gap-3 px-4 py-3 lg:h-full lg:flex-col lg:items-stretch lg:px-4 lg:py-6">
          <div className="lg:flex-1">
            <p className="island-kicker">Back-office</p>
            <p className="display-title text-lg leading-tight">
              Clever Bar Menu
            </p>

            <nav className="mt-6 hidden lg:block">
              <NavLink
                to="/admin"
                icon={Store}
                className="flex rounded-lg px-2 font-medium"
                activeProps={{ className: 'is-active' }}
              >
                Établissements
              </NavLink>
            </nav>
          </div>

          <div className="flex items-center gap-2 lg:flex-col lg:items-stretch lg:gap-3">
            <p className="hidden truncate text-xs text-ink-soft lg:block">
              {email}
            </p>
            <ActionButton
              icon={LogOut}
              variant="ghost"
              surface="page"
              onClick={onSignOut}
              className="lg:justify-start"
            >
              <span className="hidden sm:inline">Déconnexion</span>
            </ActionButton>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 lg:px-10 lg:py-10">{children}</main>
    </div>
  )
}
