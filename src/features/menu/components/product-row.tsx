import { useState } from 'react'
import { DeleteButton } from '#/components/buttons/delete-button'
import { EditButton } from '#/components/buttons/edit-button'
import { ErrorNote } from '#/components/error-note'
import { MoveButtons } from '#/components/buttons/move-buttons'
import { ProductForm } from '#/features/menu/components/product-form'
import { StockBadge } from '#/features/menu/components/stock-badge'
import { Switch } from '#/components/ui/switch'
import {
  useDeleteProduct,
  useSetProductAvailability,
} from '#/features/menu/mutations'
import { formatPrice } from '#/features/menu/price'
import { isHiddenFromCustomers } from '#/features/menu/stock'
import { productPhotoUrl } from '#/features/menu/photo'

import type { Product } from '#/lib/supabase'

/** Une ligne de produit : lecture, bascule de disponibilité, édition, suppression. */
export function ProductRow({
  product,
  venueId,
  currency,
  isFirst,
  isLast,
  onMove,
}: {
  product: Product
  venueId: string
  currency: string
  isFirst: boolean
  isLast: boolean
  onMove: (direction: -1 | 1) => void
}) {
  const [isEditing, setIsEditing] = useState(false)

  const setAvailability = useSetProductAvailability()
  const remove = useDeleteProduct()

  const error = setAvailability.error ?? remove.error

  /*
    Barré parce qu'il a quitté la carte, quelle qu'en soit la cause : retiré à
    la main, ou épuisé. Le gérant regarde la ligne pour savoir ce qu'un client
    voit, pas pour savoir laquelle des deux colonnes vaut quoi.
  */
  const isHidden = isHiddenFromCustomers(product)

  if (isEditing) {
    return (
      <li className="py-3">
        <ProductForm
          product={product}
          venueId={venueId}
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
      {product.image_path ? (
        <img
          src={productPhotoUrl(product.image_path)}
          alt=""
          /* Chargée paresseusement : une carte fournie ne doit pas tirer
             trente images avant d'être lisible. */
          loading="lazy"
          className="size-12 shrink-0 rounded-lg border border-line object-cover"
        />
      ) : null}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p
            className={
              isHidden
                ? 'font-medium text-ink-soft line-through'
                : 'font-medium'
            }
          >
            {product.name}
          </p>
          <StockBadge product={product} />
        </div>
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
          {/*
            L'interrupteur ne lit que `is_available`, jamais l'état déduit du
            stock : c'est le geste manuel du gérant, et il doit rester réversible
            indépendamment. Un produit épuisé mais resté « En vente » revient
            donc de lui-même à la livraison — la pastille, elle, dit déjà qu'il
            est parti.
          */}
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
          onConfirm={() =>
            remove.mutate({ id: product.id, imagePath: product.image_path })
          }
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
