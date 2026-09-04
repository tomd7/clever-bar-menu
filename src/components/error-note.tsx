import { cn } from '#/lib/utils.ts'

import type { ReactNode } from 'react'

/**
 * Message d'erreur des formulaires.
 *
 * Le même bloc sert à l'écran de connexion, à la liste des établissements et à
 * l'éditeur de carte : trois copies du même balisage avaient déjà commencé à
 * diverger par leur marge. Seule celle-ci se règle de l'extérieur, via
 * `className` — `tailwind-merge` remplace alors la valeur par défaut au lieu de
 * l'empiler.
 */
export function ErrorNote({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <p
      role="alert"
      className={cn(
        'animate-in fade-in-0 slide-in-from-top-1 mt-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive duration-200 ease-out',
        className,
      )}
    >
      {children}
    </p>
  )
}
