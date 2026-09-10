import { ChevronUp, ShoppingBag } from 'lucide-react'
import { useQueries } from '@tanstack/react-query'
import { useState } from 'react'

import { CartSheet } from '#/features/orders/components/cart-sheet'
import {
  GUEST_STATUS_LABEL,
  isOpenOrder,
  mostUrgentStatus,
} from '#/features/orders/status'
import { OrderTracker } from '#/features/orders/components/order-tracker'
import { cartItemCount, cartTotal, useCart } from '#/features/orders/cart'
import { formatPrice } from '#/lib/money'
import { guestOrderQueryOptions } from '#/features/orders/public-api'
import { useTickets } from '#/features/orders/ticket'

import type { OrderStatus } from '#/features/orders/status'
import type { CartProduct } from '#/features/orders/cart'
import type { ReactNode } from 'react'

/**
 * La barre fixée en bas de la carte client.
 *
 * Elle porte **jusqu'à deux lignes, et elles coexistent** : les commandes déjà
 * parties au bar, et le panier qu'on est en train de composer. Ce sont deux
 * états indépendants, pas deux moments du même — un client qui attend ses deux
 * eaux commande une bière derrière, c'est le geste le plus ordinaire d'un
 * comptoir. Il peut donc en avoir plusieurs en vol : la ligne du haut annonce
 * la plus avancée et compte les autres, la feuille les détaille toutes.
 *
 * La première version n'en montrait qu'un à la fois, la commande masquant le
 * panier. Le « + » continuait pourtant de remplir ce panier : on pouvait donc
 * ajouter des produits sans plus aucun moyen de les voir ni de les envoyer. Un
 * état atteignable et invisible, c'est-à-dire le pire des deux.
 *
 * L'ordre des lignes suit le pouce : le suivi, qui est une information, est en
 * haut ; le panier, qui est l'action, est en bas — au plus près de la main.
 *
 * Elle n'existe pas quand il n'y a rien à dire. Une barre vide posée en
 * permanence prendrait de la hauteur de lecture sur l'écran où la carte est
 * justement le plus à l'étroit.
 *
 * ## Le mouvement
 *
 * Elle monte du bas en 200 ms — c'est une réponse à un geste (le premier « + »
 * pressé), pas une arrivée, ce qui la distingue du reste de cette page où rien
 * n'anime. Elle ne rejoue pas cette animation quand une quantité change, ni
 * quand la seconde ligne apparaît : le composant reste monté.
 */
export function OrderBar({
  venueSlug,
  products,
  currency,
}: {
  venueSlug: string
  /** La carte affichée, pour retrouver le nom et le prix d'une ligne. */
  products: Array<CartProduct>
  currency: string
}) {
  const tickets = useTickets(venueSlug)
  const cart = useCart(venueSlug)

  /*
    Les requêtes vivent ici, et non dans la feuille de suivi qui reste fermée la
    plupart du temps : c'est la barre qui doit annoncer « Prête » pendant que le
    client regarde autre chose.

    `useQueries` et non une boucle de `useQuery` : le nombre de commandes suivies
    change au fil de la soirée, et les règles des hooks interdisent d'en appeler
    un nombre variable. Chacune garde son propre rythme de relève — celle qui
    vient d'être récupérée cesse d'être sondée pendant que la suivante continue.
  */
  const orderQueries = useQueries({
    queries: tickets.map((ticket) => guestOrderQueryOptions(ticket)),
  })

  const orders = orderQueries.flatMap((query) =>
    query.data ? [query.data] : [],
  )

  /*
    Le bandeau annonce **ce qui est en cours**, et rien d'autre : une commande
    déjà récupérée n'attend plus rien, la compter ici ferait annoncer au client
    trois commandes quand une seule est à venir. Elle reste consultable dans
    l'onglet Historique de la feuille.

    Quand il ne reste plus rien en cours, c'est la dernière envoyée qui parle —
    « Récupérée », le temps que le client la range. `orders` suit l'ordre
    d'envoi, la plus récente est donc en fin de liste.
  */
  const openOrders = orders.filter((order) => isOpenOrder(order.status))
  const status =
    openOrders.length > 0
      ? mostUrgentStatus(openOrders.map((order) => order.status))
      : orders.at(-1)?.status

  const eyebrow =
    openOrders.length > 1
      ? `Vos commandes (${openOrders.length})`
      : openOrders.length === 0 && tickets.length > 1
        ? 'Vos commandes'
        : 'Votre commande'

  /*
    Un seul panneau ouvert à la fois. Un booléen par feuille laisserait les deux
    s'ouvrir ensemble, et Radix empilerait deux dialogues modaux sur le même
    bord.
  */
  const [panel, setPanel] = useState<'cart' | 'order' | null>(null)

  const hasCart = cart.length > 0
  if (tickets.length === 0 && !hasCart) return null

  /*
    Le remplissage plein ne va qu'à **une** chose à la fois, et à la plus
    urgente. « Prête » est le seul état qui demande au client de se lever : il
    prend l'aplat, et le panier repasse alors en surface calme. Sinon c'est le
    panier — la seule action disponible — qui l'a. Deux aplats côte à côte, et
    plus rien ne ressort.
  */
  const orderIsUrgent = status === 'ready'

  const priceOf = new Map(
    products.map((product) => [product.id, product.price_cents]),
  )
  const total = cartTotal(cart, (productId) => priceOf.get(productId))

  return (
    <>
      <BarShell>
        {tickets.length > 0 ? (
          <StatusRow
            status={status}
            eyebrow={eyebrow}
            filled={orderIsUrgent}
            onOpen={() => setPanel('order')}
          />
        ) : null}

        {hasCart ? (
          <CartRow
            count={cartItemCount(cart)}
            totalCents={total.cents}
            currency={currency}
            filled={!orderIsUrgent}
            onOpen={() => setPanel('cart')}
          />
        ) : null}
      </BarShell>

      <CartSheet
        open={panel === 'cart'}
        onOpenChange={(open) => setPanel(open ? 'cart' : null)}
        venueSlug={venueSlug}
        products={products}
        currency={currency}
      />

      {tickets.length > 0 ? (
        <OrderTracker
          open={panel === 'order'}
          onOpenChange={(open) => setPanel(open ? 'order' : null)}
          venueSlug={venueSlug}
          tickets={tickets}
          currency={currency}
        />
      ) : null}
    </>
  )
}

/** Les commandes en cours, et où en est la plus avancée. */
function StatusRow({
  status,
  eyebrow,
  filled,
  onOpen,
}: {
  status: OrderStatus | undefined
  /** Composé par `OrderBar` : le compte ne porte que sur ce qui est en cours. */
  eyebrow: string
  filled: boolean
  onOpen: () => void
}) {
  return (
    <BarRow filled={filled} onClick={onOpen}>
      <span className="min-w-0 flex-1">
        <span className="block text-xs opacity-70">{eyebrow}</span>
        <span className="block truncate font-semibold">
          {/*
            `aria-live` : le client ne regarde pas forcément l'écran quand le
            bar passe la commande en « Prête », et c'est exactement le moment
            où il faut le prévenir.
          */}
          <span aria-live="polite">
            {status ? GUEST_STATUS_LABEL[status] : 'Envoyée'}
          </span>
        </span>
      </span>
      <ChevronUp className="size-5 shrink-0" aria-hidden="true" />
    </BarRow>
  )
}

/** Le panier en cours de composition. */
function CartRow({
  count,
  totalCents,
  currency,
  filled,
  onOpen,
}: {
  count: number
  totalCents: number
  currency: string
  filled: boolean
  onOpen: () => void
}) {
  return (
    <BarRow filled={filled} onClick={onOpen}>
      <ShoppingBag className="size-5 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1 font-semibold">
        {count === 1 ? '1 article' : `${count} articles`}
        {/*
          Le total est en second et plus discret : ce que le client reconnaît
          d'un coup d'œil, c'est le nombre de choses qu'il a ajoutées. Le
          montant, il l'ouvre pour le vérifier.
        */}
        {totalCents > 0 ? (
          <span className="ml-2 font-normal tabular-nums opacity-80">
            {formatPrice(totalCents, currency)}
          </span>
        ) : null}
      </span>
      <span className="shrink-0 text-sm font-semibold">Commander</span>
    </BarRow>
  )
}

/**
 * La forme commune aux deux lignes.
 *
 * Une seule implémentation pour que les deux fassent exactement la même hauteur
 * et le même enfoncement : empilées, deux boutons qui ne réagissent pas pareil
 * se voient immédiatement.
 */
function BarRow({
  filled,
  onClick,
  children,
}: {
  filled: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        filled
          ? 'flex w-full items-center gap-3 rounded-xl bg-primary px-4 py-3 text-left text-primary-foreground transition-transform duration-150 ease-(--ease-out) active:scale-[0.98]'
          : 'flex w-full items-center gap-3 rounded-xl border border-line bg-surface-raised px-4 py-3 text-left transition-transform duration-150 ease-(--ease-out) active:scale-[0.98]'
      }
    >
      {children}
    </button>
  )
}

/**
 * L'habillage de la barre.
 *
 * Opaque, jamais translucide : le texte de la carte qui défile dessous doit
 * disparaître, pas transparaître — c'est le même raisonnement que pour le rail
 * des sections.
 *
 * `env(safe-area-inset-bottom)` : sur un iPhone, la barre d'accueil mange les
 * derniers pixels de l'écran, et c'est précisément là que se trouve le bouton.
 *
 * The inner column reads `--menu-column`, the same token as the card above it:
 * the bar spans the viewport, its content stays on the card's axis.
 */
function BarShell({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] duration-200 ease-(--ease-out) animate-in fade-in-0 slide-in-from-bottom-4">
      <div className="mx-auto flex w-full max-w-(--menu-column) flex-col gap-2 px-4 py-3 sm:px-6">
        {children}
      </div>
    </div>
  )
}
