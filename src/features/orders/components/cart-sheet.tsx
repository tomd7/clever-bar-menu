import { Minus, Plus, Send } from 'lucide-react'
import { useEffect, useState } from 'react'

import { ActionButton } from '#/components/buttons/action-button'
import { BottomSheet } from '#/features/orders/components/bottom-sheet'
import { ErrorNote } from '#/components/error-note'
import { IconButton } from '#/components/buttons/icon-button'
import { ProductSize, productLabel } from '#/components/product-size'
import { Skeleton } from '#/components/skeleton'
import { TablePicker } from '#/features/orders/components/table-picker'
import { TextAreaField } from '#/components/form/textarea-field'
import { TextField } from '#/components/form/text-field'
import { cartTotal, setCartQuantity, useCart } from '#/features/orders/cart'
import { chooseTable, useChosenTable } from '#/features/orders/table'
import { formatPrice } from '#/lib/money'
import { tableName } from '#/lib/order-settings'
import { usePlaceOrder } from '#/features/orders/mutations'

import type { FormEvent } from 'react'
import type { CartProduct } from '#/features/orders/cart'
import type { OrderSettings } from '#/lib/order-settings'
import type { PublicTable } from '#/features/orders/public-api'

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
 *
 * **What the form asks depends on the venue.** By name — the default — a
 * required first name, exactly as before tables existed. By table, the table
 * instead (« Table 12 »), or the picker when it is not known, plus an optional
 * first name if the venue asks for one. Hiding the name field closes nothing:
 * `place_order` re-checks every rule of both modes.
 *
 * **A table named by the scanned code is fixed.** The sheet shows it with no
 * « Changer »: the code is stuck on the table the customer is sitting at, and a
 * picker one tap away is how an order ends up across the room. « Changer » only
 * exists for a table picked by hand.
 */
export function CartSheet({
  open,
  onOpenChange,
  venueSlug,
  products,
  currency,
  orderSettings,
  tables,
  tablesError,
  urlTableId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  venueSlug: string
  /** La carte affichée, pour retrouver le nom et le prix d'une ligne. */
  products: Array<CartProduct>
  currency: string
  orderSettings: OrderSettings
  /** The venue's tables, in table mode; `undefined` while they load. */
  tables: Array<PublicTable> | undefined
  tablesError: Error | null
  /** The `?table=` of the scanned code, already shape-checked by the route. */
  urlTableId: string | undefined
}) {
  const cart = useCart(venueSlug)
  const place = usePlaceOrder(venueSlug)
  const chosenTable = useChosenTable(venueSlug)

  const [guestName, setGuestName] = useState('')
  const [guestNote, setGuestNote] = useState('')

  /*
    Whether the picker stays open. It opens by itself while no table is known;
    once one is chosen it stays open until the sheet closes, because arrow keys
    choose as they move and a picker collapsing under them would lose the
    keyboard. « Changer » opens it on purpose — for a table picked by hand only.
  */
  const [pickingTable, setPickingTable] = useState(false)

  const byTable = orderSettings.reference === 'table'
  const asksName = !byTable || orderSettings.firstName === 'optional'

  /*
    A table is only known if its id is one of this venue's tables: an id from
    a deleted table's code, or from another venue's tab, resolves to nothing and
    the picker shows — never an error page.

    The code's table wins over the one kept for the visit, and is resolved here
    rather than read from the store: `OrderBar` writes it there only once the
    list has loaded, and the sheet must not offer « Changer » in between.
  */
  const resolveTable = (publicId: string | null | undefined) =>
    byTable && publicId
      ? (tables?.find((entry) => entry.public_id === publicId) ?? null)
      : null
  const codeTable = resolveTable(urlTableId)
  const table = codeTable ?? resolveTable(chosenTable)
  const tableFixed = codeTable !== null

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
      guestName: asksName ? guestName.trim() || null : null,
      guestNote: guestNote.trim() || null,
      guestTable: table?.public_id ?? null,
      items: cart.map((line) => ({
        productId: line.productId,
        quantity: line.quantity,
      })),
    })
  }

  const canSend =
    !place.isPending &&
    lines.length > 0 &&
    (byTable ? table !== null : guestName.trim() !== '')

  return (
    <BottomSheet
      open={open}
      onOpenChange={(next) => {
        /* A reopened sheet shows the chosen table, not the picker left open. */
        if (!next) setPickingTable(false)
        onOpenChange(next)
      }}
      title="Votre commande"
      description={
        orderSettings.service === 'table'
          ? 'On vous l’apporte à votre table.'
          : 'Elle se règle au comptoir, en venant la chercher.'
      }
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
        {byTable ? (
          <div className="mb-4">
            {tables === undefined ? (
              tablesError ? (
                <ErrorNote className="mt-0">{tablesError.message}</ErrorNote>
              ) : (
                /* The chips' own height, so nothing below jumps when they land. */
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                  {[0, 1, 2, 3].map((index) => (
                    <Skeleton
                      key={index}
                      className="h-11 w-full"
                      delay={index * 40}
                    />
                  ))}
                </div>
              )
            ) : tables.length === 0 ? (
              <p
                role="status"
                className="rounded-lg bg-surface-raised px-3 py-2 text-sm"
              >
                Cet établissement n’a pas encore enregistré ses tables :
                demandez au comptoir.
              </p>
            ) : table && (tableFixed || !pickingTable) ? (
              /*
                `min-h-13` is the row's height with its « Changer »: a fixed
                table reads as the same card, not a shorter one.
              */
              <div
                className={`flex min-h-13 items-center justify-between gap-3 rounded-lg border border-line bg-surface-raised py-1 pl-3 ${tableFixed ? 'pr-3' : 'pr-1'}`}
              >
                <div className="min-w-0">
                  <p className="text-xs text-ink-soft">Votre table</p>
                  <p className="display-title truncate text-lg leading-tight">
                    {tableName(table.number, table.label)}
                  </p>
                </div>
                {tableFixed ? null : (
                  <ActionButton
                    variant="ghost"
                    surface="page"
                    onClick={() => setPickingTable(true)}
                    aria-label={`Changer de table (actuellement ${tableName(table.number, table.label)})`}
                  >
                    Changer
                  </ActionButton>
                )}
              </div>
            ) : (
              <TablePicker
                tables={tables}
                value={table?.public_id ?? null}
                onChoose={(publicId) => {
                  chooseTable(venueSlug, publicId)
                  setPickingTable(true)
                }}
              />
            )}
          </div>
        ) : null}

        {!byTable ? (
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
        ) : asksName ? (
          <TextField
            label={
              <>
                Votre prénom{' '}
                <span className="font-normal text-ink-soft">(facultatif)</span>
              </>
            }
            maxLength={60}
            autoComplete="given-name"
            placeholder="Camille"
            surface="page"
            value={guestName}
            onChange={(event) => setGuestName(event.target.value)}
            hint={
              orderSettings.service === 'table'
                ? 'Pour qu’on vous reconnaisse à la table.'
                : 'Pour qu’on vous reconnaisse au comptoir.'
            }
          />
        ) : null}

        <TextAreaField
          label={
            <>
              Un mot{' '}
              <span className="font-normal text-ink-soft">(facultatif)</span>
            </>
          }
          className={asksName ? 'mt-3' : undefined}
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
          disabled={!canSend}
        >
          {place.isPending ? 'Envoi…' : 'Envoyer au bar'}
        </ActionButton>
      </form>
    </BottomSheet>
  )
}
