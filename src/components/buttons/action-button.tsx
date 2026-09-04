import { Button } from '#/components/ui/button'
import { DESTRUCTIVE_TONE } from '#/components/buttons/tone'
import { SURFACE_HEIGHT } from '#/components/surface'
import { cn } from '#/lib/utils.ts'

import type { ComponentProps, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import type { Surface } from '#/components/surface'
import type { Tone } from '#/components/buttons/tone'

/**
 * Bouton d'action libellé : ajouter, enregistrer, annuler, se connecter.
 *
 * Porte le retour au maintien (`scale(0.97)` en 150 ms, `ease-out`) que la
 * moitié des appels oubliaient, et l'icône de tête au bon gabarit. `type` vaut
 * `button` par défaut : dans un formulaire, l'oubli d'un `type` explicite
 * transforme un bouton d'annulation en soumission.
 *
 * `tone` reprend celui d'`IconButton`, et pour la même raison : un bouton qui
 * retire quelque chose sans être l'action principale d'une confirmation se
 * colore sans s'aplatir en rouge. Les deux composants lisent la même teinte.
 */
export function ActionButton({
  icon: Icon,
  surface = 'panel',
  tone = 'default',
  className,
  children,
  ...props
}: {
  icon?: LucideIcon
  surface?: Surface
  tone?: Tone
  children: ReactNode
} & Omit<ComponentProps<typeof Button>, 'children'>) {
  return (
    <Button
      type="button"
      className={cn(
        'h-11 gap-2 transition-transform duration-150 ease-out active:scale-[0.97]',
        SURFACE_HEIGHT[surface],
        tone === 'destructive' && DESTRUCTIVE_TONE,
        className,
      )}
      {...props}
    >
      {Icon ? <Icon className="size-4" /> : null}
      {children}
    </Button>
  )
}
