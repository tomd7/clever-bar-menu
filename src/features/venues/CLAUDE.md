# Venues — `src/features/venues/`

`components/` (venues-page, venue-list, venue-card, venue-trash, venue-nav, venue-qr,
add-venue-form), `api.ts`, `mutations.ts`, `qr.ts`.

Same feature rules as `features/menu`: a component never calls `supabase` directly (go
through `api.ts`, which maps `camelCase` to the API's `snake_case`), mutations live in
`mutations.ts` and invalidate their own key prefix, read `mutation.error` rather than
mirroring it into `useState`, and **no cross-feature imports**.

## Sidebar — `venue-nav.tsx`

`VenueNav` is a function of its props (`ownerId`, `activeVenueSlug`); `_authenticated.tsx`
composes it, reading the slug with `useParams({ strict: false })` — the layout route has no
`$venueSlug` of its own, and "where are we" is a routing question. `BackOfficeShell` takes
it as a `nav` prop because `src/components/` must not import from `#/features/`.

**The tree never repeats a destination**: the open venue becomes a group label and its
sections (Carte, Stock, QR code) carry the links, while the other venues stay plain links.

**The bin is not in `VenueNav`.** It belongs to the tool rather than to the work, so it
sits in the column's bottom zone (`BackOfficeShell`'s `navFooter`), above the identity and
the sign-out — `VenueTrashRailLink` in `venue-trash-link.tsx`.

Items use `.rail-link`, **not** `.nav-link` — that underline sits 8px below its box and
would land inside the next item of a vertical list.

## Soft delete

`venues.deleted_at` (nullable timestamp) marks a venue as binned; the row, its menu, its
photos and its slug all stay. The policy pair that makes this work is in
`src/db/CLAUDE.md`.

- **The slug stays reserved while binned.** `venues_slug_unique` ignores `deleted_at`. A
  partial index would free the address but make a restore fail when the name was reused —
  a far more confusing failure.
- The public menu needs **no code change**: SSR reads as `anon`, RLS hides the venue, the
  lookup returns nothing and the route already throws `notFound()`.
- `venuesQueryOptions` returns **active and binned together**, and **both screens read
  that one query** — `VenueList` keeps the active ones, `VenueTrash` the binned ones. A
  query of its own for the bin would mean a second cache to invalidate, and restoring
  would not refresh the list behind it. Both filter with `Boolean(venue.deleted_at)`, not
  `!== null`, so a database that hasn't run migration `0005` yet doesn't dump every venue
  into the bin.
- The bin's date comes from the client (`new Date().toISOString()`): PostgREST can't
  express `now()` in an update. Harmless for an archive marker, not for anything billed.
- **Binned venues keep the inert `<code>`** in `VenueTrash` rather than `MenuAddress`:
  their public menu answers 404, a link there would lie.

### Emptying the bin — `purgeArchivedVenues`

The one irreversible action in the back office. It is reached from the bin screen only,
through `DeleteButton labelled`, so it still cannot fire on a first click, and the
confirmation names the count (« Supprimer définitivement 3 établissements ? ») — the
manager who expected one must be able to see it before confirming.

- **The photos go before the row, and the order is not negotiable.** The
  `storage.objects` policies find the owner by joining the path's first segment back to
  `public.venues`; once the venue row is gone the join finds nothing and the files become
  **indestructible** while still being served by the CDN — the bucket is public for reads.
  This is the reverse of the product order, where the row goes first because its venue
  stays. `removeVenuePhotos` (`lib/product-photos.ts`) carries the same warning.
- **A storage failure aborts the purge and surfaces**, unlike `removeProductPhoto` which
  swallows its errors: here the venue is still in the bin, retrying is free and resumes
  where it stopped. Swallowing would leave photos online with no remaining way to remove
  them.
- **The list is re-read from the database, not taken from the screen.** The client's
  cache can be a day old, or from another tab; `ownerId` is all the mutation takes. The
  `delete` then re-checks `deleted_at is not null`, so a venue restored from another
  device between the read and the write is not destroyed by a purge decided on an older
  state.
- The paging in `removeVenuePhotos` deliberately has **no `offset`** — each page is
  deleted before the next is listed, so the next page is always the first. An offset
  walking a shrinking list would skip every other photo. A page that comes back with
  nothing deleted (a policy refusal returns an empty `data`, not an error) raises rather
  than looping forever.
- **The button sits on the title's line from `lg`, under the description below it.**
  The header is a two-column grid at `lg` only — the title and the description share the
  left column so the prose keeps its reading width, and the button takes the right one.
  Below `lg` nothing is repositioned: the DOM order (title, description, button) is
  already the order a single column reads, which happens to put the sentence promising a
  restore before the button that removes it. It keeps its natural width there rather than
  stretching — full width, it would carry the weight of the screen's main action, which
  is « Restaurer ».
- **Nothing optimistic**, unlike the stock counters: the purge crosses storage before the
  database and can take a second, and removing the rows in advance would claim a success a
  storage error would then have to take back.

### The bin is a screen — `/admin/corbeille`

`VenueTrash` is a page, not a section at the bottom of `VenueList`. Unfolded by default it
took as much of the page as the venues actually in service, which is the reverse of what a
manager does there; and a page can be bookmarked, opened in a tab and reached from the
column, where a fold has to be found and unfolded on every visit.

- **Two entry points, both in `venue-trash-link.tsx`, both silent while the bin is
  empty** — nothing should announce an empty screen, and the first deletion makes them
  appear, which is the exact moment the manager needs to learn the bin exists.
  `VenueTrashLink` sits in the venues page **header**, on the title's line: a manager
  looking for the bin has just deleted something, and putting the link under the grid
  would make them scroll past everything still in service. `VenueTrashRailLink` sits at
  the **bottom of the column**, in `navFooter`.
- **Only the header link carries the count.** In the column, Carte / Stock / QR code carry
  none, and a lone number in a list of destinations reads as an alert when there is
  nothing to deal with.
- Both read the count through `select` on `venuesQueryOptions` — same cache as the list
  and the column, one request, and a re-render only when the count itself moves.
- **The separator above the rail link belongs to the link**, not to the shell's zone:
  drawn by the shell it would survive an empty bin and separate the sign-out from nothing.
- **`corbeille` is a reserved slug** (`RESERVED_SLUGS` in `api.ts`). `/admin/corbeille` is
  a static segment and the router puts it before `/admin/$venueSlug`, so a venue with that
  slug would be created without any error and then be unreachable — its public menu
  working, its editor not. Any new static child of `/admin` goes into that set.

## Venue card

The whole surface is clickable through a stretched `after:absolute` pseudo-element on a
link wrapping the **name alone**: the address rendered by `MenuAddress` is itself an `<a>`,
and nesting two anchors is invalid HTML the browser silently repairs by closing the first.

## QR code — `qr.ts`, `/admin/$venueSlug/qr`

**One code per venue**, not per table: the menu is identical everywhere, and a table number
would be inert until something reads it.

`uqr` does the encoding (approved dependency: 0 transitive deps, 77 KB, MIT, runtime
agnostic) and `qr.ts` is the only place that touches it — the choices of `Q` and SVG, and
the measured damage tolerance, are documented in that file. The address it encodes comes
from `src/lib/public-menu-url.ts`, the single place the `/m/<slug>` shape is written.

- **`encode()`'s `size` includes the border.** A 37-module code with a 4-module quiet zone
  reports 45. This cost a wrong test assertion.
- **`isLocalOrigin` guards against printing a `localhost` code** — visually identical to a
  valid one, useless once glued to a table.
- Printing is scoped by `.no-print` (shell, header block, buttons) in `src/styles/print.css`
  and `.print-sheet` in `venue-qr.css`. The sheet forces black-on-white: a QR reader relies
  on contrast.
