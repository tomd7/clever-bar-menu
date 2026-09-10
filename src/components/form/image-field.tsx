import { useEffect, useRef, useState } from 'react'
import { ImagePlus, Trash2 } from 'lucide-react'

import { ActionButton } from '#/components/buttons/action-button'
import { Label } from '#/components/ui/label'
import { cn } from '#/lib/utils.ts'

import type { ReactNode } from 'react'

/**
 * Picking one image — a product's photo, a venue's logo.
 *
 * The native `<input type="file">` is hidden and driven by a button: its default
 * rendering can't be styled the same from one browser to the next, and its
 * « Aucun fichier sélectionné » is one more anglicism in a French interface.
 * The button keeps every native behaviour — on a phone it offers the camera as
 * well as the gallery.
 *
 * It holds no image state: the form owns the picked file and the stored path,
 * because the form is what saves them. It even takes the preview as a URL the
 * caller resolved — `useObjectUrl` for a file just picked, the public Storage
 * URL otherwise — because the settings screen draws the same logo twice, here
 * and in its preview, and one URL must serve both.
 *
 * Moved down from `features/menu` when the logo needed it: `features/venues`
 * may not import from there.
 */
export function ImageField({
  label,
  hint,
  addLabel,
  previewUrl,
  fit = 'cover',
  className,
  onSelect,
  onRemove,
}: {
  label: ReactNode
  hint: ReactNode
  /** The button's wording while there is nothing to show — « Ajouter une photo ». */
  addLabel: string
  /** The image to show, or `null` when there is none (or it was just removed). */
  previewUrl: string | null
  /**
   * `cover` fills the thumbnail, right for a photo. `contain` shows the whole
   * image on a mid-tone, for a logo whose edges matter and whose ink may be
   * dark or light.
   */
  fit?: 'cover' | 'contain'
  className?: string
  onSelect: (file: File) => void
  onRemove: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className={cn('space-y-2', className)}>
      <Label>{label}</Label>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        /*
          Out of the tab order: the button below is the control. Left in, the
          invisible input was a second, silent stop right before it.
        */
        tabIndex={-1}
        onChange={(event) => {
          const chosen = event.target.files?.[0]
          if (chosen) onSelect(chosen)
          /*
            Reset the field: otherwise picking the same file again after
            removing it would fire no `change`, the value not having moved.
          */
          event.target.value = ''
        }}
      />

      <div className="flex items-center gap-3">
        {previewUrl ? (
          <img
            src={previewUrl}
            alt=""
            /*
              Empty `alt`: the image says nothing the field's own label and the
              screen around it don't already say.

              `contain` sits on a mid-tone, where a dark logo and a white one
              both stay legible — see `MID_TONE`.
            */
            className={cn(
              'size-16 shrink-0 rounded-lg border border-line',
              fit === 'contain' ? 'object-contain p-1.5' : 'object-cover',
            )}
            style={fit === 'contain' ? MID_TONE : undefined}
          />
        ) : (
          <div className="flex size-16 shrink-0 items-center justify-center rounded-lg border border-dashed border-line text-ink-soft">
            <ImagePlus className="size-5" />
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {/*
            No icon: the preview square just to the left already carries
            `ImagePlus` while nothing is picked, and repeating it on the button
            put the same pictogram twice side by side.
          */}
          <ActionButton
            variant="outline"
            onClick={() => inputRef.current?.click()}
          >
            {previewUrl ? 'Remplacer' : addLabel}
          </ActionButton>

          {previewUrl ? (
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

      <p className="text-xs text-ink-soft">{hint}</p>
    </div>
  )
}

/**
 * A flat mid-tone, halfway between the panel's ink and its surface, so it
 * follows day and night.
 *
 * Not a checkerboard, though that was the first idea and the usual sign for
 * transparency. Tried in the browser with a cream logo: on `--line` and
 * `--surface` squares it vanished, and even with dark squares at 45% ink half
 * of it still sat on white — at 64px the pattern was louder than the logo. A
 * ground halfway between the two extremes keeps a dark logo and a white one
 * both legible, which is all this thumbnail has to say; how the logo really
 * looks on the board is the preview's job.
 */
const MID_TONE = {
  backgroundColor: 'color-mix(in oklab, var(--ink) 50%, var(--surface))',
}

/**
 * An object URL for a file just picked, revoked when the file changes or the
 * component unmounts.
 *
 * An object URL keeps the file in memory until it is explicitly revoked:
 * without this cleanup, changing a photo six times would hold on to six.
 */
export function useObjectUrl(file: File | null): string | null {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!file) {
      setUrl(null)
      return
    }
    const next = URL.createObjectURL(file)
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [file])

  return url
}
