import { useEffect, useRef, useState } from 'react'
import { ImagePlus, Trash2 } from 'lucide-react'

import { ActionButton } from '#/components/buttons/action-button'
import { Label } from '#/components/ui/label'
import { productPhotoUrl } from '#/features/menu/photo'
import { cn } from '#/lib/utils.ts'

/**
 * Choix de la photo d'un produit.
 *
 * L'`<input type="file">` natif est masqué et piloté par un bouton : son rendu
 * par défaut ne se met pas en forme d'un navigateur à l'autre, et son libellé
 * « Aucun fichier sélectionné » est un anglicisme de plus dans une interface
 * française. Le bouton conserve tout le comportement natif — sur mobile, il
 * ouvre l'appareil photo comme la galerie.
 *
 * Le composant ne conserve aucun état de photo : le formulaire tient le fichier
 * choisi et le chemin existant, parce que c'est lui qui les enregistre.
 */
export function PhotoField({
  imagePath,
  file,
  className,
  onSelect,
  onRemove,
}: {
  className?: string
  /** Photo déjà enregistrée, ou `null` si le gérant vient de la retirer. */
  imagePath: string | null
  /** Photo choisie à l'instant, pas encore envoyée. */
  file: File | null
  onSelect: (file: File) => void
  onRemove: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [localPreview, setLocalPreview] = useState<string | null>(null)

  /*
    Une URL d'objet réserve le fichier en mémoire jusqu'à révocation explicite.
    Sans ce nettoyage, changer six fois de photo en retiendrait six.
  */
  useEffect(() => {
    if (!file) {
      setLocalPreview(null)
      return
    }
    const url = URL.createObjectURL(file)
    setLocalPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const preview =
    localPreview ?? (imagePath ? productPhotoUrl(imagePath) : null)

  function openPicker() {
    inputRef.current?.click()
  }

  return (
    <div className={cn('space-y-2', className)}>
      <Label>
        Photo <span className="font-normal text-ink-soft">(facultative)</span>
      </Label>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(event) => {
          const chosen = event.target.files?.[0]
          if (chosen) onSelect(chosen)
          /*
            Remet le champ à zéro : sans cela, rechoisir le même fichier après
            l'avoir retiré ne déclencherait aucun `change`, la valeur n'ayant
            pas varié.
          */
          event.target.value = ''
        }}
      />

      <div className="flex items-center gap-3">
        {preview ? (
          <img
            src={preview}
            alt=""
            /*
              `alt` vide et non descriptif : l'image ne dit rien que le nom du
              produit, juste à côté, ne dise déjà. La renommer obligerait un
              lecteur d'écran à annoncer deux fois la même chose.
            */
            className="size-16 shrink-0 rounded-lg border border-line object-cover"
          />
        ) : (
          <div className="flex size-16 shrink-0 items-center justify-center rounded-lg border border-dashed border-line text-ink-soft">
            <ImagePlus className="size-5" />
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {/*
            Sans icône : le carré d'aperçu juste à gauche porte déjà
            `ImagePlus` quand aucune photo n'est choisie, et la répéter sur le
            bouton mettait deux fois le même pictogramme côte à côte.
          */}
          <ActionButton variant="outline" onClick={openPicker}>
            {preview ? 'Remplacer' : 'Ajouter une photo'}
          </ActionButton>

          {preview ? (
            <ActionButton
              variant="ghost"
              tone="destructive"
              icon={Trash2}
              onClick={onRemove}
            >
              Retirer
            </ActionButton>
          ) : null}
        </div>
      </div>

      <p className="text-xs text-ink-soft">
        JPEG, PNG ou WebP. L'image est réduite dans le navigateur avant l'envoi.
      </p>
    </div>
  )
}
