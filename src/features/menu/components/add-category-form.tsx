import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { Plus } from 'lucide-react'

import { Button } from '#/components/ui/button'
import { ErrorNote } from '#/components/error-note'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { nextPosition } from '#/features/menu/api'
import { describeError } from '#/lib/postgrest-error'
import { supabase } from '#/lib/supabase'

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
  onDone,
}: {
  venueId: string
  categories: Array<CategoryWithProducts>
  onDone: () => Promise<void>
}) {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const create = useMutation({
    mutationFn: async () => {
      const { error: insertError } = await supabase.from('categories').insert({
        venue_id: venueId,
        name: name.trim(),
        position: nextPosition(categories),
      })
      if (insertError) throw new Error(describeError(insertError))
    },
    onSuccess: async () => {
      setName('')
      setError(null)
      await onDone()
    },
    onError: (cause: Error) => setError(cause.message),
  })

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    create.mutate()
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
        <Button
          type="submit"
          disabled={create.isPending || !name.trim()}
          className="h-11 gap-2 transition-transform duration-150 ease-out active:scale-[0.97] lg:h-10"
        >
          <Plus className="size-4" />
          {create.isPending ? 'Ajout…' : 'Ajouter'}
        </Button>
      </form>
      {error ? <ErrorNote>{error}</ErrorNote> : null}
    </section>
  )
}
