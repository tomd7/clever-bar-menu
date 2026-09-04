import { useState } from 'react'
import { CancelButton } from '#/components/buttons/cancel-button'
import { DeleteButton } from '#/components/buttons/delete-button'
import { EditButton } from '#/components/buttons/edit-button'
import { SaveButton } from '#/components/buttons/save-button'
import { ErrorNote } from '#/components/error-note'
import { TextField } from '#/components/form/text-field'
import { MoveButtons } from '#/components/buttons/move-buttons'
import { useDeleteCategory, useRenameCategory } from '#/features/menu/mutations'

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
}: {
  category: CategoryWithProducts
  isFirst: boolean
  isLast: boolean
  onMove: (direction: -1 | 1) => void
}) {
  const [isRenaming, setIsRenaming] = useState(false)
  const [name, setName] = useState(category.name)

  const rename = useRenameCategory()
  const remove = useDeleteCategory()

  const error = rename.error ?? remove.error
  const productCount = category.products.length

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        {isRenaming ? (
          <form
            onSubmit={(event) => {
              event.preventDefault()
              rename.mutate(
                { categoryId: category.id, name: name.trim() },
                { onSuccess: () => setIsRenaming(false) },
              )
            }}
            className="flex flex-1 flex-wrap items-center gap-2"
          >
            <TextField
              label="Nom de la catégorie"
              hiddenLabel
              autoFocus
              required
              maxLength={80}
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="flex-1"
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
                rename.reset()
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
              onConfirm={() => remove.mutate(category.id)}
            />
          </div>
        ) : null}
      </div>

      {error ? <ErrorNote>{error.message}</ErrorNote> : null}
    </>
  )
}
