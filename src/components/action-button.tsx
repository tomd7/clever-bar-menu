import { Button } from '#/components/ui/button'
import { cn } from '#/lib/utils.ts'

import type { ComponentProps, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

/**
 * Hauteur au repos selon la surface qui porte le bouton.
 *
 * Sur mobile, tous font 44px — la cible tactile ne se négocie pas. C'est à
 * partir de `lg` que la densité se différencie : un formulaire de page respire,
 * une ligne de produit se resserre, un popover plus encore. Nommer la surface
 * plutôt que la hauteur évite d'avoir à se rappeler laquelle des trois valeurs
 * s'applique où.
 */
const SURFACE_HEIGHT = {
  page: 'lg:h-10',
  panel: 'lg:h-9',
  popover: 'lg:h-8',
}

/**
 * Bouton d'action libellé : ajouter, enregistrer, annuler, se connecter.
 *
 * Porte le retour au maintien (`scale(0.97)` en 150 ms, `ease-out`) que la
 * moitié des appels oubliaient, et l'icône de tête au bon gabarit. `type` vaut
 * `button` par défaut : dans un formulaire, l'oubli d'un `type` explicite
 * transforme un bouton d'annulation en soumission.
 */
export function ActionButton({
  icon: Icon,
  surface = 'panel',
  className,
  children,
  ...props
}: {
  icon?: LucideIcon
  surface?: keyof typeof SURFACE_HEIGHT
  children: ReactNode
} & Omit<ComponentProps<typeof Button>, 'children'>) {
  return (
    <Button
      type="button"
      className={cn(
        'h-11 gap-2 transition-transform duration-150 ease-out active:scale-[0.97]',
        SURFACE_HEIGHT[surface],
        className,
      )}
      {...props}
    >
      {Icon ? <Icon className="size-4" /> : null}
      {children}
    </Button>
  )
}
