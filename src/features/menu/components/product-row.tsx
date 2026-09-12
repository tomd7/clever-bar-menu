import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { DeleteButton } from '#/components/buttons/delete-button'
import { EditButton } from '#/components/buttons/edit-button'
import { ErrorNote } from '#/components/error-note'
import { IconButton } from '#/components/buttons/icon-button'
import { MoveButtons } from '#/components/buttons/move-buttons'
import { ProductForm } from '#/features/menu/components/product-form'
import { ProductSize, productLabel } from '#/components/product-size'
import { StockBadge } from '#/features/menu/components/stock-badge'
import { Switch } from '#/components/ui/switch'
import {
  useDeleteProduct,
  useSetProductAvailability,
  useSetProductVisibility,
} from '#/features/menu/mutations'
import { formatPrice } from '#/lib/money'
import { productPhotoUrl } from '#/features/menu/photo'

import type { Product } from '#/lib/supabase'

/** Une ligne de produit : lecture, visibilité, disponibilité, édition, suppression. */
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

  const setVisibility = useSetProductVisibility()
  const setAvailability = useSetProductAvailability()
  const remove = useDeleteProduct()

  const error = setVisibility.error ?? setAvailability.error ?? remove.error

  /*
    Struck through when the product is off the customer's menu — which now
    means hidden, and only hidden. A sold-out product is still listed there,
    marked « épuisé »: striking it here would describe a menu the customer
    doesn't see. The switch and the stock badge say that one.
  */
  const isHidden = !product.is_visible

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
            {/*
              La taille est dans le `<p>` du nom, et non à côté : c'est le nom
              qui est barré quand le produit quitte la carte, et un « 50cl »
              resté droit à côté d'un nom barré se lirait comme une seconde
              information, encore valable.
            */}
            <ProductSize size={product.size} />
          </p>
          {isHidden ? <HiddenBadge /> : null}
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

      {/*
        On a phone the controls take a line of their own, the full width of the
        row: the product's state on the left, under its name, and the gestures
        on the right, at the thumb's edge. Left to wrap on its own, the row put
        the state group on the first line and squeezed the name to a word.

        Six 44px targets have to fit in about 260px there, so the buttons sit
        edge to edge below `sm` — the targets touch, they don't overlap, and
        the 16px icons still read 28px apart. Narrower than that, the two
        groups wrap onto two lines rather than overflow. From `sm` up the
        controls rejoin the first line, as before.
      */}
      <div className="flex w-full flex-wrap items-center justify-between sm:w-auto sm:justify-start sm:gap-x-3">
        <div className="flex items-center sm:gap-1">
          {/*
          Visibility first, because it is the broader of the two: a hidden
          product is not on the menu at all, whatever its sale state. The icon
          shows the current state and the label names the gesture, as the
          switch's does.
        */}
          <IconButton
            icon={product.is_visible ? Eye : EyeOff}
            label={
              product.is_visible
                ? 'Masquer de la carte'
                : 'Afficher sur la carte'
            }
            onClick={() =>
              setVisibility.mutate({
                productId: product.id,
                isVisible: !product.is_visible,
              })
            }
          />

          <label className="flex min-h-11 items-center gap-2 pr-1 text-xs text-ink-soft lg:min-h-9">
            <Switch
              checked={product.is_available}
              onCheckedChange={(checked) =>
                setAvailability.mutate({
                  productId: product.id,
                  isAvailable: checked,
                })
              }
              aria-label={
                product.is_available
                  ? 'Marquer en rupture'
                  : 'Remettre en vente'
              }
            />
            {/*
            L'interrupteur ne lit que `is_available`, jamais l'état déduit du
            stock : c'est le geste manuel du gérant, et il doit rester réversible
            indépendamment. Un produit épuisé mais resté « En vente » redevient
            donc commandable de lui-même à la livraison — la pastille, elle, dit
            déjà qu'il est épuisé.

            Below `sm` the word shows only when it says « Rupture ». « En vente »
            repeated on thirty rows is a state nobody reads any more, and that
            is exactly what would make the one « Rupture » go unnoticed — it
            used to be carried by the strike-through, which now means hidden.
          */}
            <span
              className={product.is_available ? 'hidden sm:inline' : undefined}
            >
              {product.is_available ? 'En vente' : 'Rupture'}
            </span>
          </label>
        </div>

        <div className="flex items-center sm:gap-1">
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
            /* Le format fait partie de l'identité : « Supprimer « Blonde » ? »
             ne dit pas laquelle des deux lignes va partir. */
            question={`Supprimer « ${productLabel(product.name, product.size)} » ?`}
            pending={remove.isPending}
            onConfirm={() =>
              remove.mutate({ id: product.id, imagePath: product.image_path })
            }
          />
        </div>
      </div>

      {error ? (
        <div className="w-full">
          <ErrorNote>{error.message}</ErrorNote>
        </div>
      ) : null}
    </li>
  )
}

/**
 * « Masqué », next to the name of a product taken off the customer's menu.
 *
 * The strike-through alone says it only to whoever already knows the
 * convention, and a screen reader reads no strike; the word says it to
 * everyone. Neutral, not destructive: hiding is a decision, not a problem to
 * fix — the destructive tint stays with « Épuisé », which a customer notices.
 * The pill's shape is `StockBadge`'s, so the two read as one family.
 */
function HiddenBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-raised px-2 py-0.5 text-xs font-medium text-ink-soft">
      <EyeOff className="size-3" aria-hidden="true" />
      Masqué
    </span>
  )
}
