import { useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'

import { Button } from '#/components/ui/button'
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
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={label}
          disabled={pending}
          className="size-11 text-destructive hover:bg-destructive/10 hover:text-destructive lg:size-9"
        >
          <Trash2 className="size-4" />
        </Button>
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
          <Button
            ref={cancelRef}
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsOpen(false)}
            className="h-11 lg:h-8"
          >
            Annuler
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            /*
              Fermé dès la confirmation : en cas d'échec, le message d'erreur
              s'affiche dans la ligne, que le popover recouvrirait.
            */
            onClick={() => {
              setIsOpen(false)
              onConfirm()
            }}
            className="h-11 transition-transform duration-150 ease-out active:scale-[0.97] lg:h-8"
          >
            Supprimer
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
