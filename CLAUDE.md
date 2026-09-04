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
    auth/       components/ (login-screen, login-form), redirect.ts, errors.ts
    venues/     components/ (venues-page, venue-list, venue-card, add-venue-form), api.ts
    menu/       components/ (menu-editor, category-*, product-*), api.ts, price.ts
  components/   ui/ (shadcn), back-office/, home/, and the cross-screen pieces
                (action-button, icon-button, confirm-delete, move-buttons, error-note…)
  lib/          supabase.ts, postgrest-error.ts, utils.ts
```

Rules that keep the layout honest:

- **Only business domains are features.** `back-office/` (the shell) and `home/` (the landing
  page) stay in `src/components/`: they carry no data and no domain rule, and a directory
  holding one presentational file is a folder, not a feature.
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
  Current policies: public `SELECT` on the three tables, **no write policy at all**.
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

`src/styles.css` is the only style file. It carries the **"bar du soir"** theme — warm night
and brass — in a **single token set**, which is the structural point to preserve:

1. **House palette** (`--ink`, `--ink-soft`, `--brass`, `--brass-deep`, `--on-brass`,
   `--paper`, `--paper-soft`, `--surface`, `--line`, `--hero-a`…) defined in `:root` (day:
   warm paper, espresso ink) and redefined in `.dark` (night: `#14100e` + amber). This is the
   **source of truth**.
2. **shadcn contract** (`--background`, `--primary`, `--border`…) **derived** from it in a
   `:root, .dark` block: `--primary: var(--brass)`, `--background: var(--paper)`, etc.
   Never give a shadcn token a literal colour — change the house token instead, and both
   themes follow. The old zinc/oklch set is gone; so is the parallel "coastal" palette
   (`--sea-ink`, `--lagoon`, `--palm`, `--sand`, `--foam`), which no longer exists.

Things that are easy to get wrong here:

- **The derivation block targets `:root, .dark`, not just `:root`.** A custom property is
  substituted on the element that _declares_ it, so `--background: var(--paper)` declared
  only on `:root` would compute against the light `--paper` and be inherited as-is by a
  `.dark` subtree. Listing both selectors makes the substitution happen again on `.dark`.
- **Two ambers, on purpose.** `--brass` is a _fill_ colour (buttons, chips) and `--brass-deep`
  a _text_ colour. Amber on paper sits around 2:1 contrast — unreadable as text, fine as a
  flat area under dark ink. `--on-brass` stays dark in **both** themes because the fill stays
  light. Don't collapse them.
- **`@layer base` must not set `body { background-color }`.** shadcn's default rule did, and
  it silently overrode the gradient declared in the `body` rule — the whole house palette was
  invisible. The body's colour is set in the `body` rule only.
- **Both token sets are mapped in `@theme inline`**, so the house palette has real utilities:
  `text-ink-soft`, `border-line`, `bg-brass`, `text-brass-deep`, `bg-chip`. Prefer them over
  `text-[var(--ink-soft)]`.
- Tailwind already ships an `amber-*` scale; the house token is deliberately named **brass**
  so `bg-brass` can't be confused with `bg-amber-500`.

Dark mode is **class-driven** (`@custom-variant dark (&:is(.dark *))`) and follows the
system: an inline `ScriptOnce` in `src/routes/__root.tsx` toggles `.dark` on `<html>` from
`prefers-color-scheme` before hydration, and keeps listening for changes. There is
deliberately **no toggle and no `localStorage`** — the customer menu follows the phone. The
`<html>` element carries `suppressHydrationWarning` because the server renders it without the
class. Two `theme-color` metas are written **directly in the shell's `<head>`**, not in
`head.meta`: the router dedupes metas by `name` and would keep only one of them.

Fonts: **Manrope** as `--font-sans`, **Fraunces** as `--font-display` (used by
`.display-title`), loaded by a Google Fonts `@import` at the top of `styles.css`.

Visual vocabulary — reuse these before inventing new ones:

| Class            | Where                                                                |
| ---------------- | -------------------------------------------------------------------- |
| `.island-shell`  | Showcase surfaces (home, `/login`, customer menu): translucent, blur |
| `.panel`         | Back office: opaque, no blur, minimal shadow — the sober application |
| `.feature-card`  | Clickable cards, lift on hover (pointer-fine only)                   |
| `.page-wrap`     | Centred container, `min(1080px, 100% - 2rem)`                        |
| `.display-title` | Fraunces + optical sizing                                            |
| `.island-kicker` | Small caps label in `--kicker`                                       |
| `.nav-link`      | Link with an underline that grows from the left                      |
| `.rise-in`       | Entry animation (stagger via `animationDelay`)                       |
| `.site-footer`   | Footer                                                               |

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

Both wrap shadcn's `Button` rather than editing it — `ui/` stays regenerable. `surface` names
where the button sits instead of its height, because only the desktop density varies (mobile is
always 44px). `ActionButton` defaults `type="button"`: inside a form, a missing `type` silently
turns a cancel button into a submit.

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

The data layer and the back office exist; **the customer-facing menu does not**. There is no
`/$venueSlug` route yet, and no QR code generation. The schema has never been run against a
real Postgres (no Supabase project was provisioned when it was written; the SQL was verified
offline via `toSQL()`).

The **"bar du soir" theme** (warm night + brass, day and night variants) is in place across
`styles.css`, the home page, `/login` and the back office — see the Styles section. The home
page is a landing page, not the customer menu.

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
- **A `beforeLoad` guard protects the screen, not the data.** Under the RLS design the real
  boundary is Postgres; bypassing the guard grants nothing.
- **Call `router.invalidate()` after sign-in and sign-out**, otherwise `beforeLoad` keeps its
  previous verdict and bounces the user straight back.
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
- **`fetchMenu` runs three queries instead of one embedded select.** PostgREST can embed
  (`select('*, products(*)')`) but typing that needs relationship metadata our hand-written
  `Database` doesn't carry. Revisit if the menu grows large.
- **Destructive actions confirm in a Popover** anchored to the trash button
  (`ConfirmDelete`, `src/components/confirm-delete.tsx`), not inline and not
  `window.confirm`. Inline confirmation pushed the surrounding row around;
  `window.confirm` blocks the thread and can't be styled. Focus lands on **Annuler**,
  never on **Supprimer** — the popover opens from the keyboard too, and a reflex Enter
  must not destroy a category.
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
  `src/features/auth/errors.ts` maps
  `AuthApiError.code` (fed from the API's `error_code`) to French. Keep the credentials
  message indistinct between unknown address and wrong password — naming which one failed
  turns the screen into an account-enumeration oracle.

Deliberately left out of the schema until their roadmap item comes up: i18n columns, and
per-venue theming. `products.image_path` holds a Supabase Storage path, not a URL, but no
bucket exists yet. `venues.owner_id` has no FK to `auth.users` — `drizzle-orm/supabase`
exports an `authUsers` reference that would make one possible if that's ever wanted.

`README.md` describes the **intended** product — QR-code-scannable digital menu on the
customer side, CRUD back office on the manager side, multi-venue, i18n and light/dark theme —
not what exists. Its Roadmap section is the source of truth on what's left to do: only the
technical foundation is checked off there. Don't assume a listed feature exists.

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
