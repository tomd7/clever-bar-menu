import { useState } from 'react'

import { CancelButton } from '#/components/buttons/cancel-button'
import { SaveButton } from '#/components/buttons/save-button'
import { ErrorNote } from '#/components/error-note'
import { TextAreaField } from '#/components/form/textarea-field'
import { TextField } from '#/components/form/text-field'
import { centsToInput } from '#/features/menu/price'
import { useSaveProduct } from '#/features/menu/mutations'

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
  onSaved,
}: {
  product?: Product
  categoryId: string
  position: number
  onCancel: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(product?.name ?? '')
  const [description, setDescription] = useState(product?.description ?? '')
  const [price, setPrice] = useState(
    product ? centsToInput(product.price_cents) : '',
  )
  const save = useSaveProduct()

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    save.mutate(
      {
        productId: product?.id,
        categoryId,
        position,
        name,
        description,
        price,
      },
      { onSuccess: onSaved },
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-3 rounded-xl border border-line bg-chip p-3 sm:p-4"
    >
      {/* Deux colonnes dès lg : le back-office doit exploiter la largeur, pas empiler. */}
      <div className="grid gap-3 lg:grid-cols-[2fr_1fr]">
        <TextField
          label="Nom"
          autoFocus
          required
          maxLength={120}
          placeholder="Pinte de blonde"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />

        <TextField
          label={
            <>
              Prix{' '}
              <span className="font-normal text-ink-soft">(facultatif)</span>
            </>
          }
          /*
            `inputMode="decimal"` fait apparaître le pavé numérique sur mobile,
            là où `type="number"` imposerait le point décimal et des flèches
            inutiles pour un prix.
          */
          inputMode="decimal"
          placeholder="6,50"
          value={price}
          onChange={(event) => setPrice(event.target.value)}
          inputClassName="tabular-nums"
          hint="Laissez vide pour un plat du jour ou un prix selon arrivage."
        />
      </div>

      <TextAreaField
        label="Description"
        className="mt-3"
        rows={2}
        maxLength={500}
        placeholder="Facultatif — origine, degré, allergènes…"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
      />

      {save.error ? <ErrorNote>{save.error.message}</ErrorNote> : null}

      <div className="mt-3 flex gap-2">
        <SaveButton pending={save.isPending} disabled={!name.trim()} />
        <CancelButton onClick={onCancel} />
      </div>
    </form>
  )
}
