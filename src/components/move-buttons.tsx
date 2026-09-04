import { ChevronDown, ChevronUp } from 'lucide-react'

import { Button } from '#/components/ui/button'

/**
 * Paire de flèches pour déplacer un élément dans sa liste.
 *
 * Les deux libellés sont passés explicitement plutôt que dérivés d'un nom
 * d'entité : « Monter la catégorie » et « Monter le produit » n'ont pas le même
 * article, et une règle de genre en français coûterait plus cher que deux
 * chaînes.
 *
 * 44px de côté sur mobile — la cible tactile minimale ; plus dense à partir de
 * lg, où le pointeur est précis.
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
  onMove: (direction: -1 | 1) => Promise<void>
}) {
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={upLabel}
        disabled={isFirst}
        onClick={() => onMove(-1)}
        className="size-11 lg:size-9"
      >
        <ChevronUp className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={downLabel}
        disabled={isLast}
        onClick={() => onMove(1)}
        className="size-11 lg:size-9"
      >
        <ChevronDown className="size-4" />
      </Button>
    </>
  )
}
