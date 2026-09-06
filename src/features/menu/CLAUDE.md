# Menu — `src/features/menu/`

Owns the back-office menu editor, the stock screen and the customer-facing menu:
`components/` (menu-editor, category-\*, product-\*, menu-nav, public-menu, photo-field),
`api.ts`, `public-api.ts`, `mutations.ts`, `price.ts`, `photo.ts`, `stock.ts`.

**No cross-feature imports**: this feature must not reach into `features/venues`. Anything
both need moves down to `src/components/` or `src/lib/` — that is why `describeError` is
in `lib/postgrest-error.ts` and the `/m/<slug>` shape in `lib/public-menu-url.ts`.

## Data access

- **A component never calls `supabase` directly.** Every read and write goes through
  `api.ts` / `public-api.ts`, which is also where `camelCase` meets the API's `snake_case`
  (`priceCents` → `price_cents`).
- **Mutations live in `mutations.ts` and invalidate their own query.** A component calls
  `useRenameCategory()`, never `useMutation` on a raw API function. The hooks invalidate
  the key _prefix_ (`MENU_QUERY_KEY = ['menu']`, not `['menu', venueSlug]`) precisely so no
  component needs to know the slug.
- **Read `mutation.error`, don't mirror it into `useState`.** React Query already holds
  the error, clears it when the next mutation starts, and exposes `reset()` for a cancel
  button.
- **Writes go through `write()` in `api.ts`**, a one-line helper that reads `error` and
  raises `describeError(error)`, so a mutation added later can't surface a raw English
  PostgREST message in the UI.
- **A missing venue is a `VenueNotFoundError`, and `menuQueryOptions` does not retry it.**
  The database answered — it answered "nothing". Worse, React Query pauses retries while
  the document is hidden, so a background tab would sit on « Chargement… » indefinitely.
  Everything else keeps the default three attempts.
- **`fetchMenu` runs three queries instead of one embedded select.** PostgREST can embed
  (`select('*, products(*)')`) but typing that needs relationship metadata our
  hand-written `Database` doesn't carry. Revisit if the menu grows large.
- **Ordering** uses a `position` column stepping by 100, leaving room to insert between two
  neighbours without rewriting the list. `swapPositions` does two sequential updates, not a
  transaction — PostgREST exposes none. A failure between them leaves two equal positions,
  which the `(position, name)` ordering resolves deterministically.

## Prices — `price.ts`

- **Nullable.** `null` means "no price shown" (dish of the day, market price); `0` is a
  valid free item. Never collapse the two — `parseOptionalEurosToCents` returns `null`
  only for a blank field. The back office renders "Prix non renseigné" rather than an
  empty gap; the customer menu renders **nothing** (that label is addressed to the
  manager, showing it to a customer would expose an omission).
- The UI takes euros, the DB stores integer cents, and `price.ts` is the only place that
  converts. It parses decimals as _text_ rather than multiplying a float — `1.10 * 100` is
  `110.00000000000001` in JS. Accepts comma or dot, strips whitespace (`\s` covers
  non-breaking spaces).

## Photos — `photo.ts`

- **Downscaled in the browser** before upload (canvas, max 1200px, WebP with a JPEG
  fallback). `imageOrientation: 'from-image'` applies the EXIF rotation — without it,
  photos taken sideways arrive lying down.
- **File names are random, never derived from the product id.** Replacing a photo must
  write a new path: public URLs are CDN-cached, and reusing a path keeps serving the old
  image.
- **Storage has no cascade.** Deleting a product removes its file after the row; deleting
  a category collects its products' paths _before_ the DB cascade wipes them. Order
  matters: an orphan file is invisible, a row pointing at a deleted file shows a broken
  image to a customer.
- **The bucket's name lives in `lib/product-photos.ts`, not here.** `features/venues`
  wipes a venue's whole folder when the bin is emptied, so two features address the same
  bucket and only one of them may own its name. That module also documents why a venue's
  photos must go **before** its row, which is the reverse of the order above — the storage
  policies find the owner by joining the path's first segment to `venues`.

## Stock — `stock.ts`, `/admin/$venueSlug/stock`

`products.stock_quantity` and `products.low_stock_threshold` (both nullable integers) plus
the `adjust_product_stock` function.

- **`null` means "not tracked", and it is the default.** Most lines of a bar's menu have
  no finite stock over a service. `0` means _sold out_ and hides the product, so the two
  must never be collapsed: `parseOptionalStock` returns `null` for a blank field, exactly
  like `parseOptionalEurosToCents`.
- **Sold-out is derived, never written.** `is_available` stays the manager's manual
  gesture; a zero stock hides the product through a query filter, and a restock brings it
  back with no further action. The rule is stated twice — `isHiddenFromCustomers` here and
  `.or('stock_quantity.is.null,stock_quantity.gt.0')` in `fetchPublicMenu` — because it
  applies on both sides of the wire. **They change together**, and the `is null` half is
  not optional: a naive `gt.0` empties the menu of every untracked product.
- **The decrement goes through the RPC, the level set through a plain `update`.** `−1` is
  _relative_: read-then-write from the browser loses one tap in two the day the manager's
  phone and the counter's tablet serve at once. Typing a level is _absolute_ — last one
  wins, which is what's wanted. `greatest(..., 0)` floors it inside the statement; the
  `products_stock_quantity_non_negative` check is the backstop, not the mechanism.
- **The stock mutations are optimistic** (`useOptimisticProductMutation`), and that is not
  polish: a counter that waits for a round-trip behind a bar gets tapped twice. It patches
  every `['menu']` query by prefix, cancels in-flight fetches first, rolls back on error,
  and invalidates `onSettled` rather than `onSuccess`, because the rolled-back value may
  itself be stale.
- **The stock page reads `menuQueryOptions`, not a query of its own.** Stock is the same
  menu seen through the quantity column. A second query would mean a second cache to
  invalidate, and a `−1` here wouldn't show on the menu open in the next tab.
- **The list is in menu order and never re-sorts.** Sorting by urgency would lift a row
  away at the very moment a thumb presses its `−1`. Urgency lives in the header band
  instead, which holds **shortcuts only** — the counter for a product exists exactly once,
  in the list.
- **Low stock is carried by words, not by colour** — the theme has no warning token on
  purpose. `StockBadge` writes « Plus que 2 » / « 12 en stock »; only _épuisé_ takes the
  destructive tint, because the product has left the menu.
- The product form's stock fields sit **below a rule**, under a « Suivi de stock » kicker.
- **The form only writes a stock column the manager actually touched.** Stock is the one
  part of a product another screen changes while a form is open; saving a typo fix in a
  description must not restore the level the field held when the form was drawn.
  `ProductDraft.stockQuantity` is therefore `number | null | undefined`, `undefined`
  meaning "leave the column alone" — it disappears from the payload because
  `JSON.stringify` drops undefined properties. The comparison is against a `useRef`
  snapshot taken at mount, **not** against the props: those move when the counter
  decrements, and comparing to them would read an untouched field as an edit.

## Customer menu — `public-api.ts`, `components/public-menu.tsx`

`/m/$venueSlug` is the only SSR'd route with data (see `src/routes/CLAUDE.md`).

- **`fetchPublicMenu` is deliberately not `fetchMenu`**: it filters `is_available` **and**
  an exhausted `stock_quantity` **in the query** — a hidden product must never reach the
  browser — and drops categories left empty. It lives in this feature because a separate
  one would have to import `VenueNotFoundError` and `CategoryWithProducts` from it.
- **The page is drawn as an object, not as a document.** An opaque sheet (`.island-shell`)
  topped by a `--board` panel carrying the venue name in chalk. Full-bleed on the phone (a
  frame and two margins would only eat the reading width on the screen this page is
  actually read on), a sheet laid on the ground from `sm:` up.
- **Never put `overflow-hidden` on that sheet.** It is the obvious way to clip the board
  panel's corners, and it turns the sheet into a scroll container — `MenuNav` then sticks
  to nothing. The panel rounds itself instead, at the sheet's radius minus its 1px border.
- **Nothing animates on entry.** The content is already in the SSR'd HTML; fading it in
  would only delay a reading the customer asked for by scanning. Same argument rules out a
  full-screen cover: the board panel stays compact so the first category is reachable. The
  page's only movements — the rail's highlight, a chip's `active:scale-[0.97]` — answer an
  action, not an arrival.
- **`MenuNav` is a sticky table of contents, and it appears only from three categories up**
  (`NAV_MIN_CATEGORIES`). Below that everything fits in a screen. The highlight follows an
  `IntersectionObserver` band (`rootMargin: '-25% 0px -65% 0px'`), not the last chip
  clicked: a customer scrolls by hand too. Sections carry `scroll-mt-24` so an anchor lands
  _below_ the rail. Known limit, the one every anchor nav has: on a short menu the last
  section cannot reach the top, so tapping it highlights whatever the band actually holds.
  Half a viewport of padding would fix it and would put a hole at the end of a menu.
- **The leader rule (`.menu-leader`) fills the line between a name and its price.** The
  printed-carte convention, functional before decorative: the eye crosses the gap without
  dropping a line. A product with no price gets no leader — there is nothing to lead to.
- **The photo column is reserved per section, not per row**, as soon as one product in it
  carries a photo, and it sits on the **right**. Thumbnails on the left indented only the
  illustrated products and turned the menu's left edge into a staircase; on the right
  without a reserved column, those rows' leaders shorten and the prices stop lining up —
  and the price column is the one a customer reads down. Empty space to the right of an
  unillustrated product is invisible; an empty frame to its left is not. Rows are centred
  on that column: most products have neither price nor description, and a top-aligned row
  left the name stranded above 80px of nothing.
- **The category description is rendered here** (`categories.description`) — the only
  editorial text a manager can put on this page. Note the back-office forms don't expose
  the field yet: it is writable through `createCategory` alone.
- **The back-to-top link appears only where the rail does.**
