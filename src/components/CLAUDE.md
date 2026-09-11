# Shared components — `src/components/`

Holds `ui/` (shadcn), `buttons/`, `form/`, `back-office/`, `home/`, and the cross-screen
pieces (`nav-link`, `error-note`, `empty-state`, `not-found`, `surface.ts`…).

**Nothing here may import from `#/features/`.** Dependencies point one way: routes →
features → shared. A file under `src/components/` or `src/lib/` reaching into a feature is
the inversion to catch in review — nothing enforces it, `import/no-cycle` is disabled.

`back-office/` (the shell) and `home/` (the landing page) stay here rather than becoming
features: they carry no data and no domain rule.

## Buttons

**Never render a bare `<Button>` in a screen.** Reach for a **semantic** wrapper first —
it names the action, so the icon, the wording and the behaviour can't diverge between two
screens:

| Wrapper        | Renders                         | What it owns for you                                                                                                                                                                                                                                                                                                                   |
| -------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AddButton`    | `Plus` + « Ajouter »            | `pending` swaps the label (`pendingLabel`, default « Ajout… ») **and** disables. Pass children only to qualify the add (« Ajouter un produit »)                                                                                                                                                                                        |
| `SaveButton`   | `Save` + « Enregistrer »        | `type="submit"`, « Enregistrement… » while `pending`, disables                                                                                                                                                                                                                                                                         |
| `CancelButton` | « Annuler »                     | `variant="ghost"`, non-overridable — a cancel must never weigh as much as the action                                                                                                                                                                                                                                                   |
| `EditButton`   | `Pencil`, icon only             | **required** `label`: the icon is shared, what it edits is not                                                                                                                                                                                                                                                                         |
| `DeleteButton` | `Trash2` + confirmation popover | There is no path that deletes on the first click. Focus lands on **Annuler**. `labelled` swaps the icon-only trigger for a labelled outline button (« Vider la corbeille ») — same single `label` prop, visible there, `aria-label` here. `icon` and `confirmLabel` name a destruction that isn't a deletion (« Annuler la commande ») |
| `MoveButtons`  | `ChevronUp`/`ChevronDown` pair  | Both `aria-label`s, `disabled` at the list's ends                                                                                                                                                                                                                                                                                      |
| `CopyButton`   | `Copy`, icon only               | The confirmation: green check + a `role="status"` announcement for 2s, a destructive cross if the clipboard refuses. **required** `label`                                                                                                                                                                                              |

Under them sit the two **shape** primitives, for genuine one-offs only (« Se connecter »,
« Déconnexion ») — anything recurring deserves a wrapper instead:

| Primitive      | For       | Owns                                                                                                       |
| -------------- | --------- | ---------------------------------------------------------------------------------------------------------- |
| `ActionButton` | Labelled  | `h-11` on mobile, desktop height from `surface` (`page`/`panel`/`popover`), leading `icon`, press feedback |
| `IconButton`   | Icon-only | 44×44 mobile / 36 desktop, **required** `label` → `aria-label`, `tone="destructive"`, press feedback       |

Both wrap shadcn's `Button` rather than editing it — `ui/` stays regenerable.
`ActionButton` defaults `type="button"`: inside a form, a missing `type` silently turns a
cancel button into a submit.

**`ActionButton` supports `asChild`, and only because its children are wrapped in
`Slot.Slottable`.** It renders two nodes — the icon, then the label — while Radix's `Slot`
accepts exactly one. Without the marker, `<ActionButton asChild>` around a `Link` does not
degrade: it **throws** (« Slot failed to slot onto its children ») and takes the whole
screen into its `CatchBoundary`. That is how the stock page's « Scanner un code-barres »
entry broke on its first render. The marker names the child that receives the merge and
leaves the icon beside it, which is the wanted layout; it is inert when `asChild` is
absent. `IconButton` needs none — it has a single child by construction.

That escape hatch does not license drawing every link as a button: **links are not
buttons** (below). It is for a screen's primary call to action that happens to navigate —
today, the one entry into the scanner on the phone, and « Demander un nouveau lien » on
the dead-recovery-link screen, where it is the only way out.

**One two-step control, not several.** `icon` / `confirmLabel` exist so that cancelling a
customer's order can reuse `DeleteButton` instead of growing a second confirmation
mechanism: it is the focus placement below that is the invariant, and duplicating the
component would duplicate the way it breaks.

**`DeleteButton`'s focus placement is a real invariant.** The popover opens from the
keyboard too, and a reflex Enter must not destroy a category. If you touch that component,
re-check it in a browser — the ref chain that puts focus on **Annuler** crosses three
components and no type error will tell you it broke. Confirmation is a popover anchored to
the trash button, not inline (it pushed the surrounding row around) and not
`window.confirm` (blocks the thread, can't be styled).

## Fields — `form/`

| Component       | Owns                                                                                                             |
| --------------- | ---------------------------------------------------------------------------------------------------------------- |
| `TextField`     | `useId()` wiring, `<Label>`, height from `surface`, optional `hint`, `hiddenLabel`                               |
| `TextAreaField` | Same, minus `surface` — a textarea sizes by `rows`, it has no resting height to match                            |
| `ImageField`    | A hidden file input driven by a button, a thumbnail, « Remplacer » / « Retirer » — and no image state of its own |

On both, `className` dresses the **block** (that's what you put in a grid or grow with
`flex-1`); `inputClassName` / `textareaClassName` dress the control.

**Never hand-write `htmlFor` / `id` again.** It is the one part of a field that breaks in
silence: a typo raises no error and fails no type — it just leaves the input nameless to a
screen reader and stops the label from focusing it. `hiddenLabel` keeps the wiring where
the layout replaces a title and can show no label.

**`ImageField` takes its preview as a URL**, resolved by the form: `useObjectUrl(file)`
(exported next to it, revokes on change and unmount) for a file just picked, the public
Storage URL otherwise. The settings screen draws the same logo twice — in the field and in
the day/night preview — and one URL serves both. `fit="contain"` lays the thumbnail on a
flat mid-tone (`--ink` and `--surface` mixed half and half), where a dark logo and a white
one both stay legible. **Not a checkerboard**, though it is the usual sign for
transparency: tried with a cream logo, it vanished on `--line`/`--surface` squares, and
even with darker squares half of it still sat on white — at 64px the pattern was louder
than the logo. How the logo really looks on the board is the preview's job. Its hidden input is out of the tab order; the button is the control. It needs no
`htmlFor`: the label names a group, not an input.

## `venue-logo.tsx`

`VenueLogo` draws a venue's logo on the board. It is here because the customer menu
(`features/menu`) and the settings preview (`features/venues`) both render it, and it takes
a **URL**, not a storage path, because the preview shows a file that has no path yet.

- **Fixed height, free width.** The height is in the SSR'd HTML, so nothing below moves
  when the image arrives; the logo sits on a row of its own, so its growing width pushes
  nothing aside. `object-contain` under `max-w-*` keeps a long wordmark in proportion.
- **`plate`** lays it on `bg-on-board`, the chalk. The `plated` sizes are the `bare` ones
  minus the plate's padding, so toggling the plate never moves the kicker and the title
  below. `size="preview"` is the same component at the scale of `ThemePreview`: the plate
  the manager judges is the one the customer sees.
- **`alt=""`**: the venue's name is set in full right under it. Same call as the product
  photos on the carte.

## `surface.ts`

**`SURFACE_HEIGHT` is shared between buttons and fields**, and that sharing is the point:
in « Nouvelle catégorie » an input and an `AddButton` sit on the same row. `surface` names
where the control sits rather than its height, because only the desktop density varies —
mobile is always 44px. Two tables maintained apart would drift by a pixel and put the row
out of line.

## Loading — `skeleton.tsx` / `skeleton.css`

**No screen renders « Chargement… » as text.** Each waiting screen draws an ossature at
the dimensions of what is coming, from `Skeleton` (one bar), `SkeletonScreen` (the
`role="status"` wrapper), and the three shapes every back-office header shares —
`SkeletonHeader`, `SkeletonAddress`, `SkeletonLine`.

- **A screen's ossature lives in that screen's file**, below the component it replaces
  (`MenuEditorSkeleton` in `menu-editor.tsx`, and so on). Its only job is to look like the
  screen; filed anywhere else it would stop being updated with it.
- **Measure lines in `h-[1lh]`, not in pixels.** The unit is the element's computed
  line-height, so a bar given the real type classes (`text-2xl leading-tight sm:text-3xl`)
  is exactly as tall as the line it stands for — at every breakpoint. The three headers
  now land on the same pixel as the loaded screen; hard-coded heights were 46px short.
- **`bg-skeleton` is the tint**, a translucent ink mix (see `src/styles/CLAUDE.md`): the
  same bar sits on a white `.panel` and on the page ground, and no opaque colour works on
  both. The QR sheet is the one override — `bg-neutral-200`, because that sheet is white
  in both themes.
- **Two movements, and only one loops**: each bar writes itself left-to-right once
  (`clip-path`, staggered by `delay`), then a chalk sheen sweeps the screen in a single
  wave — every bar shares the sweep's timing, so their phases coincide. Under
  `prefers-reduced-motion` both stop and the ossature simply stands there.
- **The ossature itself waits 140 ms** before fading in (`.skeleton-screen`), so a cached
  response doesn't flash one.
- **`SkeletonScreen` puts the layout in a child**, not on the status element: an `sr-only`
  label glued in as the first child of a `divide-y` list or a grid would take a divider or
  a cell.

## `product-size.tsx`

`ProductSize` draws a product's serving format — « 50cl », « au fût » — and `productLabel`
is its text form for an `aria-label`. It sits here rather than in `features/menu` because a
ticket names its lines the way the menu does: the cart sheet, the counter's queue and the
customer's tracker all render one, and `features/orders` may not import from
`features/menu`. Same move as `formatPrice` before it.

**A qualifier, not a badge.** The format is set in the flow of the name — softer ink, a
shade smaller, inside the name's own line box — and never in a pill: the bordered pill is
`StockBadge`, and it means something is wrong. Being inside the line box is also what puts
the customer menu's leader rule _after_ the format, the way a printed carte sets it. Its
size is in `em`, not `rem`: the same span is rendered in a 14px ticket line and a 16px menu
row, and in both it must read one notch below the name it follows.

## Links

**Links are not buttons.** A destination gets an `<a>`, never a `<button>` calling
`navigate()` — that would lose middle-click, open-in-new-tab and copy-link. The home
page's « Espace gérant » is a link drawn as a button and its classes stay inline: it is
the only one in the app, on a placeholder landing page. Should a second appear, wrap it
with TanStack's `createLink` — a hand-written signature around `Link` compiles but
silently drops the inference on `to` and `params`, so a renamed route then fails at
runtime instead of at build.

**Text navigation links go through `NavLink`** (`nav-link.tsx`), which lays the label out
with its optional `icon` and keeps `to` inferred via `createLink`. Outgoing links take the
same component under its `ExternalNavLink` export — same implementation, reached with an
`href`. `NavLink` deliberately sets **no default `activeProps`**: the router treats a link
as active as soon as the URL merely starts with its target, so a back link to `/admin`
would stay underlined from `/admin/le-comptoir`. The sidebar asks for it explicitly; a
back link must not.

**The 44px touch target stays in `.nav-link` (`nav-link.css`), not in the component.**
That class already owns the link's identity — colour, hover, the underline that grows from
the left. The rule sits **outside any `@layer`**, so it beats a `min-h-*` utility written
at the call site: deliberate, but know it before trying to override it. `display` stays at
the call sites, since the sidebar needs `flex` where the others want `inline-flex`.

**A nav link draws two boxes, and the underline hangs on the inner one.** The tapped box
is 44px tall; the underlined box is the height of the text. `.nav-link-label` — the span
`nav-link.tsx` wraps around `children` — carries the `::after` at `bottom: -2px`. Hung on
the `<a>` instead, the line landed a dozen pixels below a 14px label centred in 44px and
ran under the leading icon. Consequence: **`.nav-link` written by hand on a tag gives the
colour and the target but no underline** — every call site goes through the component. The
label is `inline-flex` with `gap: inherit` because a trailing icon can be a child, and
Tailwind's preflight renders `svg` as `display: block`, which would break the line inside
an inline container.

## `not-found.tsx`

The 404 screen, mounted by the root route's `notFoundComponent` and by
`/m/$venueSlug`'s. It renders the **requested path as a menu row** — the address at one
end, « épuisé » at the other — on the chalkboard, and strikes it through: the gesture a bar
makes when something runs out, which is what a dead URL is. The stroke replaces the
customer menu's `.menu-leader`, doing that leader's job of carrying the eye across the row
on its way through; drawing both put two near-parallel rules a few pixels apart. `title`, `children` and `action` default
to the general wording; `action={null}` is the way to say a screen has no way out to offer
(the customer menu's, where the landing page would be a sales pitch to someone holding a
phone at a table).

**It is not an `EmptyState`.** An empty list is a state the manager can fix from the screen
they are on; a 404 is a dead end whose only exit is elsewhere. The path is read with
`useRouterState`, not taken as a prop — inside a `notFoundComponent` the loader data is
undefined by construction.

The motion, and why a screen seen this rarely may afford it, is in `not-found.css` and
`src/styles/CLAUDE.md`.

## `back-office/`

`BackOfficeShell` takes its navigation as a `nav` prop rather than building it: listing
venues is the venues domain, and this directory must not import from `#/features/`.

It takes a second slot, **`navFooter`** — the column's bottom zone, pinned above the
identity and the sign-out, for what belongs to the tool rather than to the work (the bin,
today). A separate prop and not the tail of `nav`, because the two zones are a full column
apart: one stretched `nav` would make the shell responsible for the gap between its own
items. Like `nav`, it only renders from `lg`, and it draws **no separator of its own** —
that belongs to whatever is put in it, so an empty zone leaves no trace.

`MenuAddress` (`back-office/menu-address.tsx`) draws `/m/<slug>` as a **control, not a
caption**: a link opening the customer menu in a **new tab** — the manager checks the
result and comes back to the form they left — next to a `CopyButton` that copies the
**absolute** URL, since `/m/x` pasted in a message leads nowhere. It lives here because
both `features/venues` (the venue card) and `features/menu` (the editor's header) render
it.
