import { Plus } from 'lucide-react'

import { ActionButton } from '#/components/buttons/action-button'

import type { ComponentProps, ReactNode } from 'react'

/**
 * Bouton d'ajout : une catégorie, un produit, un établissement.
 *
 * `pending` fait les deux choses que les appels faisaient à la main, et qu'il
 * était possible de ne faire qu'à moitié : remplacer le libellé et désactiver
 * le bouton. Un envoi en cours qui reste cliquable crée le doublon.
 *
 * Les deux libellés ont une valeur par défaut : « Ajouter » au repos, « Ajout… »
 * pendant l'envoi. On ne passe `children` que là où l'ajout a besoin d'être
 * qualifié (« Ajouter un produit », au milieu d'une catégorie qui en contient
 * déjà), et `pendingLabel` que pour la création d'établissement.
 */
export function AddButton({
  pending = false,
  pendingLabel = 'Ajout…',
  disabled,
  children = 'Ajouter',
  ...props
}: {
  pending?: boolean
  pendingLabel?: string
  children?: ReactNode
} & Omit<ComponentProps<typeof ActionButton>, 'icon' | 'children'>) {
  return (
    <ActionButton icon={Plus} disabled={disabled || pending} {...props}>
      {pending ? pendingLabel : children}
    </ActionButton>
  )
}
