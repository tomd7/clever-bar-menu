import { useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'

import { ActionButton } from '#/components/action-button'
import { IconButton } from '#/components/icon-button'
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTrigger,
} from '#/components/ui/popover'

/**
 * Suppression en deux temps, confirmée dans un popover ancré au bouton.
 *
 * Le popover ne déplace rien : la question se superpose au lieu de pousser la
 * ligne, ce qui évitait de faire sauter les éléments voisins — le défaut de la
 * confirmation en ligne, particulièrement visible sur une ligne de produit déjà
 * dense. Il se ferme à l'échappement ou au clic extérieur, deux échappatoires
 * qu'une confirmation en ligne n'offre pas.
 *
 * `window.confirm` restait l'autre option, mais il bloque le fil d'exécution et
 * ne se laisse pas mettre en forme.
 */
export function ConfirmDelete({
  label,
  question,
  pending,
  onConfirm,
}: {
  label: string
  question: string
  pending: boolean
  onConfirm: () => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const cancelRef = useRef<HTMLButtonElement>(null)

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <IconButton
          icon={Trash2}
          label={label}
          tone="destructive"
          disabled={pending}
        />
      </PopoverTrigger>

      <PopoverContent
        align="end"
        /*
          150 ms et ease-out : la réponse doit se voir immédiatement. Le
          composant met déjà l'origine de la transformation sur le déclencheur,
          si bien que le popover s'ouvre depuis le bouton plutôt que depuis son
          propre centre.
        */
        className="w-auto max-w-72 p-3 duration-150 ease-out"
        /*
          Le focus va sur « Annuler » et non sur « Supprimer » : le popover
          s'ouvre au clavier comme à la souris, et une frappe d'entrée réflexe
          ne doit pas détruire une catégorie entière.
        */
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          cancelRef.current?.focus()
        }}
      >
        <PopoverDescription className="text-sm text-ink">
          {question}
        </PopoverDescription>

        <div className="mt-3 flex justify-end gap-2">
          <ActionButton
            ref={cancelRef}
            variant="ghost"
            size="sm"
            surface="popover"
            onClick={() => setIsOpen(false)}
          >
            Annuler
          </ActionButton>
          <ActionButton
            variant="destructive"
            size="sm"
            surface="popover"
            /*
              Fermé dès la confirmation : en cas d'échec, le message d'erreur
              s'affiche dans la ligne, que le popover recouvrirait.
            */
            onClick={() => {
              setIsOpen(false)
              onConfirm()
            }}
          >
            Supprimer
          </ActionButton>
        </div>
      </PopoverContent>
    </Popover>
  )
}
