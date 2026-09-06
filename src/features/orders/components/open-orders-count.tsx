import { useQuery } from '@tanstack/react-query'

import { isOpenOrder } from '#/features/orders/status'
import { ordersQueryOptions } from '#/features/orders/api'

/**
 * A venue's open-order count, as the back-office column carries it next to
 * « Commandes ».
 *
 * This component lives in `features/orders` and not in `features/venues`,
 * which is what draws the column: counting orders belongs to this domain, and
 * the two features may not import each other. `_authenticated.tsx` therefore
 * assembles them, through `VenueNav`'s `ordersBadge` slot — the same wiring as
 * `productAction` on the customer menu.
 *
 * "Open" means here exactly what it means on the orders screen: received,
 * preparing or ready (`isOpenOrder`). A number that did not match the cards
 * listed under the « En cours » heading would put both in doubt.
 *
 * `select` on `ordersQueryOptions` rather than a query of its own: it is the
 * orders screen's cache — no extra request while you are on it — and the badge
 * only re-renders when the number itself moves, not on every poll. The
 * accepted cost: from the other back-office screens, that queue is now polled
 * every ten seconds. Which is precisely what a counter pinned in a permanent
 * column is for — knowing an order arrived while you were editing a price.
 *
 * Nothing is announced out loud: no `aria-live`. The column is on screen all
 * day, and an announcement on every poll would talk over a manager who is
 * typing. The alert channel already exists and it is elsewhere — the tab
 * title, on the orders screen.
 */
export function OpenOrdersCount({ venueSlug }: { venueSlug: string }) {
  const { data: count } = useQuery({
    ...ordersQueryOptions(venueSlug),
    select: (board) =>
      board.orders.filter((order) => isOpenOrder(order.status)).length,
  })

  /*
    Nothing at zero, and no grey pill in its place: an empty queue has nothing
    to signal, and a permanent « 0 » ends up not being read at all — which is
    exactly what makes the « 1 » get missed.
  */
  if (!count) return null

  return (
    <>
      <span className="orders-count" aria-hidden="true">
        {count}
      </span>
      {/*
        The number alone reads as "Commandes 3" to a screen reader, which means
        nothing. The pill is hidden and the sentence written next to it.
      */}
      <span className="sr-only">, {count} en cours</span>
    </>
  )
}
