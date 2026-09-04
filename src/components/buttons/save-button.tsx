import { Save } from 'lucide-react'

import { ActionButton } from '#/components/buttons/action-button'

import type { ComponentProps, ReactNode } from 'react'

/**
 * Bouton d'enregistrement d'un formulaire.
 *
 * Les deux libellés sont dans le composant, pas aux appels : « Enregistrer »
 * puis « Enregistrement… » partout, y compris là où le second manquait. Un
 * formulaire qui ne dit pas qu'il travaille se fait soumettre deux fois.
 *
 * `type="submit"` par défaut — c'est la nature même de ce bouton.
 */
export function SaveButton({
  pending = false,
  disabled,
  children = 'Enregistrer',
  ...props
}: {
  pending?: boolean
  children?: ReactNode
} & Omit<ComponentProps<typeof ActionButton>, 'children'>) {
  return (
    <ActionButton
      icon={Save}
      type="submit"
      disabled={disabled || pending}
      {...props}
    >
      {pending ? 'Enregistrement…' : children}
    </ActionButton>
  )
}
