import { Pencil } from 'lucide-react'

import { IconButton } from '#/components/buttons/icon-button'

import type { ComponentProps } from 'react'

/**
 * Bouton d'édition, réduit à son crayon.
 *
 * `label` reste obligatoire : l'icône est la même partout, ce qu'elle modifie
 * ne l'est pas — « Renommer la catégorie » et « Modifier le produit » sont
 * deux actions différentes pour qui navigue au lecteur d'écran.
 */
export function EditButton(
  props: Omit<ComponentProps<typeof IconButton>, 'icon' | 'tone'>,
) {
  return <IconButton icon={Pencil} {...props} />
}
