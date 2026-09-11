# Menu — `src/features/menu/`

Owns the back-office menu editor, the stock screen and the customer-facing menu:
`components/` (menu-editor, category-\*, product-\*, menu-nav, public-menu),
`api.ts`, `public-api.ts`, `mutations.ts`, `price.ts`, `size.ts`, `photo.ts`, `stock.ts`,
`barcode.ts`, `scanner.ts`.

**No cross-feature imports**: this feature must not reach into `features/venues` or
`features/orders`. Anything two need moves down to `src/components/` or `src/lib/` — that is
why `describeError` is in `lib/postgrest-error.ts`, the `/m/<slug>` shape in
`lib/public-menu-url.ts`, `formatPrice` in `lib/money.ts` and `MENU_QUERY_KEY` in
`lib/query-keys.ts` (which `features/orders` invalidates when accepting an order decrements
stock).

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

## Sizes — `size.ts`

`products.size`, free text, nullable — « 25cl », « 50cl », « au fût », « pichet ».

- **One size per product, not a list of formats.** Two sizes of the same beer are two
  products, exactly as a printed carte lists them. Carrying several on one line would mean
  a table of its own with its own RLS, a cart that points at a format rather than at a
  product, and a rewritten `place_order` — for a menu that reads the same either way.
- **Free text, and it stays free.** `SIZE_SUGGESTIONS` is what the form offers in one tap,
  not what the column accepts: a bar's formats are its own (a « demi », a « pichet 50cl », a
  4cl measure), and a closed list would have to be redeployed the day one is missing. The
  chips toggle — tapping the active one clears the field, which is the only way to empty it
  without going back to the keyboard.
- **Blank is `null`, like a blank price**, and `parseOptionalSize` is the single place that
  says so. An empty string would render as a phantom gap after every name.
- **Nothing parses it.** « 50cl » is not a quantity here, and the moment the field parsed
  one it would owe an answer for « au fût », which has none.
- **The display lives in `components/product-size.tsx`**, not here: the cart, the counter's
  queue and the customer's tracker all render a size, and `features/orders` may not import
  from this feature. `productLabel(name, size)` is its text form, for the `aria-label`s
  where « Ajouter Blonde » on two adjacent buttons says nothing.
- **The size is copied onto the order line** (`order_items.size`, migration `0013`), like
  the name and the unit price. See `features/orders/CLAUDE.md`.

## Photos — `photo.ts`

`photo.ts` is now three thin functions over `lib/venue-images.ts`, which holds the
mechanics since the venue's logo needed them too and `features/venues` may not import from
here. What stays in this file is what a photo asks for: a 1200px side and a JPEG fallback.

- **Downscaled in the browser** before upload (canvas, WebP first). The fallback is taken
  when the browser hands back anything but WebP — **not** when it hands back a type the
  bucket refuses: a browser without a WebP encoder silently returns PNG, which the bucket
  accepts, so the older test let those browsers upload every photo as a much heavier PNG.
  `imageOrientation: 'from-image'` applies the EXIF rotation — without it, photos taken
  sideways arrive lying down.
- **File names are random, never derived from the product id.** Replacing a photo must
  write a new path: public URLs are CDN-cached, and reusing a path keeps serving the old
  image.
- **Storage has no cascade.** Deleting a product removes its file after the row; deleting
  a category collects its products' paths _before_ the DB cascade wipes them. Order
  matters: an orphan file is invisible, a row pointing at a deleted file shows a broken
  image to a customer.
- **The bucket's name lives in `lib/venue-images.ts`, not here.** `features/venues` puts
  the logo in the same folder and wipes the whole folder when the bin is emptied, so two
  features address the same bucket and only one module may own its name. That module also
  documents why a venue's images must go **before** its row, which is the reverse of the
  order above — the storage policies find the owner by joining the path's first segment to
  `venues` — and why that folder must stay flat.
- **The picker is `ImageField`** (`src/components/form/`), moved down from here for the
  logo. The form resolves the preview URL itself (`useObjectUrl` for a picked file,
  `productPhotoUrl` otherwise).

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
- **The stock page lists a product only if it has a level, and either a threshold or a
  zero** (`isWatched`). The quantity says there is something to count down; the threshold
  is how a manager designates the lines they want to be warned about — without one, a row
  could never say anything on a page read to find out what to re-order. **Sold out is the
  exception**, threshold or not: at zero the product has left the customer menu, and this
  is the screen that repairs that. Hiding a rupture because nobody asked to be warned
  about it is the one thing this page must not do. Restocking such a product drops it back
  out of the list — it becomes again a line nobody asked for news of, and its level is set
  from its card in the menu editor; the page's footer counts those and links there.
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

## Barcodes — `barcode.ts`, `scanner.ts`, `/admin/$venueSlug/stock/scan`

`products.barcode` plus a scan screen, for the one moment the stock page serves badly: a
delivery. Counting a crate of 24 on the stock page means 24 round-trips through a 40-product
list.

- **Manufacturer codes (EAN/UPC), not labels we print.** Nothing to produce, nothing to
  stick on a shelf, and the code is already on the bottle. The cost is a pairing gesture the
  first time a code is met, and that gesture lives in the scan screen — never on the product
  form.
- **Everything normalizes through `barcode.ts` before anything else happens.** A UPC-A and
  its EAN-13 spelling are the same bottle written two ways; stored raw, that bottle pairs
  twice and neither pairing resolves. The canonical form is a zero-padded 14-digit GTIN, and
  the GS1 check digit is verified rather than trusted — on a camera read it costs nothing, on
  a typed one it is what makes a mistyped digit fail under the thumb instead of pairing a
  code no bottle carries. Same relationship to `products_barcode_format` that `stock.ts` has
  to `products_stock_quantity_non_negative`.
- **`scanner.ts` is the only file that knows how a barcode is read**, and it holds two
  decoders behind one function. The browser's own `BarcodeDetector` where it exists — Chrome
  on Android, ChromeOS, Chrome on macOS — and **ZXing-C++ in WebAssembly everywhere else**,
  which in practice means every iPhone: all iOS browsers are WebKit, and WebKit never
  shipped Shape Detection. Firefox and Chrome on Windows or Linux are in the same case.
  - The fallback is a **ponyfill of the same API** (`barcode-detector`), which is why the
    two branches differ by how they are obtained and by nothing else. This is what the
    asynchronous factory was for from the first version: the swap cost an `import()` in
    `createScanner` and no change anywhere else.
  - It is **lazy**: a phone with the native detector fetches none of it. A phone without
    pays ~430 Ko (brotli) once, on this screen alone — nothing reaches the customer menu.
  - The `.wasm` is **served from our own origin**. `zxing-wasm` defaults to a public CDN at
    run time, which would put a third party between a manager and their stock count; over
    cellar wifi that is a failure mode, and it is an outgoing request nobody asked for.
    Vite's `?url` import hashes the binary into the build and `locateFile` points at it.
    The library's own jsDelivr URL is still in the chunk as a dead default — verify by
    watching the network, not by grepping the bundle.
  - `isCameraAvailable()` is now the only thing asked before the first render, and it is
    about the **camera**, not the decoder: `navigator.mediaDevices` is undefined outside a
    secure context, which is exactly what testing from a phone on `http://192.168.x.x`
    gives you — the API does not fail, it is simply absent.
  - `SCAN_FORMATS` excludes UPC-E on purpose, and the reason is `barcode.ts`, not the
    decoder: its check digit is computed over the expanded UPC-A, so `normalizeBarcode`
    would reject every one of them — read, then silently dropped, which looks exactly like
    a broken camera.
- **A code resolves against the menu just read, never through a `where barcode = ?`.** No
  index to create, no enumeration opened to whoever holds the publishable key, no round-trip
  — and one property a query would not give for free: scoped to the open venue, a manager
  with two bars cannot decrement the other one's beer.
- **An unknown code triggers a refetch before it is called unknown.** The client-side
  uniqueness check is unsound on its own: device A's cache does not know about the pairing
  device B just made, so A would offer to pair the same code again and two products would
  carry it. One round-trip on the cold path, none on the hot one — and the trigger of
  migration `0015` is what actually holds the invariant.
- **The journal records what moved, not what was asked.** `adjust_product_stock` floors at
  zero, so a sortie of 10 against a stock of 3 moves 3; undoing the requested −10 would
  create seven bottles. `adjustProductStock` therefore returns the resulting level (it always
  had it), and « Annuler » is offered only where something actually moved.
- **Direction and quantity are chosen per movement, not once per session.** A persistent
  Entrée/Sortie mode at the top of the screen goes wrong silently — 24 bottles put away as
  exits is a 48-unit error — and it forced one pass per unit in front of the lens, slower
  than typing the number. The panel shows the direction next to the product's name and level
  and states the resulting level _before_ validation; that reading is the safeguard.
- **No barcode field on the product form.** It would inherit exactly the hazard documented
  above for `stockQuantity` — another screen writing the column while a card is open — for
  the price of a `useRef` snapshot and a third `undefined` state. Correcting a wrong pairing
  happens where it is noticed instead: « Ce n'est pas ce produit ? » in the movement panel.
- **The way in is a button on the stock page, and there is no sidebar link.**
  `BackOfficeShell` renders its nav under `hidden lg:block` — the column exists only on
  desktop, the machine with no usable camera and, on Windows or Linux, no `BarcodeDetector`
  at all.

## Customer menu — `public-api.ts`, `components/public-menu.tsx`

`/m/$venueSlug` is the only SSR'd route with data (see `src/routes/CLAUDE.md`).

- **`fetchPublicMenu` is deliberately not `fetchMenu`**: it filters `is_available` **and**
  an exhausted `stock_quantity` **in the query** — a hidden product must never reach the
  browser — and drops categories left empty. It lives in this feature because a separate
  one would have to import `VenueNotFoundError` and `CategoryWithProducts` from it.
- **It names its columns; it does not `select('*')`.** This payload is server-rendered
  _and_ dehydrated into the page, so every extra column travels twice to a phone on mobile
  data — and it is read as `anon`, which is the real argument: `owner_id` has no business
  in a public page and `barcode` names the item on the shelf, which is counter information,
  not menu information. `is_available`, `stock_quantity` and `position` are absent from the
  columns even though the query uses them: they filter and order **server-side**. The
  payload types are `Pick`s on the shared rows (`PublicVenue`, `PublicProduct`,
  `PublicCategory`), so a renamed column breaks here instead of drifting.
- **`features/orders` declares its own `CartProduct`** — a `Pick` on the shared row, in
  `cart.ts` — rather than importing this feature's product type. Structural typing makes
  the public payload satisfy it, and the cross-feature import stays forbidden. The day the
  carte stops serving one of those four columns, the break lands there.
- **The page is drawn as an object, not as a document.** An opaque sheet (`.island-shell`)
  topped by a `--board` panel carrying the venue name in chalk. **`--board` is no longer
  always the house slate**: `PublicMenu`'s root element carries `data-menu-theme` from
  `venues.theme`, and `styles/menu-theme.css` repaints the board and the accents for
  everything under it. The ground and the surfaces do not move, so this page keeps the
  contrast it was designed with whatever a venue picks. Server-rendered from the loader's
  data, so the board is never seen in the house colour first — see `src/styles/CLAUDE.md`
  for the two token traps that make the override work.
- **The venue's logo heads the board**, on a row of its own above « La carte », through
  `VenueLogo` (`src/components/venue-logo.tsx`). Above the kicker rather than beside the
  name: a title set at 4xl keeps its width, and a long wordmark cannot push it onto a third
  line. Not `loading="lazy"` — it is in the first screen read. `fetchPublicMenu` names
  `logo_path` and `logo_plate` among its columns.
- **Each content element names its typeface** in `data-menu-face`, from
  `parseMenuFonts(venue)`: the venue title, the category headings, the product lines (name,
  size, price) and every description. The house face writes no attribute, so a carte that
  never changed its fonts renders exactly as before. Reading lines also carry `.menu-text`,
  which `styles/menu-fonts.css` uses to keep Archivo's x-height. All of it is in the SSR'd
  HTML, `m.$venueSlug.tsx` preloads the title face when it isn't Archivo, and
  `fetchPublicMenu` names the four `font_*` columns. See `src/styles/CLAUDE.md`.
- **The order bar, the cart sheet and the 404 stay on the house palette, on purpose.**
  `OrderBar` is a sibling of `<PublicMenu>` in the route, and `BottomSheet` portals to
  `document.body`, so no wrapper here could reach it anyway; the 404 has no venue and
  therefore no theme. Full-bleed on the phone (a
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
- **`PublicMenu` exposes a `productAction` slot** and knows nothing about what fills it.
  Counter ordering puts its `+` there, and the assembly happens in `m.$venueSlug.tsx` — the
  one file allowed to import both features, exactly as `_authenticated.tsx` passes
  `<VenueNav>` to `BackOfficeShell`. `undefined` is the normal case, and the layout is then
  unchanged.
- **With an action, a photo-less product in a section that reserves a photo column renders an
  explicit empty `<div>`.** `null` produces no element, and grid auto-placement would slide
  the action into the image column — the prices on photo-less rows would stop lining up,
  which is precisely what the reserved column exists to prevent. `itemLayout()` holds the
  four cases flat rather than nesting ternaries at the call site.
