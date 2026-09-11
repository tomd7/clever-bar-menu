# Clever Bar Menu

**English** · [Français](README.fr.md)

A digital menu for bars and cafés: customers scan a QR code on the table and read the
up-to-date menu on their phone, with no app to install. The manager edits categories,
products and prices from a back office.

**The project is written entirely with [Claude Code](https://claude.com/claude-code)**, and
that is in fact its point: to see how far a complete product — deployed, usable by a real
bar — can be taken without a single line being typed by hand. The application code, the
schema and its migrations, the RLS policies, the CSS, the tooling and the documentation,
this README included, all come from it. The human role is one of commissioning, arbitrating
and reviewing.

![Status](https://img.shields.io/badge/status-live-brightgreen)
![Built with Claude Code](https://img.shields.io/badge/built%20with-Claude%20Code-d97757)

## Live

**<https://bar-menu.tom-depasse.be>**

|                      | Address                                          |
| -------------------- | ------------------------------------------------ |
| Public menu (sample) | <https://bar-menu.tom-depasse.be/m/chez-lambert> |
| Back office          | <https://bar-menu.tom-depasse.be/login>          |
| Demo account         | `demo@cbm.be` / `demo`                           |

A venue's menu lives at `/m/<slug>` — that is the address the QR code on the tables
encodes.

> [!NOTE]
> The demo account is **shared and public**: whatever you change there is visible to other
> visitors, and the demo venue can be reset without notice. Don't put anything real in it.
> The reset is `npm run db:seed:demo`, which empties its menu and its history, then refills
> them with a fictional set (see "[Scripts](#scripts)").

> [!IMPORTANT]
> The product is in production, but development continues: see the [roadmap](#roadmap) for
> what is still missing. Sign-up is closed — manager accounts are created by the platform
> administrator (see "[Creating accounts](#creating-accounts)").

## Contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Development process](#development-process)
  - [Automated gates](#automated-gates)
- [Project structure](#project-structure)
  - [Adding a UI component](#adding-a-ui-component)
- [Under the hood](#under-the-hood)
  - [Back office](#back-office)
    - [Stock tracking](#stock-tracking) — [barcode scanning](#barcode-scanning)
    - [Counter ordering](#counter-ordering)
    - [Creating accounts](#creating-accounts)
    - [Deleting a venue](#deleting-a-venue)
  - [QR code](#qr-code)
  - [Public menu](#public-menu)
- [Roadmap](#roadmap)
- [Scripts](#scripts)

## Features

- **Public menu behind a QR code** — every table points at the venue's menu, readable on a
  phone, with no install and no account.
- **Management back office** — create and edit categories, products, prices, descriptions
  and photos; a product that has run out can be hidden in one click.
- **Stock tracking** — enabled product by product, with an alert threshold and a page built
  to be held standing behind the bar. A product that runs out leaves the customer menu and
  comes back on its own when restocked.
- **Counter ordering** — the customer builds a cart from the scanned menu, leaves a first
  name, and follows the order through to "ready". The bar sees it arrive in a queue that
  refreshes itself. **No online payment**: settlement happens at the counter, and no
  banking data travels. Closed by default on every venue, to be opened from the orders
  screen.
- **Multi-venue** — a single deployment hosts several bars. A manager owns as many as they
  want, each with its own menu, public address and QR code. Isolation is carried by
  Postgres: a manager only sees and edits their own venues. A venue, on the other hand, has
  **a single owner** — several accounts on one bar remain to be done.
- **Barcode scanning** — stock movements in and out are entered in front of the camera,
  from the phone. Works on every browser, iPhone included.
- **Light/dark theme** — the "evening bar" theme follows the setting of the phone scanning
  the QR code, with no switch and no cookie. A multilingual menu is on the
  [roadmap](#roadmap), not here yet.
- **Per-venue theme** — each venue picks the theme of its public menu from
  `/admin/<slug>/reglages`. It repaints the header panel and the accents; the page ground
  and the surfaces stay the house palette, so prices and descriptions keep the contrast
  they were designed with. Every venue starts on « Ardoise », the house board.
- **Venue logo** — uploaded from the same settings screen, it heads the public menu's
  board. The browser shrinks it before upload and guesses whether a dark logo needs a light
  plate to stay legible on the board; the manager can flip that, and sees the result in
  both the day and the night preview.
- **Per-venue typefaces** — the venue title, the category headings, the product lines and
  the descriptions each take a face from a curated list of nine, chosen from the same
  settings screen and previewed day and night. Faces are served from the application's own
  domain, not from Google, and a menu downloads only the ones it uses.

## Tech stack

| Area         | Choice                                                                                 |
| ------------ | -------------------------------------------------------------------------------------- |
| Framework    | [TanStack Start](https://tanstack.com/start) (SSR) + [React 19](https://react.dev)     |
| Routing      | [TanStack Router](https://tanstack.com/router) (routes generated from `src/routes/`)   |
| Client cache | [TanStack Query](https://tanstack.com/query)                                           |
| Forms        | [TanStack Form](https://tanstack.com/form) + [Zod](https://zod.dev)                    |
| Persistence  | [Supabase](https://supabase.com) (Postgres) + [Drizzle ORM](https://orm.drizzle.team)  |
| UI           | [Tailwind CSS 4](https://tailwindcss.com) + [shadcn/ui](https://ui.shadcn.com) (Radix) |
| Build        | [Vite 8](https://vite.dev)                                                             |
| Server       | [Nitro](https://nitro.build)                                                           |
| Language     | TypeScript                                                                             |

> [!NOTE]
> Persistence is a Postgres hosted on Supabase. Supabase was chosen because it also covers
> back-office authentication and product photo storage. **Application queries leave from the
> browser** through `supabase-js` (PostgREST), and it is RLS that carries isolation between
> venues; **Drizzle only serves the schema and the migrations**, never runtime.

## Development process

All the code comes from Claude Code, but none of it lands there by chance: every feature
follows the same cycle, from idea to deployment. The dev decides and reviews; Claude frames,
writes and verifies.

| Step                        | Who      |
| --------------------------- | -------- |
| Feature idea                | The dev  |
| Framing the idea            | Together |
| Issue in the Linear backlog | Claude   |
| Development on a branch     | Claude   |
| Verification                | Claude   |
| Pull request to `develop`   | Claude   |
| Code review                 | The dev  |
| Merge and deployment        | The dev  |

1. **The idea starts with the dev.** A need from the bar, a gap spotted in use, a line from
   the [roadmap](#roadmap).
2. **It is developed with Claude Code**, in conversation: scope, edge cases, consequences on
   the schema and on RLS, alternatives ruled out. This is the step that turns a sentence
   into a describable feature — and sometimes the one that shrinks it, or drops it.
3. **Claude creates the issue in the Linear backlog**, with what the framing produced:
   intent, scope, acceptance criteria.
4. **Claude develops.** The issue moves to "In Progress", a `feat/<issue-ID>` branch (or
   `fix/<ID>` for a fix) is cut from `develop` — for instance `feat/CLOCLO-5` — and the
   commits follow the `type(scope): description` convention.
5. **Claude verifies its own work** before opening anything. The project carries no test
   framework: verification is the [automated gates](#automated-gates) — Prettier, ESLint and
   `npx tsc --noEmit` — plus a pass through the real application, at mobile size first.
6. **Claude opens the pull request to `develop`** (through `gh`) and moves the issue to
   "In Review".
7. **The dev reviews.** This is the project's checkpoint: nothing is merged without having
   been read. Remarks go back to Claude, which fixes on the same branch.
8. **The PR is merged into `develop`**, then **`develop` is merged into `main`**, which
   triggers the deployment on Vercel.

`develop` is the integration branch, `main` is what is live. No development happens directly
on either.

### Automated gates

Three hooks hold the baseline without depending on anyone's memory — two Claude Code hooks
(`.claude/settings.json` → `.claude/hooks/`) and one git hook (`.githooks/`, enabled by
`postinstall`):

| Hook                   | When                                 | Effect                                                       |
| ---------------------- | ------------------------------------ | ------------------------------------------------------------ |
| `hooks/format-file.sh` | after each file Claude writes        | `prettier --write`, then `eslint --fix` on JS/TS             |
| `hooks/typecheck.sh`   | when Claude ends its turn            | `npx tsc --noEmit`; an error blocks and is handed back to it |
| `.githooks/pre-commit` | on every `git commit`, the dev's too | Prettier `--check` + ESLint on staged files, then `tsc`      |

The git hook looks only at staged files, refuses the commit on failure, and
`git commit --no-verify` is the deliberate way out. Formatting, linting and types are
therefore guaranteed; the rest — architecture, UI rules, conventions — is still held by
review.

## Project structure

Code is grouped **by business domain**, not by technical kind: a feature owns its screens,
its queries and its rules in one directory.

```
src/
├── routes/          # File-based routes (TanStack Router)
│   ├── __root.tsx   # HTML shell, providers and devtools
│   ├── index.tsx    # Landing page (marketing, not the menu)
│   ├── login.tsx    # Sign in
│   ├── m.$venueSlug.tsx        # Public menu, server-rendered
│   ├── _authenticated.tsx      # Auth guard + back-office shell
│   └── _authenticated/         # Back-office screens, `ssr: false`
├── features/        # One directory per domain: components, `api.ts`, `mutations.ts`
│   ├── auth/        # Sign in and error translation
│   ├── menu/        # Categories, products, prices, photos, stock, public menu
│   ├── orders/      # Customer cart, sending, tracking, bar queue
│   └── venues/      # Venues, trash, QR code
├── components/      # Shared between features: ui/ (shadcn), buttons/, form/,
│                    # back-office/ (shell), home/ (landing page)
├── db/
│   ├── schema.ts    # Data model + RLS policies
│   ├── client.server.ts # Drizzle connection — migrations only
│   └── migrations/  # Generated by drizzle-kit — never edit by hand
├── integrations/    # Providers (TanStack Query)
├── lib/             # Domain-free: supabase.ts, money.ts, query-keys.ts,
│                    # postgrest-error.ts, venue-images.ts, public-menu-url.ts, utils.ts
├── env.ts           # Client environment variables
├── env.server.ts    # Server environment variables
├── router.tsx       # Router configuration
├── routeTree.gen.ts # Generated — never edit by hand
├── styles.css       # Entry point: assembles `@import`s and nothing else
└── styles/          # Theme, bare elements, shared vocabulary, motion, print

scripts/
└── seed-demo.ts     # Resets and refills the demo venue
```

Dependencies point one way — `routes/` → `features/` → `components/` and `lib/` — and **a
feature never imports another**: what two features share moves down a level. When two
domains must be assembled, the route does it. A component never calls `supabase` directly:
everything goes through its feature's `api.ts`.

The CSS follows the same split as the code: `src/styles/` carries what belongs to the whole
application, and **a component's style lives in a `.css` next to it**
(`components/nav-link.css`, `features/menu/components/public-menu.css`…). `src/styles.css`
is only their table of contents, in cascade order.

Files suffixed `.server.ts` are refused at compile time if they are imported from client
code. That matters here: route `loader`s are **isomorphic** and also run in the browser, so
any data access must go through a `createServerFn`.

The `#/*` alias points at `./src/*`: prefer `import { cn } from '#/lib/utils'` over relative
paths. Only `scripts/` is an exception, and out of constraint: it is run by `node` alone,
which rejects a specifier starting with `#/`.

### Adding a UI component

```bash
npx shadcn@latest add dialog
```

## Under the hood

The three surfaces of the product — what a manager edits, what is printed on the table, and
what a customer reads — and the decisions behind each.

### Back office

The back office lives under `/admin`, behind Supabase authentication (email + password).
Data access happens **from the browser** through `supabase-js`, and it is RLS that
guarantees a manager only sees their own venues.

Back-office routes are `ssr: false`: the Supabase session is kept in the browser, so
evaluating it during server rendering would conclude "not signed in" on every request. The
public menu, by contrast, is server-rendered — it is a page reached by scanning a QR code,
and its first paint matters.

| Route                          | Role                                                     |
| ------------------------------ | -------------------------------------------------------- |
| `/login`                       | Sign in                                                  |
| `/admin`                       | The manager's venues, and venue creation                 |
| `/admin/corbeille`             | Deleted venues, and restoration                          |
| `/admin/$venueSlug`            | Menu editing: categories, products, prices, availability |
| `/admin/$venueSlug/stock`      | Stock tracking: levels, alerts, decrements               |
| `/admin/$venueSlug/stock/scan` | Stock movements at the camera, by barcode                |
| `/admin/$venueSlug/qr`         | Printable QR code sheet                                  |
| `/admin/$venueSlug/commandes`  | Order queue and history                                  |
| `/m/$venueSlug`                | **Public menu** — the page the QR code points at         |

Prices are entered in euros and stored as **whole cents**
([`src/features/menu/price.ts`](src/features/menu/price.ts)): input accepts a comma as well
as a period, and decimals are read as text rather than multiplied as floats — `1.10 * 100`
is `110.00000000000001` in JavaScript.

**Photos** are uploaded to the Supabase Storage bucket `product-photos`, publicly readable
(the menu loads from a QR code, and a public URL goes through the CDN) but writable only by
the venue's owner. They are resized in the browser before upload — 1200 px on the longest
side, in WebP.

The price is **optional**: an empty field means "no price shown", for a dish of the day or a
market rate. That is distinct from `0`, which remains a valid price for something on the
house.

A product's **size** — "25cl", "50cl", "on tap", "pitcher" — is a free-text field, optional
as well. The form offers the common formats as chips without closing the list: a bar's
formats are its own. Two sizes of the same beer are **two products**, as on a printed menu,
and the format reads right after the name, before the leader line running to the price. It
is copied onto the order line when the order is sent: two "Blonde" on one ticket, one 25cl
and one 50cl, would otherwise be a ticket you have to guess at.

The order of categories and products is carried by a `position` column, stepping by 100 so
that a row can be inserted between two neighbours without rewriting the list. A product that
has run out stays in the manager's menu, struck through, and is hidden on the customer side.

#### Stock tracking

Tracking is enabled **product by product**, by filling in a remaining stock on its form. An
empty field means "not tracked", and that is the normal case: a coffee or a draught beer
isn't counted at the scale of a service. An optional alert threshold flags a low stock
before it runs out.

`/admin/$venueSlug/stock` gathers the tracked products, in menu order, with a counter per
row: "−1" during service, entering the level at delivery. A banner at the top gives
shortcuts to whatever needs attention. The list itself never reorders — sorting by urgency
would move a row up at the very moment a finger presses its "−1".

Two design points are worth knowing:

- **Running out is inferred, never written.** `is_available` stays the manager's manual
  gesture; a stock at zero hides the product from the public menu through a query filter,
  and restocking brings it back with no intervention. Actually flipping the column would
  force reactivating every product by hand after a delivery, and would overwrite a decision
  taken for an entirely different reason along the way.
- **The decrement goes through a Postgres function**, `adjust_product_stock` (migration
  `0007`). PostgREST cannot write `stock_quantity = stock_quantity - 1`: without it the
  browser would have to read and then write, and two devices behind the same bar would lose
  one decrement out of two. It is also the intended hook for table ordering.

##### Barcode scanning

`/admin/<slug>/stock/scan` enters movements in front of the camera: you scan, you choose
"in" or "out", the quantity applies to the product. An unknown code offers to **pair** it
with the matching product, once — after which the bottle is recognized.

- **Every incoming code is normalized to GTIN-14**
  ([`src/features/menu/barcode.ts`](src/features/menu/barcode.ts)), check digit verified.
  The same can carries a 12-digit UPC-A in the United States and an EAN-13 in Europe: stored
  raw, those two strings would pair the same product twice. Keyboard entry goes through the
  same path as the camera — two paths that disagree about this disagree in production.
- **Two decoders behind a single API.** The browser's `BarcodeDetector` where it exists;
  otherwise a ZXing-C++ compiled to WebAssembly, loaded **on demand on this screen alone**
  (~430 KB, never served to the public menu). That is what makes the screen work on iPhone,
  where WebKit never implemented the Shape Detection API.
- **The `.wasm` is served from our own origin**, not from the public CDN `zxing-wasm`
  targets by default: a third party standing between a manager and their inventory, on a
  cellar's wifi, is one more failure mode.

#### Counter ordering

The customer adds products from the scanned menu, opens the cart in a sheet rising from the
bottom of the screen, gives a first name and sends. They then follow the order's state on
the same page, with no account: **received → in preparation → ready**. The first name is the
reference — it is what gets called out at the counter, which a number does badly.

The customer can **cancel themselves**, as long as the bar hasn't taken the order on. Past
that point the stock is decremented and the glass is being poured: cancelling is still
possible, but at the counter. A cancelled order records which of the two parties did it.

On the bar's side, `/admin/$venueSlug/commandes` shows the queue, oldest first, and picks
itself up every ten seconds. Three gestures: **Accept** (which decrements stock), **Ready**,
**Picked up** — plus a two-step cancellation. The number of orders not yet accepted appears
in the tab title, the only place a background tab can show anything.

Three design points explain the rest:

- **An anonymous order never touches the table.** The customer is `anon` and `orders` opens
  no policy to them, not even for reading. Everything goes through two `security definer`
  Postgres functions (migration `0009`): `place_order` validates and inserts, `get_order`
  reads back. **Nothing with a consequence comes from the browser** — the client sends
  product ids and quantities, prices and totals are re-read in the database.
- **Tracking hangs on a secret token**, kept in the browser and sent in the request body,
  never in a URL. Without it, following an order by its id alone would let you read your
  neighbour's by changing one digit. The browser keeps **a list** of them: ordering a second
  round while the first arrives doesn't erase the first. Tracking files them into two tabs —
  "In progress" and "History" — so that an order already picked up doesn't clutter what is
  still being waited on.
- **Stock goes down on acceptance, not on sending.** An order arrives anonymously from a QR
  code displayed in the room: decrementing on send would let an inventory be emptied from
  the pavement. In exchange, two customers can order the last bottle before the bar
  arbitrates.

One known limit: **`place_order` is not rate-limited**. It is an unauthenticated write entry
point, open to the internet. The caps per line (20) and per order (40 lines) bound what one
call can write; nothing bounds the number of calls.

#### Creating accounts

**There is no open sign-up.** Access is created by the platform administrator from
**Authentication → Users → Add user** in the Supabase dashboard (tick _Auto Confirm User_,
otherwise the manager will have to confirm their address before being able to sign in).

> [!IMPORTANT]
> Removing the sign-up form from the interface closes nothing. The `/auth/v1/signup`
> endpoint stays reachable directly with the publishable key, which is by design present in
> the browser bundle. What actually closes sign-up is the **Authentication → Sign In /
> Providers → Allow new users to sign up** setting, to be turned off in the dashboard.
>
> To check the project's real state, without changing anything:
>
> ```bash
> curl -s "$VITE_SUPABASE_URL/auth/v1/settings" -H "apikey: $VITE_SUPABASE_ANON_KEY"
> ```
>
> `disable_signup` must be `true`.

#### Deleting a venue

Deletion is **soft**: the row stays in the database with its menu, its photos and its slug,
marked by a date in `deleted_at`. The venue goes into a **trash** from which it can be
restored exactly as it was.

What Postgres guarantees, and not just the code:

- **A deleted venue's public menu stops answering** — the public read policy requires
  `deleted_at is null`, so `/m/<slug>` returns a 404 even if a query forgot the filter.
- **Its owner keeps seeing it**, thanks to a second read policy. Without it, deleting a
  venue would make it invisible to its own manager, hence impossible to restore.
- **Other managers don't see it**, nor can they restore it.

> [!NOTE]
> The slug stays reserved as long as the venue is in the trash: `venues_slug_unique` ignores
> archiving. A partial constraint would free the address, at the price of a restoration that
> would fail if the name had been taken in the meantime.

### QR code

`/admin/<slug>/qr` produces the code to print and put on the tables. It encodes the menu's
public URL, and it is **one single code for the whole venue**: the menu is identical at
every table, and telling tables apart would add nothing as long as no feature reads that
number.

- **SVG output**, not PNG: the code ends up printed at a size the manager chooses, from a
  coaster to a poster. A vector stays sharp everywhere.
- **Error correction `Q`**, one notch above the default, because the object is physical.
  Measured with Chrome's decoder: the code stays readable up to **15% of its surface
  covered** by an opaque stain, and fails at 20%.
- **A warning appears if the address is `localhost`.** A code generated in development
  encodes `localhost`: printed and stuck on the tables, it leads nowhere, and nothing
  visually distinguishes it from a valid code.
- `Cmd+P` prints the sheet and nothing else: navigation, buttons and the theme's background
  disappear (`.no-print` in `src/styles/print.css`, `.print-sheet` next to the screen, in
  `src/features/venues/components/venue-qr.css`).

### Public menu

`/m/<slug>` is the page meant for customers: it opens by scanning the QR code on the table,
with no account and no install. It is **server-rendered** — the HTML leaves complete and the
menu is readable before JavaScript has even been evaluated, which counts on the mobile
network of a seated customer.

Three behaviours to know:

- **Unavailable products are dropped in the query**, not at render: they never leave the
  server. Two independent causes drop them — availability turned off by hand, and an
  exhausted stock. A category whose products have all gone disappears as well.
- **A product without a price shows nothing** — not "No price set", which is a message meant
  for the manager. That is what a printed menu does for a dish of the day.
- **An unknown address answers a real 404**, not an error page with a 200: these URLs are
  printed on QR codes.

## Roadmap

- [x] Technical foundation: TanStack Start, Tailwind, shadcn/ui, environment validation
- [x] Choosing and setting up data persistence (Supabase + Drizzle)
- [x] Back-office authentication (Supabase Auth, accounts created by the administrator)
- [x] Password reset: the link is requested from the sign-in screen and mailed by Supabase;
      the confirmation is the same whether the address has an account or not, and a dead or
      already-used link lands on a screen that offers a new one
- [x] Venue CRUD
- [x] Menu CRUD (categories, products, prices, photos)
- [x] Public menu
- [x] QR code generation (one per venue)
- [x] Product size: served format (25cl, 50cl, on tap…), on the menu as well as on order
      tickets
- [x] Theme: day and night variants following the system
- [x] Venue deletion (soft, with trash and restoration)
- [x] Out-of-stock handling
- [x] Inventory management: stock levels enabled per product, alert thresholds, manual
      decrements and automatic switch to unavailable
- [x] Counter ordering: customer-side cart, sent to the bar from the scanned menu, state
      tracked by the customer, queue and history in the back office, stock decremented on
      acceptance. **No online payment** — settlement happens at the counter, the order
      carries no banking data
- [x] Barcode scanning for stock movements: ins and outs entered in front of the camera
      from `/admin/<slug>/stock/scan`, with the code paired on first scan. Works on every
      browser, iOS included: native `BarcodeDetector` where it exists, otherwise a ZXing
      decoder in WebAssembly loaded on demand on that screen alone
- [ ] Dashboard: a new back-office home page, replacing the plain venue list — the day's
      figures, alerts (low stock, out of stock, pending orders) and direct access to each
      menu
- [x] Per-venue menu theme customization: a whitelist of boards, chosen per venue from
      `/admin/<slug>/reglages`, applied to the public menu's header panel and accents. The
      settings screen also renames a venue and edits its description; the public address
      never changes, because the printed QR codes carry it
- [x] Venue logo: uploaded from `/admin/<slug>/reglages`, shown at the head of the public
      menu's board, with a light plate for dark logos — guessed from the image, adjustable
      by the manager
- [x] Per-venue typefaces: a face per role (title, categories, products, descriptions) from a
      curated list, self-hosted, previewed day and night
- [ ] Custom colours and background image for the public menu
- [ ] Internationalization
- [ ] Shared access: several accounts on one venue, roles, ownership transfer

## Scripts

| Command                   | Role                                                 |
| ------------------------- | ---------------------------------------------------- |
| `npm run dev`             | Development server on port 3000                      |
| `npm run build`           | Production build                                     |
| `npm run preview`         | Serve the build                                      |
| `npm run generate-routes` | Regenerate `src/routeTree.gen.ts` from `src/routes/` |
| `npm run db:generate`     | Generate a SQL migration from `src/db/schema.ts`     |
| `npm run db:migrate`      | Apply pending migrations                             |
| `npm run db:studio`       | Open Drizzle Studio on the database                  |
| `npm run db:seed:demo`    | Reset and refill the demo venue                      |
| `npm run lint`            | ESLint                                               |
| `npm run format`          | Prettier `--write`, then `eslint --fix`              |
| `npm run check`           | Check formatting without changing anything           |

There is no typecheck script: it is `npx tsc --noEmit`. The project carries no test
framework either, for now.

`db:seed:demo` runs `scripts/seed-demo.ts`: it deletes the categories, products and orders
of `chez-lambert`, then writes back a menu of seven categories, some forty products (with
stock levels, alert thresholds and barcodes) and about fifteen orders spread between the
live queue and the history. It is **replayable** — running it again gives exactly the same
state. Before deleting anything, it checks that the targeted venue really carries the demo
slug **and** belongs to `demo@cbm.be`; otherwise it stops without writing. It connects
through `DATABASE_URL`, so as the database owner: that is the only way to write into
`orders`, a table on which nobody holds an insert right.
