# CLAUDE.md

Guidance for Claude Code (claude.ai/code) working in this repository.

**This file holds what must be known _before_ opening a file.** The detail lives in nested
`CLAUDE.md` files, loaded automatically when you touch their directory:

| File                            | Covers                                                       |
| ------------------------------- | ------------------------------------------------------------ |
| `src/db/CLAUDE.md`              | Schema, migrations, RLS, connection strings                  |
| `src/routes/CLAUDE.md`          | SSR settings, guards, the root shell, `login`'s search param |
| `src/styles/CLAUDE.md`          | The "ardoise" theme, stylesheet layout, visual vocabulary    |
| `src/components/CLAUDE.md`      | Button family, form fields, `surface.ts`, links              |
| `src/features/auth/CLAUDE.md`   | Sign-in only, error translation                              |
| `src/features/menu/CLAUDE.md`   | Prices, photos, stock, the customer menu                     |
| `src/features/orders/CLAUDE.md` | Counter ordering: the two SQL doors, cart, queue             |
| `src/features/venues/CLAUDE.md` | Sidebar, soft delete, QR code                                |

## Commands

The package manager is **npm** (`.cta.json`, `package-lock.json`). `.cursorrules` says
`pnpm dlx`: that's a leftover from the template, ignore it.

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

`postinstall` runs **patch-package**, which applies `patches/nitro+*.patch`. That patch
fixes a race in Nitro that made the dev server answer 500 on SSR — **don't delete it**, and
re-run `npm install` (not just `npm ci --ignore-scripts`) after touching dependencies.

Adding a shadcn/ui component (`npx shadcn@latest add dialog`): **check the generated file
before using it.** Adding `popover` produced `import { cn } from "cn"` — the CLI
mis-resolved the `#/lib/utils` alias and installed an unrelated npm package named `cn`. Fix
the import to `#/lib/utils.ts` and remove the stray dependency.

## Architecture

A **TanStack Start** application with SSR. The logical entry point is `src/router.tsx` →
`getRouter()`, which builds the context via `getContext()`
(`src/integrations/tanstack-query/root-provider.tsx` — a fresh `QueryClient` per request),
creates the router with the generated `routeTree`, `defaultPreload: 'intent'` and
`scrollRestoration`, wires `setupRouterSsrQueryIntegration` to dehydrate the Query cache on
the client, and declares the router type in `declare module '@tanstack/react-router'`, which
makes `Link`/`useNavigate` globally typed.

Routing is file-based in `src/routes/`; `src/routeTree.gen.ts` is generated, never edit it.

`vite.config.ts` — **plugin order matters**: `devtools()`, `nitro()`, `tailwindcss()`,
`tanstackStart()`, `viteReact()`. Nitro acts as a generic server adapter and externalizes
`/^@sentry\//`. The documented deployment target is Vercel, but the build runs on any Node
host (`node .output/server/index.mjs`).

### Feature-based architecture

Code is grouped by **feature**, not by technical kind. A feature owns its screens, its
queries and its domain rules in one directory.

```
src/
  features/    auth/  menu/  orders/  venues/   each: components/, api.ts, mutations.ts, domain modules
  components/  ui/ (shadcn), buttons/, form/, back-office/, home/, cross-screen pieces
  lib/         supabase.ts, postgrest-error.ts, public-menu-url.ts, product-photos.ts,
               money.ts, query-keys.ts, utils.ts
```

- **Only business domains are features.** `back-office/` (the shell) and `home/` (the
  landing page) stay in `src/components/`: they carry no data and no domain rule, and a
  directory holding one presentational file is a folder, not a feature.
- **A component never calls `supabase` directly.** Every read and write goes through the
  feature's `api.ts`, which is also where `camelCase` meets the API's `snake_case`. Route
  files are the exception the rule allows (see `src/routes/CLAUDE.md`).
- **Mutations live in the feature's `mutations.ts`, and invalidate their own query.** A
  component calls `useRenameCategory()`, never `useMutation` on a raw API function. The
  hooks invalidate the key _prefix_ so no component needs to know the slug.
- **Read `mutation.error`, don't mirror it into `useState`.** React Query already holds the
  error, clears it on the next mutation, and exposes `reset()`.
- **Query keys live with their query function** — read the key from the `queryOptions`
  helper rather than retyping `['menu', slug]`, which is how an invalidation ends up
  silently targeting a key nothing reads. **One named exception**: a key a _second_ feature
  must invalidate moves to `src/lib/query-keys.ts`, which currently holds `MENU_QUERY_KEY`
  and `VENUES_QUERY_KEY` — `features/orders` writes stock and `venues.orders_enabled`
  without being allowed to import either feature. A key only one feature invalidates does
  not belong there.
- **No cross-feature imports.** Anything two features need moves down to `src/components/`
  or `src/lib/` — that is why `describeError` lives in `lib/postgrest-error.ts`, and why
  `formatPrice` sits in `lib/money.ts` while the euro _parsing_ stayed in
  `features/menu/price.ts`. When two features must be assembled, the **route** does it:
  `PublicMenu` exposes a `productAction` slot that `m.$venueSlug.tsx` fills with an orders
  component, exactly as `_authenticated.tsx` passes `<VenueNav>` to `BackOfficeShell`.
- **Dependencies point one way**: routes → features → shared. A file under
  `src/components/` or `src/lib/` importing from `#/features/` is the inversion to catch in
  review — nothing enforces it, `import/no-cycle` is disabled.
- **No barrel `index.ts`.** Imports name the file they need
  (`#/features/menu/components/product-row`).

### Import aliases

`tsconfig.json` maps **`#/*` and `@/*`** to `./src/*`, but only `#/*` is declared in
`package.json`'s `imports` field, and shadcn's `components.json` uses it. **Use `#/`** —
`@/` only resolves through the tsconfig paths.

### Data access

**Browser-side `supabase-js` + RLS.** The browser holds the publishable key and talks to
PostgREST directly; Postgres policies — not application code — enforce tenant isolation.
**Drizzle is migrations-only.** Details and invariants: `src/db/CLAUDE.md`.

### Environment variables

Validated with `@t3-oss/env-core` + Zod, **split in two** because the two sides read
different sources:

- `src/env.ts` — client, `runtimeEnv: import.meta.env` (only `VITE_`-prefixed variables).
  Everything declared here ships in the browser bundle, so **public values only**. Holds
  `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (the publishable key,
  `sb_publishable_…`). The Supabase **secret** key must never take a `VITE_` prefix.
- `src/env.server.ts` — server, `runtimeEnv: process.env`, server-only, evaluated lazily
  via `serverEnv()`.

A server variable declared in `src/env.ts` is always `undefined`. Every new variable goes
into one of the two schemas; reading `import.meta.env` or `process.env` directly bypasses
validation.

## Conventions

- **Prettier**: no semicolons, single quotes, trailing commas everywhere. Run
  `npm run format` before committing — but **only on the files you touch**: `npm run check`
  already flags a dozen pre-existing unformatted files from the scaffold (shadcn
  components, `tsconfig.json`, `components.json`, `.cta.json`, `prettier.config.js`,
  `AGENTS.md`), and a global run would rewrite them all and bloat the diff.
- **ESLint**: `@tanstack/eslint-config`, with `import/order`, `sort-imports`,
  `import/no-cycle`, `@typescript-eslint/array-type` and `require-await` **disabled**.
  Don't reorder imports "to make it clean".
- **Strict TypeScript** with `noUnusedLocals` and `noUnusedParameters`: an unused variable
  or parameter breaks the typecheck. `verbatimModuleSyntax` is on → type imports must go
  through `import type`.
- **Never add a dependency without asking — devDependencies included.** No `npm install`
  (with or without `-D`), and no `npx shadcn@latest add <x>` or generator that drags a new
  package in, before the owner has said yes. A test runner, a lint plugin or a build tool
  goes through the same question as a runtime package: "it's only a devDependency" is not a
  reason to skip asking. Proposing one is welcome whenever it genuinely earns its place —
  but as a **question with the case argued both ways**: what problem it solves and what it
  would replace, against its cost (bundle size, transitive deps, last release and
  maintenance, SSR compatibility with TanStack Start, lock-in) and what writing it by hand
  would take. State a recommendation, then wait for the answer.

## UI rules

### Mobile-first

**Every interface is designed and written mobile-first.** Base styles target the smallest
viewport; breakpoints (`sm:`, `md:`, `lg:`) only ever add. Never write the desktop layout
first and walk it back with `max-*` variants.

- **Customer-facing menu**: the phone _is_ the device — the menu is reached by scanning a
  QR code at the table. Desktop must stay usable, but it doesn't need a layout of its own.
- **Back office**: authored mobile-first too (a manager updates a price standing behind the
  bar), but it must **also** get a real desktop layout from `lg:` up — not a phone column
  stretched to 1400px. Multi-column forms, persistent sidebar navigation, tables that use
  the available width, denser spacing, keyboard affordances.
- Touch targets stay at least 44×44px, primary actions within thumb reach, and nothing is
  reachable by hover only.
- Check the small viewport first when verifying a change; a layout that only works at `lg:`
  is unfinished.

### Components

- **Never render a bare `<Button>` in a screen** — `src/components/buttons/` holds the
  whole family, semantic wrappers over two shape primitives.
- **Never hand-write `htmlFor` / `id`** — use `TextField` / `TextAreaField` in
  `src/components/form/`.
- **Links are not buttons**, and text navigation links go through `NavLink`.
- **Destructive actions confirm in a popover**, owned by `DeleteButton`. There is no API
  that deletes on the first click, and focus lands on **Annuler**.

The tables and the reasoning are in `src/components/CLAUDE.md`.

### Design the UI with Emil Kowalski's skills

**Every UI creation or redesign — new page, new component, new user-visible feature — loads
the relevant skill first and follows its `SKILL.md`.** This is not optional, and it adds to
(does not replace) the `npx @tanstack/intent` flow below.

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
`emil-design-eng` frames the design decision, the specialized skill frames the
implementation.

## Skills

`AGENTS.md` requires this before any substantial change:

```bash
npx @tanstack/intent@latest list                     # list the available skills
npx @tanstack/intent@latest load <package>#<skill>   # load the matching one
```

Follow the loaded `SKILL.md` throughout the change. When several match, prefer the local
skill most specific to the area being touched.

External skills follow an npm-like model: `skills-lock.json` (committed) is the source of
truth — GitHub source + hash of each skill; `.agents/skills/` (content) and
`.claude/skills/` (relative symlinks into it) are derived, regenerable and **gitignored**.
Don't commit either — the symlinks would arrive broken for everyone else. `.claude/` itself
is **not** ignored wholesale: a future `settings.json` belongs there and is shared
normally. The personal file to ignore the day it appears is `.claude/settings.local.json`.

## Project status

The data layer, the back office, the customer-facing menu (`/m/$venueSlug`), the printable
QR sheet (`/admin/$venueSlug/qr`), the stock screen (`/admin/$venueSlug/stock`) and counter
ordering (`/admin/$venueSlug/commandes`, plus the order bar on the public menu) all exist.
The "ardoise" theme is in place across the home page, `/login`, the back office and the
public menu.

**Ordering is off by default** on every venue (`venues.orders_enabled`), and turning it on
is the manager's decision, taken from the orders screen.

The home page is a landing page, **not** the customer menu: `/` markets the product,
`/m/$venueSlug` is what a QR code points at.

`README.md` describes the **intended** product, not what exists; its Roadmap section is the
source of truth on what's left. Don't assume a listed feature exists — and note the Roadmap
has itself fallen behind the code more than once, so check for the route or the file before
trusting either document.

The repository is deliberately **unlicensed** (an explicit choice by the owner, don't
reintroduce a `LICENSE` file).
