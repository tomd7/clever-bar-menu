import { Button } from '#/components/ui/button'
import { SURFACE_HEIGHT } from '#/components/surface'
import { cn } from '#/lib/utils.ts'

import type { ComponentProps, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import type { Surface } from '#/components/surface'

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
  surface?: Surface
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
