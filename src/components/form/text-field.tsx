import { useId } from 'react'

import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { SURFACE_HEIGHT } from '#/components/surface'
import { cn } from '#/lib/utils.ts'

import type { ComponentProps, ReactNode } from 'react'
import type { Surface } from '#/components/surface'

/**
 * Champ de saisie libellé.
 *
 * `useId` supprime la seule partie de ce motif qui pouvait casser en silence :
 * l'association `htmlFor` / `id`. Elle était écrite à la main à chaque champ,
 * et une faute de frappe ne produit ni erreur ni type invalide — juste un champ
 * sans nom pour un lecteur d'écran, et un libellé qui ne donne plus le focus au
 * clic.
 *
 * `hiddenLabel` garde ce câblage là où la mise en page ne peut pas montrer de
 * libellé — le renommage d'une catégorie, qui remplace un titre. Le champ garde
 * un nom accessible ; il n'en avait aucun avant.
 *
 * `className` habille le **bloc** (c'est lui qu'on place dans une grille ou
 * qu'on fait grandir avec `flex-1`), `inputClassName` la saisie elle-même.
 */
export function TextField({
  label,
  hint,
  hiddenLabel = false,
  surface = 'panel',
  className,
  inputClassName,
  ...props
}: {
  label: ReactNode
  hint?: ReactNode
  hiddenLabel?: boolean
  surface?: Surface
  inputClassName?: string
} & Omit<ComponentProps<typeof Input>, 'id'>) {
  const id = useId()

  return (
    <div className={cn(hiddenLabel ? 'space-y-0' : 'space-y-2', className)}>
      <Label htmlFor={id} className={cn(hiddenLabel && 'sr-only')}>
        {label}
      </Label>
      <Input
        id={id}
        className={cn('h-11', SURFACE_HEIGHT[surface], inputClassName)}
        {...props}
      />
      {hint ? <p className="mt-2 text-xs text-ink-soft">{hint}</p> : null}
    </div>
  )
}
