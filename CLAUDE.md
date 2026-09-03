# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

The package manager is **npm** (`.cta.json`, `package-lock.json`).

```bash
npm run dev              # dev server on port 3000
npm run build            # production build (Vite + Nitro)
npm run preview          # serve the build
npm run generate-routes  # regenerate src/routeTree.gen.ts from src/routes/
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

### Import aliases

`tsconfig.json` maps **`#/*` and `@/*`** to `./src/*`, but only `#/*` is declared in the
`imports` field of `package.json` (standard Node subpath import). shadcn's `components.json`
uses `#/`. **Use `#/`** — `@/` only resolves through the tsconfig paths.

### Environment variables

`src/env.ts` validates the environment at startup with `@t3-oss/env-core` + Zod. The client
prefix is `VITE_`, `emptyStringAsUndefined: true`, and `runtimeEnv` is `import.meta.env`.
A missing or mistyped variable makes **startup fail**, rather than silently passing through.
Every new variable must be added to the schema (`server` or `client`) — reading it directly
via `import.meta.env` bypasses validation.

`SERVER_URL` is an optional placeholder: data persistence hasn't been chosen yet.

### Build and server

`vite.config.ts` — **plugin order matters**: `devtools()`, `nitro()`, `tailwindcss()`,
`tanstackStart()`, `viteReact()`. Nitro acts as a generic server adapter; its `rollupConfig`
externalizes `/^@sentry\//`. The documented deployment target is Vercel, but the Nitro build
runs on any Node host (`node .output/server/index.mjs`).

## Styles

`src/styles.css` (347 lines) is the only style file and contains **two parallel token sets** —
this is the project's main trap:

1. **shadcn tokens** (`--background`, `--primary`, `--border`… in `oklch`, zinc base) defined
   in `:root`, redefined in `.dark`, then exposed to Tailwind via `@theme inline`. They are
   used as utilities: `bg-background`, `text-muted-foreground`, `rounded-lg`.
2. **In-house "coastal" palette** (`--sea-ink`, `--lagoon`, `--lagoon-deep`, `--palm`,
   `--sand`, `--foam`, `--surface`, `--line`, `--hero-a`…) in raw hex/rgba. It is **not**
   mapped in `@theme`, so there is no Tailwind utility: use `var(--lagoon)` in CSS or an
   arbitrary value like `bg-[var(--lagoon)]`. It has **no dark variant** — only the shadcn
   tokens switch.

Dark mode is **class-driven**: `@custom-variant dark (&:is(.dark *))`. So a `.dark` is needed
on an ancestor (nothing sets it for now — no theme provider).

Fonts: **Manrope** as `--font-sans`, **Fraunces** for display titles, loaded by a Google Fonts
`@import` at the top of `styles.css`.

A visual vocabulary is **already written but still unused** in the code: `.page-wrap`,
`.display-title`, `.island-shell`, `.feature-card`, `.island-kicker`, `.nav-link`, `.rise-in`,
`.site-footer`, plus the `body::before`/`body::after` decorations and the `rise-in` animation.
Reuse these classes before inventing new ones.

## Conventions

- **Prettier**: no semicolons, single quotes, trailing commas everywhere. Run `npm run format`
  before committing. Careful: `npm run check` already flags 13 pre-existing unformatted files
  from the scaffold (shadcn components, `src/styles.css`, `tsconfig.json`, `components.json`,
  `AGENTS.md`) — a global `npm run format` would rewrite them all and bloat the diff. Only
  format the files you touch.
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

Freshly initialized scaffold. `src/routes/index.tsx` is still the TanStack template page, and
the `<title>` in `__root.tsx` is still "TanStack Start Starter".

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
