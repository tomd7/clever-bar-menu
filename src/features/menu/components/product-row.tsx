import { useState } from 'react'
import { DeleteButton } from '#/components/buttons/delete-button'
import { EditButton } from '#/components/buttons/edit-button'
import { ErrorNote } from '#/components/error-note'
import { MoveButtons } from '#/components/buttons/move-buttons'
import { ProductForm } from '#/features/menu/components/product-form'
import { Switch } from '#/components/ui/switch'
import {
  useDeleteProduct,
  useSetProductAvailability,
} from '#/features/menu/mutations'
import { formatPrice } from '#/features/menu/price'

import type { Product } from '#/lib/supabase'

/** Une ligne de produit : lecture, bascule de disponibilité, édition, suppression. */
export function ProductRow({
  product,
  currency,
  isFirst,
  isLast,
  onMove,
}: {
  product: Product
  currency: string
  isFirst: boolean
  isLast: boolean
  onMove: (direction: -1 | 1) => void
}) {
  const [isEditing, setIsEditing] = useState(false)

  const setAvailability = useSetProductAvailability()
  const remove = useDeleteProduct()

  const error = setAvailability.error ?? remove.error

  if (isEditing) {
    return (
      <li className="py-3">
        <ProductForm
          product={product}
          categoryId={product.category_id}
          position={product.position}
          onCancel={() => setIsEditing(false)}
          onSaved={() => setIsEditing(false)}
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
            onCheckedChange={(checked) =>
              setAvailability.mutate({
                productId: product.id,
                isAvailable: checked,
              })
            }
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
        <EditButton
          label="Modifier le produit"
          onClick={() => setIsEditing(true)}
        />
        <DeleteButton
          label="Supprimer le produit"
          question={`Supprimer « ${product.name} » ?`}
          pending={remove.isPending}
          onConfirm={() => remove.mutate(product.id)}
        />
      </div>

      {error ? (
        <div className="w-full">
          <ErrorNote>{error.message}</ErrorNote>
        </div>
      ) : null}
    </li>
  )
}
