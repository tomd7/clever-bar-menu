# Orders — `src/features/orders/`

Counter ordering: the customer orders from the scanned menu, gives a first name, and
collects at the bar. **No online payment** — nothing here carries card data, and nothing
should.

`cart.ts`, `ticket.ts`, `status.ts` (domain), `api.ts` (bar side), `public-api.ts` (customer
side), `mutations.ts`, `components/`. Screens: `/admin/$venueSlug/commandes` for the bar, and
a fixed bar at the bottom of `/m/$venueSlug` for the customer.

**No cross-feature imports**, and this feature is what made the rule bite. See the two
sections below on what had to move down as a result.

## Security — read this before touching `place_order`

**The customer is `anon`, and `orders` / `order_items` carry no policy for `anon` at all.**
Everything the customer does goes through two `security definer` functions (migration
`0009`), which are the only door:

- `place_order(venue_slug, guest_name, guest_note, items)` — validates and inserts.
- `get_order(lookup_id, lookup_token)` — reads one order back.

This is the **opposite** choice from `adjust_product_stock` (`security invoker`), and
deliberately: there, RLS had to apply to an identified account; here, a caller with no
rights must not be given any.

Invariants that hold the design up:

- **The line copies the product's format too** (`order_items.size`, migration `0013`), next
  to its name and unit price. Same reason as the rest — a line is a trace, and the product
  will be renamed and re-sized — plus one of its own: « Blonde » twice on a ticket, once in
  25cl and once in 50cl, is a ticket the counter has to guess at. It is read back through
  `get_order` and rendered by `components/product-size.tsx`, the shared piece this feature
  and `features/menu` both draw a size with.
- **Nothing with a consequence comes from the browser.** The client sends product ids and
  quantities. Names, unit prices and the total are re-read from the database inside
  `place_order`. A total sent by the client is a total open to negotiation, and this
  function is reachable by anyone holding the publishable key — that is, by everyone.
- **`venues.orders_enabled` is checked in SQL too**, not only to hide a button. A menu left
  open in a tab must not keep sending after the bar closes.
- **Availability is re-checked at insert time** — `is_visible` (the menu's filter), then
  `is_available` and a non-zero `stock_quantity` (`isSoldOut`, the menu's « épuisé »), as
  of migration `0023`. The displayed menu may be ten minutes old.
- **A dropped line fails the whole order.** If a requested product is no longer orderable,
  `place_order` raises rather than inserting a shortened order. Serving an amputated order
  would make the customer discover the gap at the counter, which is the worst possible
  moment.
- **The browser keeps a _list_ of tickets, not one.** Sending a second order used to
  overwrite the first, which then vanished from the customer's screen while sitting perfectly
  well in the bar's queue. `addTicket` appends; `forgetTickets` removes the ones filed away.
  `sanitize` still accepts the **old single-object shape** and reads it as a one-element
  list — without that tolerance, every customer with an order in flight at deploy time would
  have lost sight of it.
- **The access token never appears in a URL** — no path, no search param, no fragment. An
  address gets copied, shared and logged; a secret that lives in one stops being one. It
  travels in the request body, to `get_order`, and is kept in `localStorage`.
- **A lost ticket is lost for good, and that is the design working.** `get_order` needs the
  token, the token is returned exactly once — by `place_order` — and nothing on the customer
  side can ask for it again; that is precisely what stops one customer reading another's
  order. The owner can still read `orders.access_token` through PostgREST, so a lost order is
  recoverable _by hand_ for testing, but no screen does it and none should.

  The consequence is a rule, not a caveat: **every write to the ticket list must append, and
  every read must keep understanding the shapes previously written** (see `addTicket` and
  `sanitize`). Both have already been broken once — an overwriting `saveTicket` — and the
  orders that lost their ticket are still sitting in the bar's queue, invisible to the phone
  that placed them, with no way back.

- **A wrong token returns `null`, not an error.** An error saying "wrong token" would confirm
  the order exists, and tell whoever is guessing ids which ones are worth pursuing.
- **`OrderRow` in `lib/supabase.ts` deliberately omits `access_token`.** The back office has
  no use for the customer's secret; keeping it out of the type is what stops it being
  rendered, logged or dehydrated into a cache by accident.

**Known gap: there is no rate limiting on `place_order`.** It is an unauthenticated insert
endpoint open to the internet. The per-line (20) and per-order (40 lines) caps limit what a
single call can write, and nothing limits how many calls arrive. If this becomes a problem
the answer is a limit at the edge, not a policy.

## Cancelling

Both sides can cancel, and the two are not symmetric.

- **The customer can cancel only while the order is still `received`.** Past acceptance the
  stock is down and the glass is being poured; letting a phone trigger that from across the
  room would open, in the inventory, exactly the gap the Stock screen exists to close. Before
  acceptance nothing has moved — neither stock nor glass — so the customer's window is
  precisely the one where cancelling is free. `cancel_order` enforces it in SQL, not only by
  hiding a button: the tracker can be fifteen seconds behind the counter.
- **The button disappears rather than greying out** once the bar has taken the order. A
  greyed button says a path exists.
- **The counter can cancel at any point**, and that one does not credit stock back — see
  below.
- **`orders.cancelled_by`** records which of the two it was (`'guest'` / `'venue'`, `null`
  otherwise). Without it a line would vanish from the bar's queue with no explanation, and a
  barman who did not touch it assumes a colleague misfired and goes asking. `setOrderStatus`
  writes `null` on every other transition, so an order moved back out of `cancelled` does not
  keep a signature for a cancellation that no longer happened.
- **The race is settled by the row, not by a check.** `accept_order` and `cancel_order` both
  filter `status = 'received'` inside the `where`. The counter's finger and the customer's
  can land in the same millisecond; one wins, and the other reads a message that was already
  written for it.

## Stock — accepting is the pivot

`accept_order(target_id)` moves the order to `preparing` **and** decrements stock, in one
transaction. Two reasons it is a function and not two writes from the browser: they must
land together, and decrementing ten lines would otherwise be ten round trips, some of which
could fail in the middle.

- It is **`security invoker`**: no ownership check is written inside it, because
  `orders_owner_update` and `products_owner_update` do that. An order belonging to someone
  else simply comes back not found.
- The status filter (`and o.status = 'received'`) is in the `where`, not in a prior test:
  two bar screens accepting the same order cannot decrement twice, the locked row decides.
- **Stock comes down when the bar accepts, not when the customer sends.** An order arrives
  anonymously from a QR code displayed in the room; decrementing on send would let anyone
  empty an inventory from the pavement. The accepted trade-off is that two customers can
  order the last bottle before the bar arbitrates.
- **Cancelling does not credit stock back.** An order cancelled after acceptance has often
  been half poured, and putting the levels back would invent bottles nobody has. The gesture
  stays with the manager, on the Stock screen, which is made for it. The confirmation
  popover says so.

## What had to move down

`features/orders` writes to tables it does not read, which is what forced two moves. Both
follow the existing rule — what two features need belongs to neither:

- **`lib/query-keys.ts`** now holds `MENU_QUERY_KEY` and `VENUES_QUERY_KEY`. Accepting an
  order decrements stock (stale menu); opening ordering writes `venues.orders_enabled` (stale
  venue list). The project rule is still "a key lives with its query function" — this file is
  the named exception, and it explains itself. `PUBLIC_MENU_QUERY_KEY` and
  `GUEST_ORDER_QUERY_KEY` stayed home, because only one feature invalidates them.
- **`lib/money.ts`** now holds `formatPrice`. The cart, the tracker and the order card all
  render sums, and none of them may import `features/menu`. Parsing what a manager types
  (`parseOptionalEurosToCents`, `centsToInput`) stayed in `features/menu/price.ts`: that is
  one screen's gesture, displaying is everyone's.

`VenueNotFoundError` is written **twice**, here and in `features/menu/api.ts`. Sharing it
would mean either a cross-feature import or a domain object in `lib/`, and neither is worth
saving eight lines.

## Cart and ticket — why a module store

`cart.ts` and `ticket.ts` each hold a module-level store read through
`useSyncExternalStore`, not a React context.

- **Two distant components read the cart**: the `+` on every product row, and the bottom
  bar. Their only common parent is the route, and `PublicMenu` — which sits between them —
  belongs to `features/menu` and must know nothing about orders. A context would mean
  wrapping the whole menu in a provider for state the menu ignores.
- **The store starts empty on both sides, and `hydrateCart` fills it after mount.**
  `/m/$venueSlug` is server-rendered: if `getSnapshot` read `localStorage`, the first client
  render would differ from the received HTML and React would throw the whole hydration away.
  The cart appears one frame later; hydration never breaks. The same applies to the ticket.
- `getSnapshot` must return a **stable reference** — hence the shared `EMPTY` constant. A
  fresh `[]` per call makes `useSyncExternalStore` loop.
- Every `localStorage` access is wrapped: private browsing, a full quota or disabled storage
  all throw. Losing the cart is annoying; losing the order screen is not acceptable, and the
  second must not follow the first.
- What comes out of storage is **sanitised, not trusted**: a malformed line is dropped, not
  repaired.

## The customer screen

- **The order slot is composed at the route.** `PublicMenu` exposes `productAction`, the
  route fills it with `AddToCartButton`, and `src/routes/m.$venueSlug.tsx` is the one file
  allowed to know both features. Same assembly as `_authenticated.tsx` passing `<VenueNav>`
  to `BackOfficeShell`.
- **A sold-out product is on the menu but not in the cart's catalogue.** `PublicMenu` does
  not call `productAction` for it, and `m.$venueSlug.tsx` leaves it out of the `products`
  handed to `OrderBar`. The cart sheet drops a line it cannot resolve — which is what a
  product that ran out while in the cart should do, rather than stay drawn as orderable
  until `place_order` refuses the send.
- **When a section reserves a photo column, a product without a photo renders an explicit
  empty `<div>`.** Not cosmetic: `null` produces no element, and grid auto-placement would
  slide the action into the image column — prices would stop lining up on photo-less rows,
  which is exactly what the reserved column exists to prevent.
- **The bottom bar stacks up to two rows, and they coexist**: the order in flight on top,
  the cart being composed below. They are independent states, not two moments of one — a
  customer waiting on two waters orders a beer behind, which is the most ordinary gesture at
  a counter. It renders nothing when there is nothing to say.

  The first version showed only one at a time, the order hiding the cart, **which was a
  bug**: the `+` kept filling that cart, so products could be added with no way left to see
  or send them. Reachable and invisible is the worst of the two. If you ever collapse these
  rows again, disable the `+` at the same time — or the same hole reopens.

  The row order follows the thumb: the tracker, which is information, on top; the cart,
  which is the action, at the bottom, nearest the hand. `PublicMenu`'s bottom reserve
  (`pb-36`) is sized for **two** rows, not for the common single-row case: that page cannot
  know which is showing, and erring long leaves a little space after the last category where
  erring short hides a product behind an opaque band.

- **It animates, unlike the rest of that page.** The menu deliberately has no entry
  animation; the bar is a _response to a gesture_ (the first `+` pressed), which is the
  distinction the rule draws. It does not replay when a quantity changes — the component
  stays mounted.
- **Exactly one thing takes the filled treatment at a time, and it is the most urgent.**
  « Prête » is the one state that asks the customer to stand up, so it takes the fill and the
  cart row goes quiet; otherwise the cart — the only available action — has it. Two filled
  rows stacked, and neither stands out. The « Prête » label carries `aria-live="polite"` for
  the same reason it takes the fill.
- **The tracker queries run in `OrderBar`, not in the sheet**, which is closed most of the
  time: the bar is what has to say « Prête » while the customer is looking elsewhere.
  `useQueries` over the ticket list, not a loop of `useQuery`: the number of tracked orders
  changes through the evening and the rules of hooks forbid a variable count. Each keeps its
  own polling rhythm — one just collected stops being polled while the next carries on. The
  sheet runs the same `useQueries`; identical keys, so one cache and no duplicate calls.
- **The status row announces the most advanced order and counts only what is still in
  progress** (`mostUrgentStatus` over open orders). The bottom band has room for one state,
  and « Prête » wins because it is the only one that asks the customer to stand up. A
  collected order is not counted there — announcing three orders when one is still coming
  reads as three things to wait for. When nothing is open any more, the most recently sent
  one speaks (« Récupérée »), long enough for the customer to file it away.
- **The sheet splits into « En cours » and « Historique »** (Radix `Tabs`, already available
  through the `radix-ui` package — keyboard arrows, `aria-selected` and `aria-controls` for
  free). A collected order has nothing left to wait for; leaving it in the same list meant
  re-reading statuses to find the one that mattered. The split **only appears when there is
  something to file** — a first order in progress shows on its own, with no tab bar to read.
  Clearing history lives in that tab, since that is what it acts on.
- **The default tab is derived, not frozen at mount.** The sheet is mounted long before the
  orders load, so a `useState` initial value would always compute against an empty list.
  `chosenTab` is `null` — "let the screen decide" — until the customer picks one, and resets
  to `null` on close so a reopen lands where there is something to see.
- **An emptied tab stays empty rather than switching.** The last order turning « récupérée »
  under the customer's eyes must not move them to another tab under their finger; the same
  reasoning that keeps the stock list from re-sorting.
- **Each block in the sheet carries the first name, not the status hint.** Two orders in the
  same state would print the same sentence twice, where what tells them apart is precisely
  the name each will be called under. The hint stays as the sheet's subtitle, and only when
  there is a single order to give one for.
- **One panel open at a time** (`'cart' | 'order' | null`). A boolean per sheet would let
  both open and stack two modal dialogs on the same edge.
- **`BottomSheet` is built on Radix `Dialog`** (already present via the `radix-ui` package):
  focus trap, Escape, scroll lock and portal — four things a `position: fixed` div does not
  have and that you only notice once broken. It lives in this feature rather than
  `components/ui/`, which is reserved for what the shadcn CLI regenerates; it moves down the
  day a second domain wants one.

## The bar screen

- **A queue, not a dashboard.** It re-polls every 10s (`ordersQueryOptions`) and stops when
  the tab goes to the background — React Query's default, and the right one here: nobody
  reads a queue they are not looking at, and returning to the foreground triggers an
  immediate poll.
- **The two lists run in opposite orders, on purpose.** _En cours_ puts the oldest first —
  that is the order you serve in, and putting the longest wait at the bottom of the screen is
  the best way to forget it. _Historique_ puts the newest first, because you only scroll
  there to check something that just happened.
- `open.slice().reverse()` — the copy matters: reversing React Query's cached array in place
  would flip the history's order every other render.
- **One query, `limit(100)`, split client-side.** Two queries (open unbounded, closed capped)
  would be more exact and double the traffic of a screen that refreshes every ten seconds.
  What the cap costs: past a hundred recent orders the tail of the history drops. What it
  does not cost: an open order cannot vanish without a hundred arriving after it.
- **The count in the sidebar is a second channel, and it counts something else.**
  `OpenOrdersCount` (`components/open-orders-count.tsx`) puts a badge next to « Commandes »
  in the back-office column, so a manager editing a price sees an order arrive without
  leaving the screen. It counts **open** orders — `isOpenOrder`, the same set the screen's
  « En cours » section lists — because a number that did not match the cards under that
  title would put both in doubt. The tab title below counts only what is _not yet
  accepted_: the title is an alert, the badge is a state of the queue.

  It reads `ordersQueryOptions` through `select`, so on this screen it costs nothing, and
  it renders `null` at zero rather than a grey « 0 » — a permanent zero stops being read,
  which is exactly what makes the « 1 » missed. `features/venues` draws the column but may
  not import this feature: `VenueNav` takes an `ordersBadge` slot and `_authenticated.tsx`
  fills it. The consequence to know: from any back-office screen the queue is now polled
  every ten seconds, which is the point of a counter in a permanent column. There is
  deliberately **no `aria-live`** on it — the column is on screen all day, and an
  announcement on every poll would talk over a manager typing.

- **The waiting count goes into the tab title.** It is the only channel available — a counter
  tablet shows something else half the time, and a background tab can display nothing but its
  title. Only orders **not yet accepted** count; the ones being prepared are already in
  someone's hands.
- **The open/closed switch lives on this screen**, not in a settings page that does not
  exist. Closing at the end of service is a daily gesture, not a preference.
- **Cancelling uses `DeleteButton`** with `icon={Ban}` and `confirmLabel` — the project's one
  two-step destructive control. Those two props exist so the gesture can be named correctly;
  duplicating the confirmation would duplicate the focus-on-« Annuler » invariant, which no
  type would tell you had broken.

## Deliberately absent

- **No table numbers.** The QR code stays one per venue and the first name is the order's
  reference: it gets called out loud, which a number does badly. `venues/CLAUDE.md`'s note —
  "one code per venue, a table number would be inert until something reads it" — still holds,
  because nothing reads one.
- **No sale-time decrement beyond acceptance**, no partial fulfilment, no order editing after
  send, and no retention policy: `orders` has no `delete` policy, and history grows. A purge
  belongs with a retention decision nobody has made.
- **No `preparing` → `received` step back.** A mistaken acceptance is cancelled, not undone,
  because the stock has already moved.
