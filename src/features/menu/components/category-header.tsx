import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { CancelButton } from '#/components/buttons/cancel-button'
import { DeleteButton } from '#/components/buttons/delete-button'
import { EditButton } from '#/components/buttons/edit-button'
import { SaveButton } from '#/components/buttons/save-button'
import { ErrorNote } from '#/components/error-note'
import { Input } from '#/components/ui/input'
import { MoveButtons } from '#/components/buttons/move-buttons'
import { describeError } from '#/lib/postgrest-error'
import { supabase } from '#/lib/supabase'

import type { CategoryWithProducts } from '#/features/menu/api'

/**
 * En-tête d'une catégorie : son nom, son compte de produits et ses actions.
 *
 * Le renommage remplace le titre par un champ au lieu d'ouvrir un formulaire
 * sous l'en-tête : la ligne garde sa hauteur, rien ne saute.
 */
export function CategoryHeader({
  category,
  isFirst,
  isLast,
  onMove,
  onDone,
}: {
  category: CategoryWithProducts
  isFirst: boolean
  isLast: boolean
  onMove: (direction: -1 | 1) => Promise<void>
  onDone: () => Promise<void>
}) {
  const [isRenaming, setIsRenaming] = useState(false)
  const [name, setName] = useState(category.name)
  const [error, setError] = useState<string | null>(null)

  const rename = useMutation({
    mutationFn: async () => {
      const { error: updateError } = await supabase
        .from('categories')
        .update({ name: name.trim() })
        .eq('id', category.id)
      if (updateError) throw new Error(describeError(updateError))
    },
    onSuccess: async () => {
      setIsRenaming(false)
      setError(null)
      await onDone()
    },
    onError: (cause: Error) => setError(cause.message),
  })

  const remove = useMutation({
    mutationFn: async () => {
      const { error: deleteError } = await supabase
        .from('categories')
        .delete()
        .eq('id', category.id)
      if (deleteError) throw new Error(describeError(deleteError))
    },
    onSuccess: onDone,
    onError: (cause: Error) => setError(cause.message),
  })

  const productCount = category.products.length

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        {isRenaming ? (
          <form
            onSubmit={(event) => {
              event.preventDefault()
              rename.mutate()
            }}
            className="flex flex-1 flex-wrap items-center gap-2"
          >
            <Input
              autoFocus
              required
              maxLength={80}
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="h-11 flex-1 lg:h-9"
            />
            <SaveButton
              size="sm"
              pending={rename.isPending}
              disabled={!name.trim()}
            />
            <CancelButton
              size="sm"
              onClick={() => {
                setName(category.name)
                setIsRenaming(false)
                setError(null)
              }}
            />
          </form>
        ) : (
          <div className="min-w-0 flex-1">
            <h2 className="display-title text-lg leading-tight">
              {category.name}
            </h2>
            <p className="mt-0.5 text-xs text-ink-soft">
              {productCount === 0
                ? 'Aucun produit'
                : `${productCount} produit${productCount > 1 ? 's' : ''}`}
            </p>
          </div>
        )}

        {!isRenaming ? (
          <div className="flex items-center gap-1">
            <MoveButtons
              upLabel="Monter la catégorie"
              downLabel="Descendre la catégorie"
              isFirst={isFirst}
              isLast={isLast}
              onMove={onMove}
            />
            <EditButton
              label="Renommer la catégorie"
              onClick={() => setIsRenaming(true)}
            />
            <DeleteButton
              label="Supprimer la catégorie"
              /*
                La cascade est déclarée en base (`on delete cascade`) : supprimer
                une catégorie emporte ses produits. L'annoncer explicitement,
                puisque rien à l'écran ne le laisse deviner.
              */
              question={
                productCount > 0
                  ? `Supprimer « ${category.name} » et ses ${productCount} produit${productCount > 1 ? 's' : ''} ?`
                  : `Supprimer « ${category.name} » ?`
              }
              pending={remove.isPending}
              onConfirm={() => remove.mutate()}
            />
          </div>
        ) : null}
      </div>

      {error ? <ErrorNote>{error}</ErrorNote> : null}
    </>
  )
}
