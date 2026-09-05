import { Check, Copy, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { IconButton } from '#/components/buttons/icon-button'
import { cn } from '#/lib/utils.ts'

import type { ComponentProps } from 'react'

/**
 * Copie une valeur dans le presse-papier, et le dit.
 *
 * Un bouton de copie sans retour est un bouton mort : rien ne bouge à l'écran,
 * et le presse-papier n'est visible nulle part. La confirmation *est* la
 * fonctionnalité, d'où sa place ici plutôt qu'à chaque appel — deux écrans qui
 * la réécriraient chacun de leur côté n'attendraient pas la même durée et
 * n'annonceraient pas la même chose.
 *
 * Trois états parce que la copie peut échouer : `navigator.clipboard` n'existe
 * pas hors contexte sécurisé, et l'utilisateur peut refuser la permission. Un
 * échec silencieux laisserait croire à un bouton en panne.
 */

/** Deux secondes : le temps de voir la coche, pas celui de la commenter. */
const FEEDBACK_MS = 2000

type Outcome = 'idle' | 'copied' | 'failed'

const OUTCOME = {
  idle: { icon: Copy, tint: '' },
  /*
    Le vert de la maison : dans ce thème l'accent *signale* et ne remplit
    jamais — une coche qui confirme est exactement ce pour quoi il est là.
  */
  copied: { icon: Check, tint: 'text-bottle-deep' },
  failed: { icon: X, tint: 'text-destructive' },
}

export function CopyButton({
  value,
  label,
  copiedLabel = 'Copié',
  className,
  ...props
}: {
  value: string
  label: string
  copiedLabel?: string
} & Omit<ComponentProps<typeof IconButton>, 'icon' | 'label' | 'onClick'>) {
  const [outcome, setOutcome] = useState<Outcome>('idle')
  const reset = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  /*
    Le minuteur survit au démontage : une carte d'établissement supprimée
    pendant les deux secondes de confirmation le laisserait écrire dans un
    composant qui n'est plus là.
  */
  useEffect(() => {
    const pending = reset
    return () => clearTimeout(pending.current)
  }, [])

  async function copy() {
    let next: Outcome = 'copied'
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      next = 'failed'
    }

    setOutcome(next)
    clearTimeout(reset.current)
    reset.current = setTimeout(() => setOutcome('idle'), FEEDBACK_MS)
  }

  const announcement = {
    idle: '',
    copied: copiedLabel,
    failed: 'Copie impossible',
  }

  return (
    <>
      <IconButton
        icon={OUTCOME[outcome].icon}
        label={label}
        title={label}
        onClick={copy}
        className={cn(OUTCOME[outcome].tint, className)}
        {...props}
      />

      {/*
        L'annonce passe par une région vivante et non par `aria-label` : celui-ci
        reste stable — un lecteur d'écran ne relit pas fiablement le libellé d'un
        bouton qui a déjà le focus, et le changer priverait l'utilisateur du nom
        de l'action au moment même où il vient de s'en servir.
      */}
      <span role="status" className="sr-only">
        {announcement[outcome]}
      </span>
    </>
  )
}
