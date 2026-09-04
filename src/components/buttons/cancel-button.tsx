import { ActionButton } from '#/components/buttons/action-button'

import type { ComponentProps, ReactNode } from 'react'

/**
 * Bouton d'abandon, toujours en retrait de l'action qu'il accompagne.
 *
 * `variant="ghost"` est imposé et non paramétrable : une annulation qui pèse
 * autant visuellement que l'action principale rend le choix ambigu au moment
 * précis où il doit être évident.
 */
export function CancelButton({
  children = 'Annuler',
  ...props
}: {
  children?: ReactNode
} & Omit<ComponentProps<typeof ActionButton>, 'children' | 'variant'>) {
  return (
    <ActionButton variant="ghost" {...props}>
      {children}
    </ActionButton>
  )
}
