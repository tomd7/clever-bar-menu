import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'

import { CancelButton } from '#/components/buttons/cancel-button'
import { SaveButton } from '#/components/buttons/save-button'
import { ErrorNote } from '#/components/error-note'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Textarea } from '#/components/ui/textarea'
import { describeError } from '#/lib/postgrest-error'
import {
  PriceFormatError,
  centsToInput,
  parseOptionalEurosToCents,
} from '#/features/menu/price'
import { supabase } from '#/lib/supabase'

import type { FormEvent } from 'react'
import type { Product } from '#/lib/supabase'

/**
 * Formulaire de création et d'édition d'un produit.
 *
 * Le même composant sert aux deux : les champs, la validation du prix et les
 * messages d'erreur y sont identiques, et les dupliquer garantirait qu'ils
 * divergent. La présence de `product` distingue les deux modes.
 */
export function ProductForm({
  product,
  categoryId,
  position,
  onCancel,
  onDone,
}: {
  product?: Product
  categoryId: string
  position: number
  onCancel: () => void
  onDone: () => Promise<void>
}) {
  const [name, setName] = useState(product?.name ?? '')
  const [description, setDescription] = useState(product?.description ?? '')
  const [price, setPrice] = useState(
    product ? centsToInput(product.price_cents) : '',
  )
  const [error, setError] = useState<string | null>(null)

  const save = useMutation({
    mutationFn: async () => {
      let priceCents: number | null
      try {
        priceCents = parseOptionalEurosToCents(price)
      } catch (cause) {
        throw cause instanceof PriceFormatError
          ? cause
          : new Error('Prix invalide.')
      }

      const fields = {
        name: name.trim(),
        description: description.trim() || null,
        price_cents: priceCents,
      }

      const result = product
        ? await supabase.from('products').update(fields).eq('id', product.id)
        : await supabase
            .from('products')
            .insert({ ...fields, category_id: categoryId, position })

      if (result.error) throw new Error(describeError(result.error))
    },
    onSuccess: onDone,
    onError: (cause: Error) => setError(cause.message),
  })

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    save.mutate()
  }

  const fieldId = product
    ? `product-${product.id}`
    : `product-new-${categoryId}`

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-3 rounded-xl border border-line bg-chip p-3 sm:p-4"
    >
      {/* Deux colonnes dès lg : le back-office doit exploiter la largeur, pas empiler. */}
      <div className="grid gap-3 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-2">
          <Label htmlFor={`${fieldId}-name`}>Nom</Label>
          <Input
            id={`${fieldId}-name`}
            autoFocus
            required
            maxLength={120}
            placeholder="Pinte de blonde"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="h-11 lg:h-9"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${fieldId}-price`}>
            Prix <span className="font-normal text-ink-soft">(facultatif)</span>
          </Label>
          <Input
            id={`${fieldId}-price`}
            /*
              `inputMode="decimal"` fait apparaître le pavé numérique sur mobile,
              là où `type="number"` imposerait le point décimal et des flèches
              inutiles pour un prix.
            */
            inputMode="decimal"
            placeholder="6,50"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            className="h-11 tabular-nums lg:h-9"
          />
          <p className="text-xs text-ink-soft">
            Laissez vide pour un plat du jour ou un prix selon arrivage.
          </p>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        <Label htmlFor={`${fieldId}-description`}>Description</Label>
        <Textarea
          id={`${fieldId}-description`}
          rows={2}
          maxLength={500}
          placeholder="Facultatif — origine, degré, allergènes…"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </div>

      {error ? <ErrorNote>{error}</ErrorNote> : null}

      <div className="mt-3 flex gap-2">
        <SaveButton pending={save.isPending} disabled={!name.trim()} />
        <CancelButton onClick={onCancel} />
      </div>
    </form>
  )
}
