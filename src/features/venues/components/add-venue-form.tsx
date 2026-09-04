import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { Plus } from 'lucide-react'

import { ActionButton } from '#/components/action-button'
import { ErrorNote } from '#/components/error-note'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { createVenue, slugify } from '#/features/venues/api'

import type { FormEvent } from 'react'

/**
 * Création d'un établissement.
 *
 * L'adresse publique n'est pas un champ : elle se dérive du nom et s'affiche
 * en aperçu pendant la saisie. Le gérant voit ce que le QR code encodera sans
 * avoir à comprendre ce qu'est un slug.
 */
export function AddVenueForm({ onDone }: { onDone: () => Promise<void> }) {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const create = useMutation({
    mutationFn: createVenue,
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
    create.mutate(name)
  }

  const preview = slugify(name)

  return (
    <section className="panel mt-6 rounded-2xl p-4 sm:p-6">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-3 lg:flex-row lg:items-end"
      >
        <div className="flex-1 space-y-2">
          <Label htmlFor="venue-name">Nom de l'établissement</Label>
          <Input
            id="venue-name"
            required
            maxLength={80}
            placeholder="Le Comptoir"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="h-11 lg:h-10"
          />
          {preview ? (
            <p className="text-xs text-ink-soft">
              Adresse publique : <code>/m/{preview}</code>
            </p>
          ) : null}
        </div>

        <ActionButton
          type="submit"
          icon={Plus}
          surface="page"
          disabled={create.isPending || !name.trim()}
        >
          {create.isPending ? 'Création…' : 'Ajouter'}
        </ActionButton>
      </form>

      {error ? <ErrorNote className="mt-3">{error}</ErrorNote> : null}
    </section>
  )
}
