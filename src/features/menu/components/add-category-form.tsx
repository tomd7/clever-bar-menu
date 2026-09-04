import { useState } from 'react'
import { AddButton } from '#/components/buttons/add-button'
import { ErrorNote } from '#/components/error-note'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { nextPosition } from '#/features/menu/api'
import { useCreateCategory } from '#/features/menu/mutations'

import type { FormEvent } from 'react'
import type { CategoryWithProducts } from '#/features/menu/api'

/**
 * Ajout d'une catégorie à la carte.
 *
 * La liste existante n'est pas affichée ici, elle sert à calculer la position
 * du nouvel élément : une catégorie créée se range en fin de carte.
 */
export function AddCategoryForm({
  venueId,
  categories,
}: {
  venueId: string
  categories: Array<CategoryWithProducts>
}) {
  const [name, setName] = useState('')

  const create = useCreateCategory()

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    create.mutate(
      { venueId, name: name.trim(), position: nextPosition(categories) },
      { onSuccess: () => setName('') },
    )
  }

  return (
    <section className="panel mt-6 rounded-2xl p-4 sm:p-6">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-3 lg:flex-row lg:items-end"
      >
        <div className="flex-1 space-y-2">
          <Label htmlFor="category-name">Nouvelle catégorie</Label>
          <Input
            id="category-name"
            required
            maxLength={80}
            placeholder="Bières pression"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="h-11 lg:h-10"
          />
        </div>
        <AddButton
          type="submit"
          surface="page"
          pending={create.isPending}
          disabled={!name.trim()}
        />
      </form>
      {create.error ? <ErrorNote>{create.error.message}</ErrorNote> : null}
    </section>
  )
}
