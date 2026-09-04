import { useState } from 'react'
import { AddButton } from '#/components/buttons/add-button'
import { ErrorNote } from '#/components/error-note'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { slugify } from '#/features/venues/api'
import { useCreateVenue } from '#/features/venues/mutations'

import type { FormEvent } from 'react'

/**
 * Création d'un établissement.
 *
 * L'adresse publique n'est pas un champ : elle se dérive du nom et s'affiche
 * en aperçu pendant la saisie. Le gérant voit ce que le QR code encodera sans
 * avoir à comprendre ce qu'est un slug.
 */
export function AddVenueForm() {
  const [name, setName] = useState('')

  const create = useCreateVenue()

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    create.mutate(name, { onSuccess: () => setName('') })
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

        <AddButton
          type="submit"
          surface="page"
          pending={create.isPending}
          pendingLabel="Création…"
          disabled={!name.trim()}
        />
      </form>

      {create.error ? (
        <ErrorNote className="mt-3">{create.error.message}</ErrorNote>
      ) : null}
    </section>
  )
}
