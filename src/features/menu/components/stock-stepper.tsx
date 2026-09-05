import { Minus, Plus } from 'lucide-react'
import { useState } from 'react'

import { IconButton } from '#/components/buttons/icon-button'
import { TextField } from '#/components/form/text-field'

import type { KeyboardEvent } from 'react'

/**
 * Compteur de stock d'un produit : « −1 », le niveau, « +1 ».
 *
 * Un seul contrôle pour les deux gestes du métier, parce qu'ils portent sur le
 * même chiffre. Pendant le service on retire à l'unité, sans quitter la salle
 * des yeux ; à la livraison on tape le nouveau niveau directement dans le
 * champ. Les séparer aurait donné un bouton « Régler » ouvrant un mode, donc un
 * aller-retour pour l'opération la plus fréquente de la page.
 *
 * Les deux gestes ne sont pas la même écriture, et c'est le fond du problème :
 * l'un est **relatif** (« un de moins »), l'autre **absolu** (« il y en a
 * trente »). Le composant ne fait que les distinguer — `onAdjust` et `onSet` —
 * et laisse `StockRow` choisir par où chacun passe.
 *
 * Rien n'est désactivé pendant l'écriture : le cache est corrigé avant la
 * réponse du serveur, et un compteur qui se fige à chaque appui se fait appuyer
 * deux fois.
 */
export function StockStepper({
  productName,
  quantity,
  onAdjust,
  onSet,
}: {
  productName: string
  /** Niveau courant. Ce composant n'est rendu que sur un produit suivi. */
  quantity: number
  onAdjust: (delta: number) => void
  onSet: (quantity: number) => void
}) {
  /*
    `null` signifie « pas en cours de saisie » : le champ affiche alors le
    niveau reçu en props, y compris quand un « −1 » vient de le changer. Tenir
    une chaîne en permanence obligerait à la resynchroniser à chaque
    rechargement, et c'est exactement là que ce genre de champ se met à afficher
    une valeur périmée.
  */
  const [draft, setDraft] = useState<string | null>(null)

  function commit() {
    const value = draft
    setDraft(null)

    /*
      Un champ vidé ne coupe pas le suivi : ce geste existe, mais il vit sur la
      fiche du produit, où il est explicite. Ici, effacer pour retaper est le
      mouvement normal — le confondre avec « ne plus suivre » ferait disparaître
      la ligne de la page sous les doigts.
    */
    if (value === null || value === '') return

    const next = Number(value)
    if (next !== quantity) onSet(next)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      event.currentTarget.blur()
    }
    if (event.key === 'Escape') {
      setDraft(null)
      event.currentTarget.blur()
    }
  }

  return (
    <div className="flex items-center rounded-lg border border-line bg-surface-raised">
      <IconButton
        icon={Minus}
        label={`Retirer une unité de ${productName}`}
        /* Rien à retirer : le bouton se retire aussi, plutôt que de laisser
           partir un appui de trop vers une erreur de contrainte. */
        disabled={quantity === 0}
        onClick={() => onAdjust(-1)}
      />

      <TextField
        label={`Stock de ${productName}`}
        hiddenLabel
        inputMode="numeric"
        value={draft ?? String(quantity)}
        onFocus={() => setDraft(String(quantity))}
        /* Filtré à la saisie : le champ ne peut alors produire aucune valeur
           que la base refuserait, donc aucun message d'erreur à écrire. */
        onChange={(event) => setDraft(event.target.value.replace(/\D/g, ''))}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        /*
          Le champ se fond dans le groupe : c'est l'encadré qui fait l'objet,
          pas chacune de ses trois parties. `dark:bg-transparent` et
          `md:text-base` défont deux règles du composant shadcn que
          `tailwind-merge` ne remplace pas — une classe sans variante n'entre
          pas en conflit avec la même classe sous `dark:` ou `md:`, elle la
          laisse gagner à partir du point de rupture. L'anneau de focus, lui,
          reste : c'est la seule chose qui dise au clavier où il se trouve.
        */
        inputClassName="w-14 border-0 bg-transparent px-0 text-center text-base font-semibold tabular-nums shadow-none md:text-base dark:bg-transparent"
      />

      <IconButton
        icon={Plus}
        label={`Ajouter une unité de ${productName}`}
        onClick={() => onAdjust(1)}
      />
    </div>
  )
}
