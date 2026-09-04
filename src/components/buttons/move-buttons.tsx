import { ChevronDown, ChevronUp } from 'lucide-react'

import { IconButton } from '#/components/buttons/icon-button'

/**
 * Paire de flèches pour déplacer un élément dans sa liste.
 *
 * Les deux libellés sont passés explicitement plutôt que dérivés d'un nom
 * d'entité : « Monter la catégorie » et « Monter le produit » n'ont pas le même
 * article, et une règle de genre en français coûterait plus cher que deux
 * chaînes.
 */
export function MoveButtons({
  upLabel,
  downLabel,
  isFirst,
  isLast,
  onMove,
}: {
  upLabel: string
  downLabel: string
  isFirst: boolean
  isLast: boolean
  onMove: (direction: -1 | 1) => void
}) {
  return (
    <>
      <IconButton
        icon={ChevronUp}
        label={upLabel}
        disabled={isFirst}
        onClick={() => onMove(-1)}
      />
      <IconButton
        icon={ChevronDown}
        label={downLabel}
        disabled={isLast}
        onClick={() => onMove(1)}
      />
    </>
  )
}
