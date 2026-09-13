import { LogOut } from 'lucide-react'

import { ActionButton } from '#/components/buttons/action-button'
import { env } from '#/env'

import type { ReactNode } from 'react'

/**
 * Coquille visuelle du back-office.
 *
 * Mobile : barre supérieure. À partir de lg : colonne latérale persistante.
 * Le back-office n'est pas une colonne téléphone étirée — un gérant le
 * consulte aussi bien derrière le comptoir que sur un écran large.
 *
 * Purement présentationnel : la session, la déconnexion et le contenu de la
 * navigation restent à la route qui les possède. `nav` arrive donc en prop —
 * cette coquille vit sous `src/components/`, où rien ne doit importer de
 * `#/features/`, et lister les établissements est une affaire du domaine
 * « venues ».
 *
 * La navigation ne s'affiche qu'à partir de `lg` : sur téléphone la barre
 * supérieure n'a pas la place d'une arborescence, et les écrans y gardent
 * leurs propres liens de retour.
 *
 * `navFooter` est la zone basse de cette colonne, collée au bloc identité et
 * déconnexion : ce qui relève de l'outil plutôt que du travail — la corbeille
 * aujourd'hui. Une prop distincte de `nav` et non le bas de celle-ci, parce
 * que ces deux zones sont séparées par toute la hauteur de la colonne, et
 * qu'un seul `nav` étiré jusqu'en bas rendrait la coquille responsable de
 * l'écart entre ses éléments.
 */
export function BackOfficeShell({
  email,
  nav,
  navFooter,
  onSignOut,
  children,
}: {
  email: string | undefined
  nav?: ReactNode
  navFooter?: ReactNode
  onSignOut: () => void
  children: ReactNode
}) {
  return (
    <div className="min-h-dvh lg:flex">
      {/*
        `sticky top-0` aux deux largeurs : barre supérieure sur téléphone,
        colonne épinglée à partir de `lg`. La hauteur explicite `lg:h-dvh` est
        ce qui rend l'épinglage possible — un élément de flex s'étire par défaut
        à la hauteur de son conteneur, et une colonne aussi haute que la page
        n'a nulle part où coller. `overflow-y-auto` fait défiler la colonne
        elle-même le jour où la liste des établissements dépassera l'écran,
        plutôt que d'en couper le bas.
      */}
      <header className="panel no-print sticky top-0 z-10 lg:h-dvh lg:w-64 lg:shrink-0 lg:overflow-y-auto lg:border-y-0 lg:border-l-0">
        {/*
          `min-h-full` et non `h-full` : la déconnexion doit être poussée en bas
          de la colonne quand elle est courte, mais une hauteur fixe ferait
          déborder le contenu hors de sa boîte dès que la liste s'allonge, et
          c'est cette boîte que `overflow-y-auto` fait défiler.
        */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 lg:min-h-full lg:flex-col lg:items-stretch lg:px-4 lg:py-6">
          <div className="lg:flex-1">
            <p className="island-kicker">Back-office</p>
            {/*
              The beta pill sits beside the title, not inside it: inside, it
              would inherit `.display-title`'s wide stretch and negative
              tracking, made for headings, not an 11px label. A filled pill on
              `--bottle`, never a bordered one — on this app the bordered pill
              is `StockBadge`, and it means something is wrong.
            */}
            <div className="flex items-center gap-2">
              <p className="display-title text-lg leading-tight">
                {env.VITE_APP_TITLE}
              </p>
              {env.VITE_APP_BETA ? (
                <span className="rounded-full bg-bottle px-2 py-0.5 text-[0.6875rem] leading-none font-semibold text-on-bottle">
                  Bêta
                </span>
              ) : null}
            </div>

            <div className="mt-6 hidden lg:block">{nav}</div>
          </div>

          <div className="flex items-center gap-2 lg:flex-col lg:items-stretch lg:gap-3">
            {/*
              Comme `nav`, réservé à `lg` : la barre supérieure du téléphone
              n'a pas la place, et les écrans y gardent leurs propres liens.
              Le filet qui sépare cette zone du reste appartient à ce qu'on y
              pose — vide, elle ne doit laisser aucune trace.
            */}
            {navFooter ? (
              <div className="hidden lg:block">{navFooter}</div>
            ) : null}

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
