import { Minus, Plus, Send } from 'lucide-react'
import { useEffect, useState } from 'react'

import { ActionButton } from '#/components/buttons/action-button'
import { BottomSheet } from '#/features/orders/components/bottom-sheet'
import { ErrorNote } from '#/components/error-note'
import { IconButton } from '#/components/buttons/icon-button'
import { ProductSize, productLabel } from '#/components/product-size'
import { TextAreaField } from '#/components/form/textarea-field'
import { TextField } from '#/components/form/text-field'
import { cartTotal, setCartQuantity, useCart } from '#/features/orders/cart'
import { formatPrice } from '#/lib/money'
import { usePlaceOrder } from '#/features/orders/mutations'

import type { FormEvent } from 'react'
import type { CartProduct } from '#/features/orders/cart'

/**
 * Le panier, et le formulaire qui l'envoie.
 *
 * Les produits arrivent en props plutôt que d'être rechargés ici : le panier ne
 * retient que des identifiants et des quantités, et c'est la route — seule
 * autorisée à connaître les deux features — qui lui fournit la carte en face.
 *
 * Une seule feuille pour le panier **et** le formulaire, sans étape
 * intermédiaire. Ce qu'on commande dans un bar tient en trois lignes ; couper
 * ça en deux écrans ferait deux fois plus de gestes pour une pinte.
 */
export function CartSheet({
  open,
  onOpenChange,
  venueSlug,
  products,
  currency,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  venueSlug: string
  /** La carte affichée, pour retrouver le nom et le prix d'une ligne. */
  products: Array<CartProduct>
  currency: string
}) {
  const cart = useCart(venueSlug)
  const place = usePlaceOrder(venueSlug)

  const [guestName, setGuestName] = useState('')
  const [guestNote, setGuestNote] = useState('')

  const byId = new Map(products.map((product) => [product.id, product]))

  /*
    Les lignes suivent l'ordre du panier — l'ordre où le client a ajouté — et
    non celui de la carte. C'est la liste de ses gestes, elle doit se relire
    comme il l'a construite.

    Une ligne dont le produit a disparu de la carte est écartée : elle n'a plus
    ni nom ni prix à montrer. `place_order` refusera de toute façon l'envoi, et
    avec un message que cet écran ne saurait pas formuler.
  */
  const lines = cart
    .map((line) => ({ line, product: byId.get(line.productId) }))
    .filter(
      (entry): entry is { line: (typeof cart)[number]; product: CartProduct } =>
        entry.product !== undefined,
    )

  const total = cartTotal(cart, (productId) => byId.get(productId)?.price_cents)

  /*
    Vider le panier depuis la feuille ferme la feuille : il n'y a plus rien à y
    faire, et laisser un panneau vide ouvert obligerait à un geste de plus pour
    revenir à la carte.
  */
  useEffect(() => {
    if (open && cart.length === 0) onOpenChange(false)
  }, [open, cart.length, onOpenChange])

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    place.mutate({
      guestName,
      guestNote: guestNote.trim() || null,
      items: cart.map((line) => ({
        productId: line.productId,
        quantity: line.quantity,
      })),
    })
  }

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Votre commande"
      description="Elle se règle au comptoir, en venant la chercher."
    >
      <ul className="divide-y divide-line-soft border-y border-line-soft">
        {lines.map(({ line, product }) => (
          <li key={line.productId} className="flex items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {product.name}
                <ProductSize size={product.size} />
              </p>
              <p className="mt-0.5 text-sm text-ink-soft tabular-nums">
                {product.price_cents === null
                  ? 'Prix au comptoir'
                  : formatPrice(product.price_cents, currency)}
              </p>
            </div>

            {/*
              Un compteur, pas un champ : dans un panier de bar on ajuste d'une
              unité, on ne saisit pas « 7 ». Le « − » à zéro retire la ligne —
              c'est le geste attendu, et une corbeille de plus ne dirait rien
              que ce moins-là ne dise déjà.
            */}
            <div className="flex items-center rounded-lg border border-line bg-surface-raised">
              <IconButton
                icon={Minus}
                /* `productLabel` et non `product.name` : deux compteurs
                   voisins annoncés « Une Blonde de moins » ne se distinguent
                   pas quand la carte porte la 25cl et la 50cl. */
                label={
                  line.quantity === 1
                    ? `Retirer ${productLabel(product.name, product.size)} de la commande`
                    : `Une ${productLabel(product.name, product.size)} de moins`
                }
                onClick={() =>
                  setCartQuantity(venueSlug, line.productId, line.quantity - 1)
                }
              />
              <span
                className="w-8 text-center text-base font-semibold tabular-nums"
                aria-hidden="true"
              >
                {line.quantity}
              </span>
              <IconButton
                icon={Plus}
                label={`Une ${productLabel(product.name, product.size)} de plus`}
                onClick={() =>
                  setCartQuantity(venueSlug, line.productId, line.quantity + 1)
                }
              />
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex items-baseline justify-between gap-4">
        <span className="font-semibold">Total</span>
        <span className="display-title text-xl tabular-nums">
          {formatPrice(total.cents, currency)}
        </span>
      </div>

      {/*
        Les articles sans prix ne sont pas passés sous silence : les taire
        laisserait croire que le total est l'addition complète, et la surprise
        arriverait au comptoir.
      */}
      {total.pending > 0 ? (
        <p className="mt-1 text-sm text-ink-soft">
          {total.pending === 1
            ? '+ 1 article au prix du comptoir.'
            : `+ ${total.pending} articles au prix du comptoir.`}
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="mt-5">
        <TextField
          label="Votre prénom"
          required
          maxLength={60}
          autoComplete="given-name"
          placeholder="Camille"
          surface="page"
          value={guestName}
          onChange={(event) => setGuestName(event.target.value)}
          hint="C’est le nom qu’on appellera au comptoir."
        />

        <TextAreaField
          label={
            <>
              Un mot{' '}
              <span className="font-normal text-ink-soft">(facultatif)</span>
            </>
          }
          className="mt-3"
          rows={2}
          maxLength={300}
          placeholder="Sans glace, à emporter…"
          value={guestNote}
          onChange={(event) => setGuestNote(event.target.value)}
        />

        {place.error ? <ErrorNote>{place.error.message}</ErrorNote> : null}

        <ActionButton
          type="submit"
          icon={Send}
          surface="page"
          className="mt-4 w-full"
          disabled={place.isPending || !guestName.trim() || lines.length === 0}
        >
          {place.isPending ? 'Envoi…' : 'Envoyer au bar'}
        </ActionButton>
      </form>
    </BottomSheet>
  )
}
