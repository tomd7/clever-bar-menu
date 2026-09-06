import { Dialog } from 'radix-ui'
import { X } from 'lucide-react'

import { IconButton } from '#/components/buttons/icon-button'

import type { ReactNode } from 'react'

/**
 * Une feuille qui monte du bas de l'écran.
 *
 * Bâtie sur `Dialog` de Radix, déjà présent via le paquet `radix-ui` qui sert
 * au popover et au switch : elle hérite donc du piège à focus, de la fermeture
 * à Échap, du verrou de défilement et du portail — quatre choses qu'une `div`
 * en `position: fixed` n'a pas et qu'on ne remarque qu'une fois cassées.
 *
 * Elle vit dans `features/orders` et non dans `components/ui/` : un seul
 * domaine s'en sert, et `ui/` est réservé à ce que la CLI shadcn régénère. Le
 * jour où un deuxième écran en veut une, elle descendra.
 *
 * ## Le mouvement
 *
 * Elle monte depuis le bord bas — celui d'où le doigt vient — et redescend par
 * le même chemin : c'est ce qui rend le geste de fermeture évident sans qu'on
 * l'explique. `translateY(100%)` plutôt qu'une valeur en pixels, pour que la
 * course soit exactement la hauteur de la feuille, quelle qu'elle soit.
 *
 * La sortie est plus courte que l'entrée (180 ms contre 260) : à l'ouverture on
 * regarde arriver quelque chose, à la fermeture on a déjà décidé et l'attente
 * ne sert plus à rien.
 *
 * `--ease-out` et non l'`ease-out` du navigateur, qui est trop mou pour qu'un
 * démarrage se remarque. Le bloc `prefers-reduced-motion` de `motion.css`
 * neutralise l'ensemble.
 */
export function BottomSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  /** Sous-titre visible, et description accessible de la feuille. */
  description?: ReactNode
  children: ReactNode
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          /*
            Un voile sombre plutôt qu'un flou : le flou coûte cher sur un
            téléphone d'entrée de gamme, et c'est précisément l'appareil qui
            ouvre cette feuille.
          */
          className="fixed inset-0 z-40 bg-black/45 duration-200 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
        />

        <Dialog.Content
          /*
            `max-h` et non `h` : une feuille de deux lignes ne doit pas occuper
            les trois quarts de l'écran. Elle prend la place de son contenu et
            s'arrête là.

            `max-w-(--menu-column)` : la même largeur que la carte, et centrée
            sur elle. Sans cette borne, la feuille s'étalait sur toute la
            fenêtre d'un écran large pendant que la carte, elle, restait au
            milieu dans sa colonne — deux objets censés être le même s'en
            trouvaient désolidarisés, et la ligne « nom … quantité » se lisait à
            un mètre de distance. Le téléphone, lui, ne voit pas la différence :
            il est déjà plus étroit que la valeur de base.

            Reading the shared token rather than repeating a width is what keeps
            the sheet aligned with the card once the column widens at `md`.

            Le rembourrage du bas ajoute `env(safe-area-inset-bottom)` : sur un
            iPhone, la barre d'accueil mange les derniers pixels, et c'est
            justement là qu'on a mis le bouton d'envoi.
          */
          className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[85dvh] w-full max-w-(--menu-column) flex-col rounded-t-3xl border-x border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] shadow-[var(--shadow-2)] duration-[260ms] ease-(--ease-out) outline-none data-[state=closed]:duration-[180ms] data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom"
        >
          <header className="flex items-start justify-between gap-4 px-5 pt-5 sm:px-6">
            <div className="min-w-0">
              <Dialog.Title className="display-title text-xl leading-tight">
                {title}
              </Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-1 text-sm text-ink-soft">
                  {description}
                </Dialog.Description>
              ) : (
                /*
                  Radix avertit en console si aucune description n'est fournie.
                  Le titre suffit quand la feuille n'a rien à ajouter — on le
                  déclare donc explicitement plutôt que de laisser un
                  avertissement traîner dans les journaux de tout le monde.
                */
                <Dialog.Description className="sr-only">
                  {title}
                </Dialog.Description>
              )}
            </div>

            <Dialog.Close asChild>
              <IconButton
                icon={X}
                label="Fermer"
                className="-mt-1 -mr-2 shrink-0"
              />
            </Dialog.Close>
          </header>

          {/*
            Le défilement est *interne* à la feuille : le fond ne bouge pas
            derrière, et le bouton d'envoi reste atteignable quand le panier
            fait vingt lignes.
          */}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 sm:px-6">
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
