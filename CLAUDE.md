# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

The package manager is **npm** (`.cta.json`, `package-lock.json`).

```bash
npm run dev              # dev server on port 3000
npm run build            # production build (Vite + Nitro)
npm run preview          # serve the build
npm run generate-routes  # regenerate src/routeTree.gen.ts from src/routes/
npm run db:generate      # generate a SQL migration from src/db/schema.ts (no DB needed)
npm run db:migrate       # apply pending migrations to DATABASE_URL
npm run db:studio        # Drizzle Studio
npm run lint             # ESLint
npm run format           # prettier --write . then eslint --fix
npm run check            # prettier --check . (changes nothing)
npx tsc --noEmit         # typecheck — there is no npm script for this
```

`postinstall` runs **patch-package**, which applies `patches/nitro+*.patch`. That patch fixes
a race in Nitro that made the dev server answer 500 on SSR — **don't delete it**, and re-run
`npm install` (not just `npm ci --ignore-scripts`) after touching dependencies.

**No test framework is configured** (no Vitest, no `test` script). If tests become
necessary, the Vite stack calls for Vitest — install it and document it here.

Add a shadcn/ui component:

```bash
npx shadcn@latest add dialog
```

**Check the generated file before using it.** Adding `popover` produced
`import { cn } from "cn"` — the CLI mis-resolved the `#/lib/utils` alias and installed an
unrelated npm package named `cn`. Fix the import to `#/lib/utils.ts` (matching the other
components) and remove the stray dependency.

`.cursorrules` gives this command as `pnpm dlx`: that's a leftover from the template, the
project uses npm.

## Architecture

### Startup chain

The app is a **TanStack Start** application with SSR. The logical entry point is
`src/router.tsx` → `getRouter()`, which:

1. builds the context via `getContext()` (`src/integrations/tanstack-query/root-provider.tsx`) — a fresh `QueryClient` per request;
2. creates the router with `routeTree` (generated), `defaultPreload: 'intent'` and `scrollRestoration`;
3. wires up `setupRouterSsrQueryIntegration` to dehydrate the Query cache on the client;
4. declares the router type in `declare module '@tanstack/react-router'`, which makes `Link`/`useNavigate` globally typed.

The context is typed at the root via `createRootRouteWithContext<MyRouterContext>` in
`src/routes/__root.tsx`, so `context.queryClient` is available in route `loader`s — that's the
mechanism to use for preloading data server-side rather than fetching inside components.

`src/routes/__root.tsx` acts as the full HTML shell (`<html>`, `<head>`, `<body>`) via
`shellComponent`, and mounts `TanStackDevtools` in the bottom right in dev.

### Routing

File-based routing in `src/routes/`. **`src/routeTree.gen.ts` is generated** — never edit it
(`.vscode/settings.json` marks it readonly and excludes it from search and the file watcher).
The Vite plugin regenerates it on the fly; `npm run generate-routes` is for a cold build or
after a mass rename.

### Feature-based architecture

Code is grouped by **feature**, not by technical kind. A feature owns its screens, its
queries and its domain rules in one directory; nothing about it is scattered across a
`components/` and a `lib/` at the other end of the tree.

```
src/
  features/
    auth/       components/ (login-screen, login-form), api.ts, mutations.ts,
                redirect.ts, errors.ts
    venues/     components/ (venues-page, venue-list, venue-card, venue-trash,
                venue-nav, venue-qr, add-venue-form), api.ts, mutations.ts, qr.ts
    menu/       components/ (menu-editor, category-*, product-*, menu-nav,
                public-menu, photo-field), api.ts, public-api.ts, mutations.ts,
                price.ts, photo.ts
  components/   ui/ (shadcn), buttons/ (the whole button family), form/,
                back-office/, home/, and the cross-screen pieces
                (nav-link, error-note, empty-state, surface.ts…)
  lib/          supabase.ts, postgrest-error.ts, utils.ts
```

Rules that keep the layout honest:

- **Only business domains are features.** `back-office/` (the shell) and `home/` (the landing
  page) stay in `src/components/`: they carry no data and no domain rule, and a directory
  holding one presentational file is a folder, not a feature.
- **A component never calls `supabase` directly.** Every read and write goes through the
  feature's `api.ts`, which is also where `camelCase` meets the API's `snake_case`
  (`priceCents` → `price_cents`). A product row has no business knowing a product is a table
  row. Route files are the exception the rule allows: `_authenticated.tsx` and `login.tsx`
  read the session in `beforeLoad`, which is a routing concern, not a screen's.
- **Mutations live in the feature's `mutations.ts`, and invalidate their own query.** A
  component calls `useRenameCategory()`, never `useMutation` on a raw API function. This is
  what removed the `onDone` callback that used to be drilled from the editor down to every
  button just to trigger a refetch. The hooks invalidate the key _prefix_
  (`MENU_QUERY_KEY = ['menu']`, not `['menu', venueSlug]`) precisely so no component needs to
  know the slug — threading it back down would rebuild the chain that was cut.
- **Read `mutation.error`, don't mirror it into `useState`.** React Query already holds the
  error, clears it when the next mutation starts, and exposes `reset()` for a cancel button.
  Six components used to keep a parallel `useState<string | null>` in sync by hand.
- **No cross-feature imports.** `features/menu` must not reach into `features/venues`.
  Anything two features need is not a feature concern — it moves down to `src/components/` or
  `src/lib/`. That is why `describeError` lives in `src/lib/postgrest-error.ts`: PostgREST
  error codes belong to no domain.
- **Dependencies point one way**: routes → features → shared (`src/components`, `src/lib`).
  A file under `src/components/` or `src/lib/` importing from `#/features/` is the inversion
  to catch in review — nothing enforces it, `import/no-cycle` is disabled.
- **No barrel `index.ts`.** Imports name the file they need
  (`#/features/menu/components/product-row`). Deliberate: a barrel adds a file to maintain and
  hides which module a route actually depends on.

**Route files hold routing only** — `createFileRoute`, `ssr`, `beforeLoad`, `validateSearch`,
and a component that reads the route's own hooks (`Route.useParams`, `Route.useSearch`,
`Route.useRouteContext`) and passes plain props down. A feature component takes props instead
of calling `Route.useX()`: it keeps TanStack Router's inference intact and stays movable.

**Query keys live with their query function** — `menuQueryOptions` in
`src/features/menu/api.ts`, `venuesQueryOptions` in `src/features/venues/api.ts`. A component
that invalidates reads the key from those helpers rather than retyping `['menu', slug]`, which
is how an invalidation ends up silently targeting a key nothing reads.

### Import aliases

`tsconfig.json` maps **`#/*` and `@/*`** to `./src/*`, but only `#/*` is declared in the
`imports` field of `package.json` (standard Node subpath import). shadcn's `components.json`
uses `#/`. **Use `#/`** — `@/` only resolves through the tsconfig paths.

### Persistence

**Postgres hosted on Supabase, queried through Drizzle ORM** (`drizzle-orm/postgres-js`).
Supabase was picked over Neon/Turso because it also covers the back office's authentication
and the product photo storage — two roadmap items — in one service. Queries go through
Drizzle rather than `supabase-js`, so only auth and storage are Supabase-specific.

| File                      | Role                                                                |
| ------------------------- | ------------------------------------------------------------------- |
| `src/db/schema.ts`        | Tables, relations and inferred types. Safe to import anywhere.      |
| `src/db/client.server.ts` | Drizzle connection. **Server-only.**                                |
| `src/db/migrations/`      | Generated by drizzle-kit — never hand-edit (also prettier-ignored). |
| `drizzle.config.ts`       | CLI config; loads `.env` itself via `process.loadEnvFile`.          |

Rules that are easy to get wrong here:

- **Route `loader`s are isomorphic** — they run in the browser too. Never touch the database
  from a loader or a component; go through `createServerFn`. The `.server.ts` suffix enforces
  this at build time (the build fails with the full import chain).
- **`db` and `serverEnv` are functions, not objects.** Reading `process.env` at module scope
  is wrong twice over: values can be inlined into a bundle, and on edge runtimes the env is
  injected per request, so a module-scope read evaluates to `undefined` on the server too.
  Validation therefore happens on first use — a missing `DATABASE_URL` fails the first
  request, not process startup.
- **`prepare: false` is required**: the Supabase pooler runs in transaction mode, where a
  prepared statement isn't guaranteed to find its session again. Supabase (hosted) offers
  three connection strings — transaction pooler (6543, IPv4) for the app, session pooler
  (5432, IPv4) for migrations if the transaction pooler chokes on DDL (set
  `MIGRATION_DATABASE_URL`, read only by `drizzle.config.ts`), and direct connection
  (`db.<ref>.supabase.co:5432`) which is **IPv6-only** on recent projects and fails from
  hosts without IPv6.
- **`casing: 'snake_case'` is set in two places** (`drizzle.config.ts` and the runtime
  `drizzle()` call) and must stay in sync, otherwise a column without an explicit name would
  be created as `snake_case` but queried as `camelCase`.
- **`authUid` belongs in policies, never in a `DEFAULT`.** `drizzle-orm/supabase` exports it
  as `(select auth.uid())` — the wrapper makes Postgres cache the value per query (InitPlan)
  inside a policy, but a `DEFAULT` rejects any subquery outright (`0A000: cannot use subquery
in DEFAULT expression`). Column defaults must use bare `sql\`auth.uid()\``.
- **Prices are integer cents** (`price_cents`), never floats. Currency lives on the venue.
- **RLS is enabled on all three tables, and the policies live in `src/db/schema.ts`**
  (`pgPolicy` + `anonRole`/`authenticatedRole` from `drizzle-orm/supabase`), not in
  hand-written SQL — the schema stays the source of truth. `drizzle.config.ts` sets
  `entities.roles.provider: 'supabase'` so drizzle-kit doesn't try to create or drop the
  Supabase-owned roles. This matters because Supabase exposes the `public` schema through
  PostgREST and grants rights to `anon`/`authenticated`: a table without RLS is readable
  **and writable** by anyone holding the publishable key, which ships in the browser bundle.
  Current policies: public `SELECT` on the three tables, plus an owner-scoped
  `INSERT`/`UPDATE`/`DELETE` triple per table for `authenticatedRole`, generated by the
  helpers at the top of `src/db/schema.ts` (`publicRead`, and the owner triple whose `check`
  goes into both `using` and `withCheck`). `venues` additionally carries **two** SELECT
  policies — see the soft-delete section.
- **Drizzle bypasses RLS** (it connects as the table owner, and there is no `FORCE ROW
LEVEL SECURITY`). Now that the app queries through `supabase-js`, Drizzle is
  **migrations-only** — no application query goes through it, and `DATABASE_URL` is needed
  only for `db:migrate`. Don't reintroduce runtime Drizzle queries without revisiting the
  isolation story: they would silently sidestep every policy.

### Environment variables

Validated with `@t3-oss/env-core` + Zod, **split in two** because the two sides read
different sources:

- `src/env.ts` — client. `runtimeEnv: import.meta.env`, which only exposes `VITE_`-prefixed
  variables. Everything declared here ships in the browser bundle, so public values only.
  Holds `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (the publishable key,
  `sb_publishable_…`, which replaces the legacy JWT `anon` key). Both are public by design;
  the Supabase **secret** key must never take a `VITE_` prefix.
- `src/env.server.ts` — server. `runtimeEnv: process.env`, marked server-only, evaluated
  lazily via `serverEnv()`.

A server variable declared in `src/env.ts` is always `undefined` — that was the case for the
old `SERVER_URL` placeholder, which is gone now that persistence is settled. Every new
variable goes into one of the two schemas; reading `import.meta.env` or `process.env`
directly bypasses validation.

### Build and server

`vite.config.ts` — **plugin order matters**: `devtools()`, `nitro()`, `tailwindcss()`,
`tanstackStart()`, `viteReact()`. Nitro acts as a generic server adapter; its `rollupConfig`
externalizes `/^@sentry\//`. The documented deployment target is Vercel, but the Nitro build
runs on any Node host (`node .output/server/index.mjs`).

## Styles

`src/styles.css` is the only style file. It carries the **"ardoise"** theme — the bar's
slate board, chalk, and a bottle green — in a **single token set**, which is the structural
point to preserve:

1. **House palette** (`--ink`, `--ink-soft`, `--ground`, `--surface`, `--surface-raised`,
   `--line`, `--line-soft`, `--bottle`, `--bottle-deep`, `--on-bottle`, `--primary-fill`,
   `--on-primary-fill`, `--danger`…) defined in `:root` (day: light stone, graphite ink) and
   redefined in `.dark` (night: `#1a1e1c` slate, chalk). This is the **source of truth**.
2. **shadcn contract** (`--background`, `--primary`, `--border`…) **derived** from it in a
   `:root, .dark` block: `--primary: var(--primary-fill)`, `--background: var(--ground)`, etc.
   Never give a shadcn token a literal colour — change the house token instead, and both
   themes follow.

It replaced the **"bar du soir"** theme (cream `#faf4ea`, amber `--brass: #d99c2b`, Fraunces
display) on 2026-09-04. That combination — warm cream ground, high-contrast serif display,
amber/terracotta accent — reads as a generated template rather than an identity, and an amber
of that lightness is the colour of a default warning state, which is why it looked cheap
under a `bg-primary` button. Don't reintroduce it. The `--brass*`, `--paper*`, `--hero-*`,
`--chip-*`, `--tone-*`, `--kicker`, `--header-bg`, `--inset-glint`, `--veil-opacity` and
`--grid-line` tokens are gone; so is the older parallel "coastal" palette.

Things that are easy to get wrong here:

- **The derivation block targets `:root, .dark`, not just `:root`.** A custom property is
  substituted on the element that _declares_ it, so `--background: var(--ground)` declared
  only on `:root` would compute against the light `--ground` and be inherited as-is by a
  `.dark` subtree. Listing both selectors makes the substitution happen again on `.dark`.
- **Style bare elements inside `@layer base`, never outside it.** A rule written outside any
  cascade layer beats _every_ layered rule regardless of specificity, and Tailwind's
  utilities live in `@layer utilities`. An unlayered `a { color: … }` therefore won against
  the `text-primary-foreground` of a link drawn as a button — "Espace gérant" rendered in
  link green on its ink fill, unreadable. The `a` rules now sit in `@layer base`.
  `.nav-link` stays **outside** any layer on purpose: it must win.
- **Two greens, on purpose, and they are the mirror of the two ambers they replace.**
  `--bottle` is a _fill_ (dark green, so it needs light ink: `--on-bottle`) and both stay put
  across themes because the fill stays dark. `--bottle-deep` is the _text_ accent and is the
  only one that flips — dark green on stone, pale green on slate. Don't collapse them.
- **`--board` is the chalkboard itself, and it does not flip.** The theme was named
  "ardoise" long before any surface was one; the customer menu's header is that surface
  (`--board` ground, `--on-board` chalk, `--on-board-soft` for secondary text, and
  `--bottle-chalk` — the dark theme's green — for the only accent legible on it). Frozen
  across themes for the same reason as `--bottle`/`--on-bottle`: a chalkboard is dark at any
  hour, and lightening it at night would repaint the slate in stone. Its value sits _below_
  the night `--ground` so the panel still detaches when the whole page has gone dark.
- **The primary action is ink, not colour.** `--primary` derives from `--primary-fill`
  (graphite by day, chalk by night), never from `--bottle`. Green signals — link, focus ring,
  section label, active underline — it never fills a "Enregistrer" button. Filling one with
  the accent is what made the previous theme look bought.
- **`@layer base` must not set `body { background-color }`.** shadcn's default rule did, and
  it silently overrode the colour declared in the `body` rule — the whole house palette was
  invisible. The body's colour is set in the `body` rule only.
- **The background is a flat fill.** No gradient, no radial halo, no grid overlay, and
  `body::before` / `body::after` no longer exist. The previous theme stacked three radial
  gradients, a 28px grid and a linear gradient; the halos barely showed, the grid did not
  show at all and only dirtied the ground. Depth comes from the 1px `--line`, not from a
  44px shadow — hence two short shadows (`--shadow-1`, `--shadow-2`) and no `--shadow-3`.
- **Both token sets are mapped in `@theme inline`**, so the house palette has real utilities:
  `text-ink-soft`, `border-line`, `bg-surface-raised`, `text-bottle-deep`. Prefer them over
  `text-[var(--ink-soft)]`.
- Tailwind ships no `bottle-*` scale, which is the point of the name: `bg-bottle` can't be
  confused with a framework colour (the same reasoning that named the old token `brass`
  rather than `amber`).

Dark mode is **class-driven** (`@custom-variant dark (&:is(.dark *))`) and follows the
system: an inline `ScriptOnce` in `src/routes/__root.tsx` toggles `.dark` on `<html>` from
`prefers-color-scheme` before hydration, and keeps listening for changes. There is
deliberately **no toggle and no `localStorage`** — the customer menu follows the phone. The
`<html>` element carries `suppressHydrationWarning` because the server renders it without the
class. Two `theme-color` metas are written **directly in the shell's `<head>`**, not in
`head.meta`: the router dedupes metas by `name` and would keep only one of them — and their
values (`#eeefec` / `#1a1e1c`) are the two `--ground`s, so they move with the palette.

Fonts: **one family, Archivo**, loaded variable on two axes (`wdth` 62–125, `wght` 100–900)
by a Google Fonts `@import` at the top of `styles.css`. `--font-sans` and `--font-display`
are both Archivo: the difference between a heading and a paragraph is carried by **width and
weight**, not by a second typeface. `.display-title` is where that identity lives
(`font-stretch: 112%`, weight 700) — it is the one place this theme raises its voice, which
is why everything around it stays quiet.

Visual vocabulary — reuse these before inventing new ones:

| Class            | Where                                                                                                                                                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.island-shell`  | Showcase surfaces (home, `/login`, customer menu): opaque, `--shadow-2`. The menu drops the border, radius and shadow at the base width and takes them back at `sm:` — the phone gets the bare sheet, the wide screen the frame |
| `.panel`         | Back office: same surface, no shadow — the tool sits flat, the shopfront lifts                                                                                                                                                  |
| `.feature-card`  | Clickable cards, border tints toward `--bottle` on hover (pointer-fine only)                                                                                                                                                    |
| `.page-wrap`     | Centred container, `min(1080px, 100% - 2rem)`                                                                                                                                                                                   |
| `.display-title` | Archivo wide + bold — the theme's signature                                                                                                                                                                                     |
| `.island-kicker` | Small section label in `--bottle-deep`. **Not** all-caps: a tracked-out caps eyebrow above every heading is the commonest generated-design tell, and it mangled a label as long as "Carte digitale pour bars et cafés"          |
| `.nav-link`      | Inline link in the content, underline that grows from the left                                                                                                                                                                  |
| `.rail-link`     | Item in the back-office sidebar: tinted ground + a `--bottle` bar at the left edge when active. **Not** a `.nav-link` — that underline sits 8px _below_ its box and would land inside the next item of a vertical list          |
| `.rail-fade`     | Right-edge mask on a horizontally scrolling rail — says the row continues where a scrollbar would only dirty the band. Fixed, not scroll-driven: at the end it still dims a millimetre of the last chip                         |
| `.rise-in`       | Entry animation (stagger via `animationDelay`)                                                                                                                                                                                  |
| `.site-footer`   | Footer                                                                                                                                                                                                                          |

`@media (prefers-reduced-motion: reduce)` neutralises movement while keeping fades. The
global `transition` rule covers colours only — `transform` is left to the components, which
declare their own `active:scale-[0.97]`.

## Conventions

- **Prettier**: no semicolons, single quotes, trailing commas everywhere. Run `npm run format`
  before committing. Careful: `npm run check` already flags a dozen pre-existing unformatted
  files from the scaffold (shadcn components, `tsconfig.json`, `components.json`, `.cta.json`,
  `prettier.config.js`, `AGENTS.md`) — a global `npm run format` would rewrite them all and
  bloat the diff. Only format the files you touch.
- **ESLint**: `@tanstack/eslint-config`, with `import/order`, `sort-imports`,
  `import/no-cycle`, `@typescript-eslint/array-type` and `require-await` **disabled**. Don't
  reorder imports "to make it clean".
- **Strict TypeScript** with `noUnusedLocals` and `noUnusedParameters`: an unused variable or
  parameter breaks the typecheck. `verbatimModuleSyntax` is on → type imports must go through
  `import type`.
- **Never add a dependency without asking — devDependencies included.** No `npm install`
  (with or without `-D`), and no `npx shadcn@latest add <x>` or generator that drags a new
  package in, before the owner has said yes. A test runner, a lint plugin or a build tool goes
  through the same question as a runtime package: "it's only a devDependency" is not a reason
  to skip asking. Proposing one is welcome whenever it genuinely earns its place — but as a
  **question with the case argued both ways**: what problem it solves and what it would
  replace, against its cost (bundle size for runtime deps, transitive deps, last release and
  maintenance, SSR compatibility with TanStack Start, lock-in) and what writing it by hand
  would actually take. State a recommendation, then wait for the answer.

## UI rules

### Mobile-first

**Every interface is designed and written mobile-first.** Base styles target the smallest
viewport; breakpoints (`sm:`, `md:`, `lg:`) only ever add. Never write the desktop layout
first and walk it back with `max-*` variants.

- **Customer-facing menu**: the phone _is_ the device — the menu is reached by scanning a QR
  code at the table. Desktop must stay usable, but it doesn't need a layout of its own.
- **Back office**: authored mobile-first too (a manager updates a price standing behind the
  bar), but it must **also** get a real desktop layout from `lg:` up — not a phone column
  stretched to 1400px. That means multi-column forms, persistent sidebar navigation, tables
  that use the available width, denser spacing, and keyboard affordances.
- Touch targets stay at least 44×44px, primary actions within thumb reach, and nothing is
  reachable by hover only.
- Check the small viewport first when verifying a change; a layout that only works at `lg:` is
  unfinished.

**Never render a bare `<Button>` in a screen.** `src/components/buttons/` holds the whole
family, in two layers. Reach for a **semantic** wrapper first — it names the action, so the
icon, the wording and the behaviour can't diverge between two screens:

| Wrapper        | Renders                         | What it owns for you                                                                                                                            |
| -------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `AddButton`    | `Plus` + « Ajouter »            | `pending` swaps the label (`pendingLabel`, default « Ajout… ») **and** disables. Pass children only to qualify the add (« Ajouter un produit ») |
| `SaveButton`   | `Save` + « Enregistrer »        | `type="submit"`, « Enregistrement… » while `pending`, disables                                                                                  |
| `CancelButton` | « Annuler »                     | `variant="ghost"`, non-overridable — a cancel must never weigh as much as the action                                                            |
| `EditButton`   | `Pencil`, icon only             | **required** `label`: the icon is shared, what it edits is not                                                                                  |
| `DeleteButton` | `Trash2` + confirmation popover | There is no path that deletes on the first click. Focus lands on **Annuler**                                                                    |
| `MoveButtons`  | `ChevronUp`/`ChevronDown` pair  | Both `aria-label`s, `disabled` at the list's ends                                                                                               |

Under them sit the two **shape** primitives, for genuine one-offs only (« Se connecter »,
« Déconnexion ») — anything recurring deserves a wrapper instead:

| Primitive      | For       | Owns                                                                                                       |
| -------------- | --------- | ---------------------------------------------------------------------------------------------------------- |
| `ActionButton` | Labelled  | `h-11` on mobile, desktop height from `surface` (`page`/`panel`/`popover`), leading `icon`, press feedback |
| `IconButton`   | Icon-only | 44×44 mobile / 36 desktop, **required** `label` → `aria-label`, `tone="destructive"`, press feedback       |

Both wrap shadcn's `Button` rather than editing it — `ui/` stays regenerable. `ActionButton`
defaults `type="button"`: inside a form, a missing `type` silently turns a cancel button into a
submit.

**Fields follow the same shape**, in `src/components/form/`:

| Component       | Owns                                                                                  |
| --------------- | ------------------------------------------------------------------------------------- |
| `TextField`     | `useId()` wiring, `<Label>`, height from `surface`, optional `hint`, `hiddenLabel`    |
| `TextAreaField` | Same, minus `surface` — a textarea sizes by `rows`, it has no resting height to match |

On both, `className` dresses the **block** (that's what you put in a grid or grow with
`flex-1`); `inputClassName` / `textareaClassName` dress the control.

**`SURFACE_HEIGHT` in `src/components/surface.ts` is shared between buttons and fields**, and
that sharing is the point: in « Nouvelle catégorie » an input and an `AddButton` sit on the same
row. `surface` names where the control sits rather than its height, because only the desktop
density varies — mobile is always 44px. Two tables maintained apart would drift by a pixel and
put the row out of line.

**Links are not buttons.** A destination gets an `<a>`, never a `<button>` calling
`navigate()` — that would lose middle-click, open-in-new-tab and copy-link. The home page's
« Espace gérant » is a link drawn as a button, and its classes stay inline: it is the only one
in the app, on a placeholder landing page. Should a second appear, wrap it — and wrap it with
TanStack's `createLink`, because a hand-written signature around `Link` compiles but silently
drops the inference on `to` and `params`, so a renamed route then fails at runtime instead of at
build.

**Text navigation links go through `NavLink`** (`src/components/nav-link.tsx`), which lays the
label out with its optional `icon` and keeps `to` inferred via `createLink`. Outgoing links take
the same component under its `ExternalNavLink` export — the same implementation, reached with an
`href` instead of a route. `NavLink` deliberately sets **no default `activeProps`**: the router
treats a link as active as soon as the URL merely starts with its target, so a back link to
`/admin` would stay underlined from `/admin/le-comptoir`. The sidebar asks for it explicitly; a
back link must not.

**The 44px touch target of a navigation link stays in `.nav-link` (`styles.css`), not in the
component.** That class already owns the link's identity — colour, hover, the underline that
grows from the left — and splitting its rules across CSS and a React wrapper would be worse than
the one duplicated utility it saves. Note the rule sits **outside any `@layer`**, so it beats a
`min-h-*` utility written at the call site: deliberate, but know it before trying to override it.
`display` stays at the call sites, since the sidebar needs `flex` where the others want
`inline-flex`.

**Never hand-write `htmlFor` / `id` again.** It was the one part of a field that breaks in
silence: a typo raises no error and fails no type — it just leaves the input nameless to a
screen reader and stops the label from focusing it. The category rename input had no accessible
name at all until `TextField` took over (`hiddenLabel` keeps the wiring where the layout
replaces a title and can show no label).

`DeleteButton`'s focus placement is a real invariant, not a detail: the popover opens from the
keyboard too, and a reflex Enter must not destroy a category. If you touch that component,
re-check it in a browser — the ref chain that puts focus on **Annuler** crosses three
components and no type error will tell you it broke.

### Rule: design the UI with Emil Kowalski's skills

**Every UI creation or redesign — new page, new component, new user-visible feature — loads
the relevant skill first and follows its `SKILL.md`.** This is not optional, and it adds to
(does not replace) the `npx @tanstack/intent` flow described above.

| Situation                                          | Skill                          |
| -------------------------------------------------- | ------------------------------ |
| New UI, new component, visual polish               | `emil-design-eng` (default)    |
| Choosing a component / interaction library         | `pick-ui-library`              |
| Writing an animation or a transition               | `animate`                      |
| Gestures, springs, materials, interruptible motion | `apple-design`                 |
| Toasts / notifications                             | `ask-sonner`                   |
| Throwaway mockup to validate a direction           | `prototype`                    |
| Reviewing an existing animation (diff)             | `review-animations`            |
| Auditing the whole project's motion                | `improve-animations`           |
| Looking for places to add movement                 | `find-animation-opportunities` |
| Naming an effect whose term you don't know         | `animation-vocabulary`         |

`animate-expo` and `write-swift` don't apply to this project (web). When they overlap,
`emil-design-eng` frames the design decision, the specialized skill frames the implementation.

## Project status

The data layer, the back office, the customer-facing menu (`/m/$venueSlug`) and the printable
QR sheet (`/admin/$venueSlug/qr`) all exist — each has its own section below. What is left is
in `README.md`'s Roadmap.

The **"ardoise" theme** (slate + chalk + bottle green, day and night variants) is in place
across `styles.css`, the home page, `/login`, the back office and the public menu — see the
Styles section. The home page is a landing page, **not** the customer menu: `/` markets the
product, `/m/$venueSlug` is what a QR code points at.

**Data access is browser-side `supabase-js` + RLS** (decided 2026-09-04). The browser holds
the publishable key and talks to PostgREST directly; Postgres policies — not application
code — enforce tenant isolation. `src/lib/supabase.ts` holds the client and a
**hand-written** `Database` type in snake_case (PostgREST column names differ from Drizzle's
camelCase, so Drizzle's inferred types can't be reused). That duplication is the known weak
point: replace it with `supabase gen types typescript` once the Supabase CLI is wired up.

### Back office

Lives under `/admin`, behind `src/routes/_authenticated.tsx` — a pathless layout route that
both guards and provides the shell. Constraints that are easy to get wrong:

- **Back-office routes are `ssr: false`.** The Supabase session lives in the browser, so
  running the guard during SSR would conclude "signed out" on every request. Children inherit
  the setting and can only make it more restrictive. The public menu must stay SSR — it is
  reached by scanning a QR code.
- **The sidebar carries the navigation, from `lg` up.** `BackOfficeShell` takes it as a
  `nav` prop rather than building it: the shell lives under `src/components/`, which must not
  import from `#/features/`, and listing venues is the venues domain. `_authenticated.tsx`
  composes `<VenueNav ownerId activeVenueSlug>`, reading the slug with
  `useParams({ strict: false })` — the layout route has no `$venueSlug` of its own, and
  "where are we" is a routing question, which keeps `VenueNav` a function of its props.
  The tree never repeats a destination: the **open** venue becomes a group label and its two
  sections (Carte, QR code) carry the links, while the other venues stay plain links. It
  replaced a column holding a single `/admin` link that every screen already offered as a
  back link — 256px for a destination the content gave away for free.
- **The in-page back links are `lg:hidden`, not deleted.** The sidebar only exists from `lg`;
  below it, `← Établissements` and `← Retour à la carte` are the only way out. Removing them
  outright would strand every phone.
- **A `beforeLoad` guard protects the screen, not the data.** Under the RLS design the real
  boundary is Postgres; bypassing the guard grants nothing.
- **`router.invalidate()` must follow sign-in and sign-out**, otherwise `beforeLoad` keeps its
  previous verdict and bounces the user straight back. For sign-in it lives inside `useSignIn`
  rather than in the route: React Query awaits the hook's `onSuccess` before the per-call one,
  so the invalidation is guaranteed to finish before the route navigates. Sign-out still does
  it by hand in `_authenticated.tsx`, which also navigates.
- **`/login`'s `redirect` search param is optional and sanitized** (internal paths only,
  rejecting `//host`). Keeping the key always present made the router rewrite `/login` to
  `/login?redirect=%2Fadmin` on every direct visit.
- **Prices are nullable.** `null` means "no price shown" (dish of the day, market price);
  `0` is a valid free item. Never collapse the two — `parseOptionalEurosToCents` returns
  `null` only for a blank field. The UI renders "Prix non renseigné" rather than an empty gap.
- **Prices**: the UI takes euros, the DB stores integer cents. `src/features/menu/price.ts`
  is the only
  place that converts. It parses decimals as _text_ rather than multiplying a float —
  `1.10 * 100` is `110.00000000000001` in JS. Accepts comma or dot, strips whitespace
  (`\s` covers non-breaking spaces).
- **Ordering** uses a `position` column stepping by 100, leaving room to insert between two
  neighbours without rewriting the list. `swapPositions` in `src/features/menu/api.ts` does two
  sequential updates, not a transaction — PostgREST exposes none. A failure between them
  leaves two equal positions, which the `(position, name)` ordering resolves deterministically.
- **Writes go through `write()` in `src/features/menu/api.ts`**, a one-line helper that reads
  `error` and raises `describeError(error)`. It exists so a mutation added later can't forget
  the translation and surface a raw English PostgREST message in the UI.
- **A missing venue is a `VenueNotFoundError`, and `menuQueryOptions` does not retry it.** The
  database answered — it answered "nothing" — so the three default attempts would only delay
  the message. Worse, React Query pauses retries while the document is hidden, so an error that
  never finished retrying is never shown: a background tab would sit on « Chargement… »
  indefinitely. Everything else keeps the default three attempts; a network blip does repair
  itself.
- **`fetchMenu` runs three queries instead of one embedded select.** PostgREST can embed
  (`select('*, products(*)')`) but typing that needs relationship metadata our hand-written
  `Database` doesn't carry. Revisit if the menu grows large.
- **Destructive actions confirm in a Popover** anchored to the trash button — the popover
  lives inside `DeleteButton` (`src/components/buttons/delete-button.tsx`), so there is no
  API that deletes on the first click. Not inline and not
  `window.confirm`. Inline confirmation pushed the surrounding row around;
  `window.confirm` blocks the thread and can't be styled. Focus lands on **Annuler**,
  never on **Supprimer** — the popover opens from the keyboard too, and a reflex Enter
  must not destroy a category.
- **Product photos live in the `product-photos` Storage bucket**, created by migration `0004`
  (hand-written: it touches the `storage` schema, which `src/db/schema.ts` doesn't describe).
  The bucket is **public for reads** — the menu is opened from a QR code on mobile data, and a
  public URL is CDN-cacheable where a signed URL costs a round trip per image and expires.
  Writes are owner-only: the first path segment is the venue id
  (`<venue_id>/<random>.<ext>`), which the `storage.objects` policies join back to
  `venues.owner_id`.
- **In a storage policy, qualify `storage.objects.name` in full.** Written as bare `name`
  inside the `exists (select ... from venues ...)` subquery, Postgres resolves it against
  `venues.name` — the policy then compares the venue's _name_ to the folder and silently
  refuses every upload. This cost a debugging round; the migration carries the warning.
- **Photos are downscaled in the browser** before upload (`src/features/menu/photo.ts`,
  canvas, max 1200px, WebP with a JPEG fallback). `imageOrientation: 'from-image'` applies the
  EXIF rotation — without it, photos taken sideways arrive lying down.
- **File names are random, never derived from the product id.** Replacing a photo must write a
  new path: public URLs are CDN-cached, and reusing a path keeps serving the old image.
- **Storage has no cascade.** Deleting a product removes its file after the row; deleting a
  category collects its products' paths _before_ the DB cascade wipes them. Order matters: an
  orphan file is invisible, a row pointing at a deleted file shows a broken image to a customer.

### Soft-deleting a venue

`venues.deleted_at` (nullable timestamp) marks a venue as binned; the row, its menu, its
photos and its slug all stay. Migration `0005`.

- **Two permissive SELECT policies on `venues`**, OR'd: `venues_public_read` now requires
  `deleted_at is null`, and `venues_owner_read` lets an owner see all of theirs. Dropping the
  second would make a binned venue invisible to its own manager — unrestorable, and the
  category write policies (which look the venue up by subquery) would stop finding it.
- The public menu needs **no code change**: SSR reads as `anon`, RLS hides the venue, the
  lookup returns nothing and the route already throws `notFound()`.
- **The slug stays reserved while binned.** `venues_slug_unique` ignores `deleted_at`. A
  partial index would free the address but make a restore fail when the name was reused —
  a far more confusing failure.
- `venuesQueryOptions` returns **active and binned together**; `VenueList` splits them. It
  filters with `Boolean(venue.deleted_at)`, not `!== null`, so a database that hasn't run
  `0005` yet doesn't dump every venue into the bin.
- The bin's date comes from the client (`new Date().toISOString()`): PostgREST can't express
  `now()` in an update. Harmless for an archive marker, not for anything billed.

### QR code

`/admin/$venueSlug/qr` renders a printable sheet. **One code per venue**, not per table: the
menu is identical everywhere, and a table number would be inert until something reads it.

- **`uqr`** does the encoding (approved dependency: 0 transitive deps, 77 KB, MIT, runtime
  agnostic). `src/features/venues/qr.ts` is the only place that touches it.
- **Error correction `Q`, and SVG output.** Measured with Chrome's `BarcodeDetector`: the
  code survives up to **15 %** of its area covered by a solid blot, failing at 20 % — below
  the 25 % the spec advertises, because contiguous damage is harder to correct than scattered
  noise. Don't quote the spec figure; that measurement is the useful one.
- **`encode()`'s `size` includes the border.** A 37-module code with a 4-module quiet zone
  reports 45. This cost a wrong test assertion.
- **`isLocalOrigin` guards against printing a `localhost` code** — visually identical to a
  valid one, useless once glued to a table.
- Printing is scoped by `.no-print` (shell, header block, buttons) and `.print-sheet` in
  `src/styles.css`. The sheet forces black-on-white: a QR reader relies on contrast, and the
  theme's gradient is both ink-hungry and harmful to it.

### Public menu

`/m/$venueSlug` is the customer-facing page, and the **only SSR'd route with data** — the
back office is `ssr: false`. Consequences worth keeping in mind:

- `src/lib/supabase.ts` is therefore evaluated **on the server too**, and it is a singleton
  shared across requests. Safe only because this page reads as `anon` and never authenticates.
  Opening a server-side session would require a per-request client.
- The route loads through `context.queryClient.ensureQueryData(publicMenuQueryOptions(...))`,
  so the query dehydrates to the client instead of being refetched on hydration.
- `fetchPublicMenu` (`src/features/menu/public-api.ts`) is deliberately **not** `fetchMenu`:
  it filters `is_available` **in the query** — a hidden product must never reach the browser —
  and drops categories left empty. It lives in `features/menu` because a separate feature
  would have to import `VenueNotFoundError` and `CategoryWithProducts` from it, which the
  no-cross-feature-imports rule forbids.
- An unknown slug throws `notFound()` so the response is a real **404**: these URLs are printed
  on QR codes.
- A null price renders **nothing** here, where the back office writes "Prix non renseigné".
  That label is addressed to the manager; showing it to a customer would expose an omission.
- **The page is drawn as an object, not as a document.** An opaque sheet (`.island-shell`)
  topped by a `--board` panel carrying the venue name in chalk — the bar's board, which is
  the only place in the app where the theme shows what named it. Full-bleed on the phone
  (a frame and two margins would only eat the reading width on the screen this page is
  actually read on), a sheet laid on the ground from `sm:` up.
- **Never put `overflow-hidden` on that sheet.** It is the obvious way to clip the board
  panel's corners, and it turns the sheet into a scroll container — `MenuNav` then sticks to
  nothing. The panel rounds itself instead, at the sheet's radius minus its 1px border.
- **Nothing animates on entry.** The content is already in the SSR'd HTML; fading it in would
  only delay a reading the customer asked for by scanning. The same argument rules out a
  full-screen cover: the board panel stays compact so the first category is reachable. The
  page's only movements are the section rail's highlight, which answers scrolling, and a
  chip's `active:scale-[0.97]` — both answer an action, neither an arrival.
- **`MenuNav` is a sticky table of contents, and it appears only from three categories up**
  (`NAV_MIN_CATEGORIES` in `public-menu.tsx`). Below that everything fits in a screen and the
  rail would just be one more band to scroll past. The highlight follows an
  `IntersectionObserver` band (`rootMargin: '-25% 0px -65% 0px'`), not the last chip clicked:
  a customer scrolls by hand too, and a rail still pointing at the tapped section ten screens
  later would be lying. Sections carry `scroll-mt-24` so an anchor lands _below_ the rail
  rather than behind it. Known limit, and it is the one every anchor nav has: on a short menu
  the last section cannot reach the top, so tapping it highlights whatever the band actually
  holds. Half a viewport of padding would fix it and would put a hole at the end of a menu.
- **The leader rule (`.menu-leader`) is what fills the line between a name and its price.**
  It is the printed-carte convention, and it is functional before it is decorative: the eye
  crosses the gap without dropping a line. A product with no price gets no leader either —
  there is nothing to lead to.
- **The photo column is reserved per section, not per row**, as soon as one product in it
  carries a photo, and it sits on the **right**. Thumbnails on the left indented only the
  illustrated products and turned the menu's left edge into a staircase; on the right without
  a reserved column, those rows' leaders shorten and the prices stop lining up — and the price
  column is the one a customer reads down. Empty space to the right of an unillustrated
  product is invisible; an empty frame to its left is not. Rows are centred on that column:
  most products have neither price nor description, and a top-aligned row left the name
  stranded above 80px of nothing.
- **The category description is rendered here** (`categories.description`). It is the only
  editorial text a manager can put on this page, and a menu that renders nothing but names
  and prices can only look raw. Note the back-office forms don't expose the field yet — it is
  writable through `createCategory` alone.
- **The back-to-top link appears only where the rail does.** Below three categories the thumb
  scrolls back faster than a link takes to find; above it, the last section sits ten screens
  from the venue's name and the rail only ever jumps between sections.
- Auth is **email + password, sign-in only**. There is deliberately no sign-up form: accounts
  are provisioned by the platform administrator (Supabase dashboard → Authentication → Users
  → Add user, with _Auto Confirm User_). **Don't add a sign-up screen back** without being
  asked.
- **The missing sign-up form is not a security control.** `/auth/v1/signup` stays reachable
  with the publishable key, and the SDK ships `signUp` in the bundle no matter what the app
  code does. Self-registration is closed only by the project's **Allow new users to sign up**
  setting. Check it with
  `curl -s "$VITE_SUPABASE_URL/auth/v1/settings" -H "apikey: $VITE_SUPABASE_ANON_KEY"` —
  `disable_signup` must be `true`.
- Supabase auth errors arrive in English; `translateAuthError` in
  `src/features/auth/errors.ts` maps `AuthApiError.code` (fed from the API's `error_code`) to
  French. It is applied in `features/auth/api.ts`, which throws the message already
  translated — the auth counterpart of `describeError` for PostgREST. Keep the credentials
  message indistinct between unknown address and wrong password — naming which one failed
  turns the screen into an account-enumeration oracle.

Deliberately left out of the schema until their roadmap item comes up: i18n columns, and
per-venue theming. `products.image_path` holds a Supabase Storage path, not a URL — the
`product-photos` bucket that backs it is created by migration `0004`.
`venues.owner_id` has no FK to `auth.users` — `drizzle-orm/supabase`
exports an `authUsers` reference that would make one possible if that's ever wanted.

`README.md` describes the **intended** product — QR-code-scannable digital menu on the
customer side, CRUD back office on the manager side, multi-venue, i18n and light/dark theme —
not what exists. Its Roadmap section is the source of truth on what's left to do. Don't
assume a listed feature exists — and note the Roadmap has itself fallen behind the code more
than once; check for the route or the file before trusting either document.

The repository is deliberately **unlicensed** (an explicit choice by the owner, don't
reintroduce a `LICENSE` file).

## TanStack Intent skills

`AGENTS.md` requires this before any substantial change:

```bash
npx @tanstack/intent@latest list                    # list the available skills
npx @tanstack/intent@latest load <package>#<skill>   # load the matching one
```

Follow the loaded `SKILL.md` throughout the change. When several match, prefer the local skill
most specific to the area being touched.

## Third-party skills (skills-lock.json)

External skills are installed in the project. They follow an npm-like model:

| Item               | Role                                         | Versioned       |
| ------------------ | -------------------------------------------- | --------------- |
| `skills-lock.json` | Manifest: GitHub source + hash of each skill | **yes**         |
| `.agents/skills/`  | Downloaded content                           | no (gitignored) |
| `.claude/skills/`  | Relative symlinks into `.agents/skills/`     | no (gitignored) |

`skills-lock.json` is the source of truth; both directories are derived and regenerable.
Don't commit `.agents/` or `.claude/skills/` — the latter only holds symlinks, which would
arrive broken for everyone else. `.claude/` itself, however, is **not** ignored wholesale: a
future `settings.json` (permissions, hooks, slash commands) belongs there and is shared
normally. The personal file to ignore the day it appears is `.claude/settings.local.json`.
