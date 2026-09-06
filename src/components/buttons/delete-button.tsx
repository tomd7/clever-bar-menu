import { useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'

import { ActionButton } from '#/components/buttons/action-button'
import { CancelButton } from '#/components/buttons/cancel-button'
import { IconButton } from '#/components/buttons/icon-button'
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTrigger,
} from '#/components/ui/popover'

import type { Surface } from '#/components/surface'

/**
 * Bouton de suppression — et donc, dans ce projet, suppression en deux temps.
 *
 * La confirmation n'est pas une option du composant : il n'existe pas de
 * chemin qui supprime au premier clic. C'est tout l'intérêt d'un wrapper par
 * type d'action — la règle tient dans le composant, pas dans la mémoire de
 * celui qui l'appelle.
 *
 * Le popover ne déplace rien : la question se superpose au lieu de pousser la
 * ligne, ce qui évitait de faire sauter les éléments voisins — le défaut de la
 * confirmation en ligne, particulièrement visible sur une ligne de produit déjà
 * dense. Il se ferme à l'échappement ou au clic extérieur, deux échappatoires
 * qu'une confirmation en ligne n'offre pas.
 *
 * `window.confirm` restait l'autre option, mais il bloque le fil d'exécution et
 * ne se laisse pas mettre en forme.
 *
 * `labelled` change la forme du déclencheur, pas la règle : icône seule dans
 * une ligne dense, bouton libellé quand la suppression est une action de page —
 * « Vider la corbeille » n'a pas de ligne à laquelle s'accrocher, et une
 * corbeille dessinée seule au-dessus d'une liste de corbeilles ne dirait pas ce
 * qu'elle vide. Un seul `label` dans les deux cas : visible ici, lu par un
 * lecteur d'écran là, jamais deux formulations à tenir d'accord.
 */
export function DeleteButton({
  label,
  question,
  pending,
  onConfirm,
  labelled = false,
  surface = 'panel',
}: {
  label: string
  question: string
  pending: boolean
  onConfirm: () => void
  labelled?: boolean
  surface?: Surface
}) {
  const [isOpen, setIsOpen] = useState(false)
  const cancelRef = useRef<HTMLButtonElement>(null)

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        {labelled ? (
          /*
            Teinte destructive sur un contour, et non `variant="destructive"` :
            l'aplat rouge est réservé au bouton qui confirme. Un écran qui
            crie avant même d'avoir posé la question fait hésiter sur ce qui
            est déjà fait.
          */
          <ActionButton
            icon={Trash2}
            variant="outline"
            tone="destructive"
            surface={surface}
            disabled={pending}
          >
            {label}
          </ActionButton>
        ) : (
          <IconButton
            icon={Trash2}
            label={label}
            tone="destructive"
            disabled={pending}
          />
        )}
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
          <CancelButton
            ref={cancelRef}
            size="sm"
            surface="popover"
            onClick={() => setIsOpen(false)}
          />
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
