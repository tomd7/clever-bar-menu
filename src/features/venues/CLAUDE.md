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
- `venuesQueryOptions` returns **active and binned together**; `VenueList` splits them. It
  filters with `Boolean(venue.deleted_at)`, not `!== null`, so a database that hasn't run
  migration `0005` yet doesn't dump every venue into the bin.
- The bin's date comes from the client (`new Date().toISOString()`): PostgREST can't
  express `now()` in an update. Harmless for an archive marker, not for anything billed.
- **Binned venues keep the inert `<code>`** in `VenueTrash` rather than `MenuAddress`:
  their public menu answers 404, a link there would lie.

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
