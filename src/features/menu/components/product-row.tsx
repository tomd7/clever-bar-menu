import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { Pencil } from 'lucide-react'

import { ConfirmDelete } from '#/components/confirm-delete'
import { IconButton } from '#/components/icon-button'
import { ErrorNote } from '#/components/error-note'
import { MoveButtons } from '#/components/move-buttons'
import { ProductForm } from '#/features/menu/components/product-form'
import { Switch } from '#/components/ui/switch'
import { describeError } from '#/lib/postgrest-error'
import { formatPrice } from '#/features/menu/price'
import { supabase } from '#/lib/supabase'

import type { Product } from '#/lib/supabase'

/** Une ligne de produit : lecture, bascule de disponibilité, édition, suppression. */
export function ProductRow({
  product,
  currency,
  isFirst,
  isLast,
  onMove,
  onDone,
}: {
  product: Product
  currency: string
  isFirst: boolean
  isLast: boolean
  onMove: (direction: -1 | 1) => Promise<void>
  onDone: () => Promise<void>
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const setAvailability = useMutation({
    mutationFn: async (isAvailable: boolean) => {
      const { error: updateError } = await supabase
        .from('products')
        .update({ is_available: isAvailable })
        .eq('id', product.id)
      if (updateError) throw new Error(describeError(updateError))
    },
    onSuccess: onDone,
    onError: (cause: Error) => setError(cause.message),
  })

  const remove = useMutation({
    mutationFn: async () => {
      const { error: deleteError } = await supabase
        .from('products')
        .delete()
        .eq('id', product.id)
      if (deleteError) throw new Error(describeError(deleteError))
    },
    onSuccess: onDone,
    onError: (cause: Error) => setError(cause.message),
  })

  if (isEditing) {
    return (
      <li className="py-3">
        <ProductForm
          product={product}
          categoryId={product.category_id}
          position={product.position}
          onCancel={() => setIsEditing(false)}
          onDone={async () => {
            setIsEditing(false)
            await onDone()
          }}
        />
      </li>
    )
  }

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
      <div className="min-w-0 flex-1">
        <p
          className={
            product.is_available
              ? 'font-medium'
              : 'font-medium text-ink-soft line-through'
          }
        >
          {product.name}
        </p>
        {product.description ? (
          <p className="mt-0.5 line-clamp-2 text-sm text-ink-soft">
            {product.description}
          </p>
        ) : null}
      </div>

      {product.price_cents === null ? (
        /*
          Un prix absent est une information, pas un vide : l'écrire évite au
          gérant de se demander si la ligne est cassée ou s'il a oublié de la
          renseigner.
        */
        <p className="text-sm text-ink-soft italic">Prix non renseigné</p>
      ) : (
        <p className="font-semibold tabular-nums">
          {formatPrice(product.price_cents, currency)}
        </p>
      )}

      <div className="flex items-center gap-1">
        <label className="flex min-h-11 items-center gap-2 pr-1 text-xs text-ink-soft lg:min-h-9">
          <Switch
            checked={product.is_available}
            disabled={setAvailability.isPending}
            onCheckedChange={(checked) => setAvailability.mutate(checked)}
            aria-label={
              product.is_available
                ? 'Marquer en rupture'
                : 'Remettre à la carte'
            }
          />
          <span className="hidden sm:inline">
            {product.is_available ? 'En vente' : 'Rupture'}
          </span>
        </label>

        <MoveButtons
          upLabel="Monter le produit"
          downLabel="Descendre le produit"
          isFirst={isFirst}
          isLast={isLast}
          onMove={onMove}
        />
        <IconButton
          icon={Pencil}
          label="Modifier le produit"
          onClick={() => setIsEditing(true)}
        />
        <ConfirmDelete
          label="Supprimer le produit"
          question={`Supprimer « ${product.name} » ?`}
          pending={remove.isPending}
          onConfirm={() => remove.mutate()}
        />
      </div>

      {error ? (
        <div className="w-full">
          <ErrorNote>{error}</ErrorNote>
        </div>
      ) : null}
    </li>
  )
}
