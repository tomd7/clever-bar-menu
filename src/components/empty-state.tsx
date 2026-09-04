import { cn } from '#/lib/utils.ts'

import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

/**
 * Panneau affiché quand une liste est vide.
 *
 * Un vide n'est pas une erreur : il indique quoi faire ensuite plutôt que de
 * laisser une zone blanche que le gérant prendrait pour un chargement raté.
 */
export function EmptyState({
  icon: Icon,
  title,
  children,
  className,
}: {
  icon?: LucideIcon
  title: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('panel rounded-2xl px-6 py-12 text-center', className)}>
      {Icon ? <Icon className="mx-auto size-8 text-brass-deep" /> : null}
      <p className={cn('display-title text-lg', Icon && 'mt-3')}>{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-ink-soft">{children}</p>
    </div>
  )
}
