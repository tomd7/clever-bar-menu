# Styles

`src/styles.css` is the **entry point and nothing else**: it declares no rule, it only
`@import`s. The stylesheet is split the way the code is — by who owns it:

```
src/
  styles.css                                   entry: @imports only, in cascade order
  styles/
    theme.css        palette, shadcn contract, @theme inline
    menu-theme.css   per-venue themes: [data-menu-theme] token overrides
    base.css         bare elements (html, body, a, code, pre) + @layer base *
    vocabulary.css   .page-wrap .display-title .island-shell .panel .feature-card .island-kicker
    motion.css       the global transition, .rise-in, prefers-reduced-motion
    print.css        .no-print + the white page ground
  components/
    nav-link.css     .nav-link            (next to nav-link.tsx)
    not-found.css    .slate, .chalk-line  (the 404 slate)
    site-footer.css  .site-footer
    skeleton.css     .skeleton, .skeleton-screen  (l'ossature de chargement)
  features/venues/components/
    venue-nav.css    .rail-link
    venue-qr.css     .print-sheet
  features/menu/components/
    menu-nav.css     .scrollbar-none, .rail-fade (stock-page reuses the pair)
    public-menu.css  .menu-leader
  features/orders/components/
    open-orders-count.css  .orders-count
```

- **A class only one screen uses lives next to that screen**; a class two screens share
  moves up to `vocabulary.css`. Same rule as the TypeScript modules — a component's CSS is
  found by opening the component's directory, and it disappears with it.
- **Assembly is by `@import`, not by `import './x.css'` in the component.** Tailwind
  flattens those imports before processing the sheet, which keeps `@apply` and the
  `@theme` tokens available in every file, ships **one** stylesheet (`__root.tsx` links it
  with `?url`, and the SSR'd public menu must not flash), and keeps the cascade order
  readable — it is the import list, top to bottom. A file imported through JS would need
  `@reference` and would land in the cascade wherever the bundler chose.
- **`--skeleton` is the one palette token declared in the derivation block**
  (`:root, .dark`) rather than in the two palettes: it is `color-mix(in oklab, var(--ink)
11%, transparent)`, so a single expression follows both themes. A flat colour was tried
  first and failed — `--surface-raised` reads on a white `.panel` and vanishes on the page
  ground. `--chalk-sheen`, the sweep that crosses it, _is_ declared twice, and it is the
  only token whose night value is not a restatement of its day value but its inverse:
  white paper by day, chalk at very low opacity by night.
- **The component imports come after the shared ones**, so a component rule can win
  against the shared vocabulary at equal specificity, never the other way round. Print is
  last: it undoes most of what precedes.

## The "ardoise" theme

Slate board, chalk, and a bottle green, in a **single token set** — the structural point
to preserve:

1. **House palette** (`--ink`, `--ink-soft`, `--ground`, `--surface`, `--surface-raised`,
   `--line`, `--line-soft`, `--bottle`, `--bottle-deep`, `--on-bottle`, `--primary-fill`,
   `--on-primary-fill`, `--danger`…) defined in `:root` (day: light stone, graphite ink)
   and redefined in `.dark` (night: `#1a1e1c` slate, chalk). This is the **source of
   truth**.
2. **shadcn contract** (`--background`, `--primary`, `--border`…) **derived** from it in a
   `:root, .dark` block: `--primary: var(--primary-fill)`, `--background: var(--ground)`.
   Never give a shadcn token a literal colour — change the house token instead, and both
   themes follow.

An earlier "bar du soir" palette (cream, amber `--brass`, Fraunces display) and an older
"coastal" one were removed: warm cream + high-contrast serif + amber reads as a generated
template, and an amber that light is the colour of a default warning state. Don't
reintroduce that combination.

### Easy to get wrong

- **The derivation block targets `:root, .dark`, not just `:root`.** A custom property is
  substituted on the element that _declares_ it, so `--background: var(--ground)` declared
  only on `:root` would compute against the light `--ground` and be inherited as-is by a
  `.dark` subtree. Listing both selectors makes the substitution happen again on `.dark`.
- **Style bare elements inside `@layer base`, never outside it.** A rule written outside
  any cascade layer beats _every_ layered rule regardless of specificity, and Tailwind's
  utilities live in `@layer utilities`. An unlayered `a { color: … }` therefore won
  against the `text-primary-foreground` of a link drawn as a button — a link rendered in
  green on its ink fill, unreadable. `.nav-link` stays **outside** any layer on purpose:
  it must win.
- **`@layer base` must not set `body { background-color }`.** shadcn's default rule did,
  and it silently overrode the `body` rule — the whole house palette was invisible. The
  body's colour is set in the `body` rule only.
- **Two greens, on purpose.** `--bottle` is a _fill_ (dark, so it needs light ink:
  `--on-bottle`) and both stay put across themes because the fill stays dark.
  `--bottle-deep` is the _text_ accent and is the only one that flips — dark green on
  stone, pale green on slate. Don't collapse them.
- **`--board` is the chalkboard itself, and it does not flip.** The customer menu's header
  is that surface (`--board` ground, `--on-board` chalk, `--on-board-soft` for secondary
  text, `--bottle-chalk` for the only accent legible on it). Frozen across themes for the
  same reason as `--bottle`/`--on-bottle`: a chalkboard is dark at any hour. Its value
  sits _below_ the night `--ground` so the panel still detaches when the page has gone
  dark.
- **The primary action is ink, not colour.** `--primary` derives from `--primary-fill`
  (graphite by day, chalk by night), never from `--bottle`. Green signals — link, focus
  ring, section label, active underline — it never fills a "Enregistrer" button.
- **The background is a flat fill.** No gradient, no radial halo, no grid overlay;
  `body::before` / `body::after` do not exist. Depth comes from the 1px `--line`, not from
  a large shadow — hence two short shadows (`--shadow-1`, `--shadow-2`) and no
  `--shadow-3`.
- **Both token sets are mapped in `@theme inline`**, so the house palette has real
  utilities: `text-ink-soft`, `border-line`, `bg-surface-raised`, `text-bottle-deep`.
  Prefer them over `text-[var(--ink-soft)]`. Tailwind ships no `bottle-*` scale, which is
  the point of the name.

## Per-venue themes

`venues.theme` names a theme; `PublicMenu` puts it on its root element as
`data-menu-theme`, and `styles/menu-theme.css` repaints a handful of tokens on that
subtree. Scope is **the board and the accents, never the ground**: `--ground`, `--surface`,
`--line`, `--ink` and `--primary-fill` stay the house palette, so a menu keeps the contrast
it was designed with and `--primary` stays ink.

Two substitution facts make or break the approach, and neither is visible from the markup:

- **`--ring` has to be restated on the theme element.** It is derived on `:root, .dark` as
  `var(--bottle-deep)`, and a custom property is substituted on the element that _declares_
  it — so it resolves against the root's green and comes down already resolved. Since
  `base.css` applies `outline-ring/50` to `*`, forgetting this leaves every focus ring on a
  themed menu in the house colour. `[data-menu-theme] { --ring: var(--bottle-deep) }`
  replays this file's own `:root, .dark` trick one level down. `--chart-1` and
  `--sidebar-ring` are frozen the same way and are deliberately left alone — neither
  appears on the customer menu.
- **`@theme inline` is what lets the utilities follow.** `inline` bakes the `var()` into
  each utility, so `bg-board` and `text-bottle-chalk` resolve where they sit, inside the
  subtree. Verified in the built sheet: `.text-bottle-deep{color:var(--bottle-deep)}` — the
  utility points at the house token, not at an intermediate frozen on `:root`. (Tailwind
  does still emit one inert `--color-bottle-deep:var(--bottle-deep)` there; nothing reads
  it, `var(--color-bottle-deep)` appears zero times.) Drop the `inline` and per-venue
  theming stops working.

**Each theme declares its two readings once, and three generic rules pick one.** A theme
block sets `--theme-bottle-day` / `--theme-bottle-night` (and the same pair for
`--bottle-deep`); `[data-menu-theme]`, `.dark [data-menu-theme]` and `.light
[data-menu-theme]` decide which pair is live. The order of those three is the whole trick:
`.dark` and `.light` have equal specificity, so the later one wins, which is what lets a
**forced day preview exist inside a back office that is itself in night mode**. `.dark`
alone could never be undone — it sits on `<html>` and is an ancestor of everything.

That is also why `theme.css`'s day palette answers to `:root, .light` and its derivation
block to `:root, .light, .dark`: `.light` is not a second palette, it is the same
declarations given a class so a subtree can claim them. `venue-settings.tsx` is the only
caller today — it shows the carte in both temperatures side by side, because dark mode
follows the phone with no switch, so a manager picking a theme at noon is also picking what
a customer reads at 11pm.

`[data-menu-theme='ardoise']` restates the house greens as `--theme-*`. Everywhere else
that block is a no-op — it says what the element already inherits — and it exists purely so
a preview forced to the _other_ reading can reach values that otherwise live only on
`:root`. Don't "simplify" it away.

Adding a theme is three edits that travel together: `VENUE_THEMES` + the
`venues_theme_allowed` check (`src/db/schema.ts`), the catalogue in `src/lib/menu-theme.ts`,
and a block here. Miss the last one and the menu renders an attribute no rule matches —
silent, and it reads as a design choice.

## Dark mode

**Class-driven** (`@custom-variant dark (&:is(.dark *))`) and follows the system: an
inline `ScriptOnce` in `src/routes/__root.tsx` toggles `.dark` on `<html>` from
`prefers-color-scheme` before hydration, and keeps listening. There is deliberately **no
toggle and no `localStorage`** — the customer menu follows the phone. `<html>` carries
`suppressHydrationWarning` because the server renders it without the class.

Two `theme-color` metas are written **directly in the shell's `<head>`**, not in
`head.meta`: the router dedupes metas by `name` and would keep only one. Their values
(`#eeefec` / `#1a1e1c`) are the two `--ground`s, so they move with the palette.

## Fonts

**One family, Archivo**, loaded variable on two axes (`wdth` 62–125, `wght` 100–900) by a
Google Fonts `@import` at the top of `styles.css`. `--font-sans` and `--font-display` are
both Archivo: the difference between a heading and a paragraph is carried by **width and
weight**, not by a second typeface. `.display-title` is where that identity lives
(`font-stretch: 112%`, weight 700) — the one place this theme raises its voice, which is
why everything around it stays quiet.

## Visual vocabulary

Reuse these before inventing new ones.

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

### The 404 slate

`.slate` (`components/not-found.css`) is a **fourth surface**, and deliberately not one of
the three above: `.island-shell` and `.panel` are built on `--surface`, which flips with the
theme, while `--board` is frozen dark. It takes the showcase's `--shadow-2` — a 404 is a
shopfront, not a tool.

`.chalk-line` plays the theme's gesture **once**: the row writes itself left to right
(`clip-path`, the same reveal as `.skeleton`), then a stroke crosses it out. Nothing loops —
that screen is not waiting for anything. Its `prefers-reduced-motion` block is named rather
than left to `motion.css`: that one collapses durations but leaves `animation-delay`
standing, which would still drop the stroke into place 900 ms late.

`@media (prefers-reduced-motion: reduce)` neutralises movement while keeping fades. The
global `transition` rule covers colours only — `transform` is left to the components,
which declare their own `active:scale-[0.97]`.
