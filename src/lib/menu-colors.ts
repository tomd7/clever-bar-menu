/**
 * Custom colours for a customer menu — the roles, the maths, and the contract
 * with `styles/menu-theme.css`.
 *
 * In `lib/` for the reason `menu-theme.ts` and `menu-fonts.ts` are:
 * `features/venues` writes the palette from the settings screen,
 * `features/menu` renders it on the carte, and neither feature may import the
 * other.
 *
 * **A custom palette is an edited copy of a named theme, not a blank form.**
 * The venue keeps its `venues.theme`, and a row in `venue_themes` repaints six
 * roles on top of it — which is what gives a custom carte a complete day *and*
 * night reading from the first second, and what makes going back one gesture:
 * delete the row.
 *
 * The whitelist of roles lives in three places that move together:
 *
 *   1. the columns of `venue_themes` and `venue_themes_colors_format`
 *      (`src/db/schema.ts`)
 *   2. `MENU_COLOR_ROLES` below, with `menuPaletteStyle`
 *   3. the `[data-menu-custom]` blocks of `src/styles/menu-theme.css`
 *
 * Miss the third and the carte inlines custom properties no rule reads — which
 * is silent, and reads as a design choice.
 */

import type { CSSProperties } from 'react'

/**
 * The WCAG AA ratio for body text, and the line this module refuses to cross.
 *
 * It is not decoration: `CLOCLO-25` chose named palettes over a colour picker
 * precisely because a picker lets a manager publish a carte nobody can read at
 * a table, at night, on a phone at half brightness. Every derived value below
 * is repaired up to this ratio, and every value a manager types is measured
 * against it — `venue-settings.tsx` refuses to save under it.
 */
export const MENU_CONTRAST_MIN = 4.5

/** What a hex column accepts, restated by `venue_themes_colors_format`. */
const HEX_COLOR = /^#[0-9a-f]{6}$/

/**
 * The six things a manager can colour.
 *
 * Six, and the number is the decision: the issue's eight would have needed
 * three new house tokens (a category title, a product name and a price all read
 * `--ink` today) for a distinction nobody makes when choosing, while four left
 * a carte that still looked like everyone else's. These six each land on house
 * tokens that already exist.
 *
 * `surface` names the role a text role is read **on**, which is the whole
 * contrast story: `ink` and `inkSoft` sit on the sheet, `onBoard` on the
 * board, and `accent` is measured on the sheet because that is where it is
 * read as text (its board-legible variant is derived, see `menuPaletteStyle`).
 * A `null` surface is a surface itself.
 */
export const MENU_COLOR_ROLES = [
  {
    id: 'ground',
    label: 'Fond',
    hint: 'La feuille de la carte, et la page derrière elle.',
    surface: null,
  },
  {
    id: 'board',
    label: 'Bandeau',
    hint: 'Le panneau qui porte votre nom, en haut de la carte.',
    surface: null,
  },
  {
    id: 'onBoard',
    label: 'Texte du bandeau',
    hint: 'Votre nom et votre description, sur le bandeau.',
    surface: 'board',
  },
  {
    id: 'ink',
    label: 'Texte de la carte',
    hint: 'Les titres de sections, les produits et les prix.',
    surface: 'ground',
  },
  {
    id: 'inkSoft',
    label: 'Texte secondaire',
    hint: 'Les descriptions, sous les produits et les sections.',
    surface: 'ground',
  },
  {
    id: 'accent',
    label: 'Accent',
    hint: 'La petite mention au-dessus du nom, les liens, le sommaire.',
    surface: 'ground',
  },
] as const satisfies ReadonlyArray<{
  id: string
  label: string
  hint: string
  surface: string | null
}>

export type MenuColorRole = (typeof MENU_COLOR_ROLES)[number]['id']

/** One reading of a custom palette: a hex per role. */
export type MenuColorSet = Record<MenuColorRole, string>

/** Both readings. A palette always carries the two — see `deriveNightColors`. */
export type MenuPalette = {
  day: MenuColorSet
  night: MenuColorSet
}

/**
 * The palette as `venue_themes` holds it, in the API's `snake_case`.
 *
 * Twelve columns rather than a `jsonb`: each one carries its own regular
 * expression in `venue_themes_colors_format`, PostgREST types them, and a
 * seventh role is a migration rather than a document shape nothing polices.
 */
export type MenuPaletteRow = {
  ground_day: string
  ground_night: string
  board_day: string
  board_night: string
  on_board_day: string
  on_board_night: string
  ink_day: string
  ink_night: string
  ink_soft_day: string
  ink_soft_night: string
  accent_day: string
  accent_night: string
}

/** The column holding a role, per reading. Written once, read both ways. */
const ROLE_COLUMNS = {
  ground: ['ground_day', 'ground_night'],
  board: ['board_day', 'board_night'],
  onBoard: ['on_board_day', 'on_board_night'],
  ink: ['ink_day', 'ink_night'],
  inkSoft: ['ink_soft_day', 'ink_soft_night'],
  accent: ['accent_day', 'accent_night'],
} as const satisfies Record<
  MenuColorRole,
  readonly [keyof MenuPaletteRow, keyof MenuPaletteRow]
>

/** Whether a string is a hex colour this module will accept. */
export function isHexColor(value: string): boolean {
  return HEX_COLOR.test(value)
}

/**
 * Normalises what an `<input type="color">` or a manager types.
 *
 * The native picker always hands back `#rrggbb`; a typed value may miss its
 * `#`, come in capitals, or be a three-digit shorthand. Anything else returns
 * `null`, and the field keeps the text without committing it.
 */
export function parseHexColor(value: string): string | null {
  const trimmed = value.trim().toLowerCase()
  const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`

  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(withHash)
  if (short) {
    return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`
  }

  return HEX_COLOR.test(withHash) ? withHash : null
}

/**
 * Reads a palette off a `venue_themes` row.
 *
 * A row this build cannot read whole — a column added by a newer deployment
 * and missing here, a value edited by hand — degrades to `null`, and the carte
 * falls back to its named theme. Same failure mode as `parseMenuTheme`: the
 * alternative is a carte inlining half a palette, which looks deliberate.
 */
export function parseMenuPalette(
  row: MenuPaletteRow | null | undefined,
): MenuPalette | null {
  if (!row) return null

  const day = {} as MenuColorSet
  const night = {} as MenuColorSet

  for (const role of MENU_COLOR_ROLES) {
    const [dayColumn, nightColumn] = ROLE_COLUMNS[role.id]
    const dayValue = row[dayColumn]
    const nightValue = row[nightColumn]

    if (!isHexColor(dayValue) || !isHexColor(nightValue)) return null

    day[role.id] = dayValue
    night[role.id] = nightValue
  }

  return { day, night }
}

/** The palette as the twelve columns, for an insert or an update. */
export function menuPaletteToRow(palette: MenuPalette): MenuPaletteRow {
  const row = {} as MenuPaletteRow

  for (const role of MENU_COLOR_ROLES) {
    const [dayColumn, nightColumn] = ROLE_COLUMNS[role.id]
    row[dayColumn] = palette.day[role.id]
    row[nightColumn] = palette.night[role.id]
  }

  return row
}

/* ------------------------------------------------------------------ colour */

/*
  Two colour spaces, and they are not interchangeable.

  **sRGB relative luminance** is what WCAG defines a contrast ratio on. It is
  the only thing that may decide whether a carte is readable, so every check
  below goes through `luminance`.

  **Oklab** is what the derivations move through, because its L is
  perceptually even: raising the lightness of a red and of a blue by the same
  amount raises them by the same *apparent* amount, which sRGB's does not. Used
  for the night reading and for repairing contrast — never for measuring it.
*/

type Rgb = [number, number, number]

function hexToRgb(hex: string): Rgb {
  return [
    Number.parseInt(hex.slice(1, 3), 16) / 255,
    Number.parseInt(hex.slice(3, 5), 16) / 255,
    Number.parseInt(hex.slice(5, 7), 16) / 255,
  ]
}

function rgbToHex([r, g, b]: Rgb): string {
  const channel = (value: number) =>
    Math.round(Math.min(1, Math.max(0, value)) * 255)
      .toString(16)
      .padStart(2, '0')

  return `#${channel(r)}${channel(g)}${channel(b)}`
}

/** sRGB transfer function, in the form WCAG 2 writes it. */
function toLinear(channel: number): number {
  return channel <= 0.03928
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4
}

function fromLinear(channel: number): number {
  return channel <= 0.0031308
    ? channel * 12.92
    : 1.055 * channel ** (1 / 2.4) - 0.055
}

/** WCAG relative luminance. */
function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex)
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
}

/**
 * The WCAG contrast ratio between two opaque colours, from 1 to 21.
 *
 * Both arguments must be opaque hexes: nothing on the carte lays text on a
 * translucent surface, and a ratio computed against `transparent` would be a
 * number that means nothing.
 */
export function contrastRatio(a: string, b: string): number {
  const first = luminance(a)
  const second = luminance(b)
  const lighter = Math.max(first, second)
  const darker = Math.min(first, second)

  return (lighter + 0.05) / (darker + 0.05)
}

type Oklab = { l: number; a: number; b: number }

function hexToOklab(hex: string): Oklab {
  const [r, g, b] = hexToRgb(hex).map(toLinear) as Rgb

  const long = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const medium = Math.cbrt(
    0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b,
  )
  const short = Math.cbrt(
    0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b,
  )

  return {
    l: 0.2104542553 * long + 0.793617785 * medium - 0.0040720468 * short,
    a: 1.9779984951 * long - 2.428592205 * medium + 0.4505937099 * short,
    b: 0.0259040371 * long + 0.7827717662 * medium - 0.808675766 * short,
  }
}

function oklabToRgb({ l, a, b }: Oklab): Rgb {
  const long = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const medium = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const short = (l - 0.0894841775 * a - 1.291485548 * b) ** 3

  return [
    fromLinear(
      4.0767416621 * long - 3.3077115913 * medium + 0.2309699292 * short,
    ),
    fromLinear(
      -1.2684380046 * long + 2.6097574011 * medium - 0.3413193965 * short,
    ),
    fromLinear(
      -0.0041960863 * long - 0.7034186147 * medium + 1.707614701 * short,
    ),
  ]
}

/**
 * Oklab back to a hex, brought inside sRGB by giving up chroma, never
 * lightness.
 *
 * Moving a colour's L almost always takes it out of the sRGB gamut — a
 * saturated blue simply has no light version. Clipping the channels would
 * shift the hue, so the chroma is scaled down (a binary search, twelve steps,
 * about a quarter of a percent) until the colour fits. What the manager asked
 * for is the tone; what they get is the nearest one this screen can show.
 */
function oklabToHex(color: Oklab): string {
  const inGamut = (rgb: Rgb) => rgb.every((c) => c >= -0.001 && c <= 1.001)

  const full = oklabToRgb(color)
  if (inGamut(full)) return rgbToHex(full)

  let low = 0
  let high = 1

  for (let step = 0; step < 12; step += 1) {
    const mid = (low + high) / 2
    const candidate = oklabToRgb({
      l: color.l,
      a: color.a * mid,
      b: color.b * mid,
    })

    if (inGamut(candidate)) low = mid
    else high = mid
  }

  return rgbToHex(
    oklabToRgb({ l: color.l, a: color.a * low, b: color.b * low }),
  )
}

/** The same colour at another Oklab lightness — hue and chroma kept. */
function withLightness(hex: string, lightness: number): string {
  const color = hexToOklab(hex)
  return oklabToHex({
    l: Math.min(1, Math.max(0, lightness)),
    a: color.a,
    b: color.b,
  })
}

/**
 * Pushes a text colour away from its surface until it reads.
 *
 * It only moves the lightness, and only in the direction the pair already
 * leans — a dark text on a light ground gets darker, never inverted. Sixty
 * steps of 0.015 cover the whole range, so the loop ends either satisfied or
 * at black or white, whichever it was heading for. The caller gets the best
 * this hue can do; whether that is enough is `paletteContrast`'s answer, not
 * this function's.
 */
export function ensureContrast(
  text: string,
  surface: string,
  minimum: number = MENU_CONTRAST_MIN,
): string {
  if (contrastRatio(text, surface) >= minimum) return text

  const darken = luminance(text) < luminance(surface)
  const start = hexToOklab(text).l

  let best = text

  for (let step = 1; step <= 60; step += 1) {
    const lightness = darken ? start - step * 0.015 : start + step * 0.015
    if (lightness < 0 || lightness > 1) break

    best = withLightness(text, lightness)
    if (contrastRatio(best, surface) >= minimum) return best
  }

  return best
}

/* ------------------------------------------------------------- derivations */

/**
 * A surface's night value.
 *
 * A light surface goes dark, in the band the house night ground already
 * occupies and keeping the order it came in — a paler beige stays the paler of
 * two at night. A surface that is **already dark stays as it is**, which is the
 * rule `styles/CLAUDE.md` states for `--board`: a board at the door of a bar is
 * dark at any hour, and a manager who painted one dark did not ask for it to
 * light up at eleven at night.
 */
function nightSurface(hex: string): string {
  const { l } = hexToOklab(hex)
  if (l <= 0.5) return hex

  /* 0.5 → 0.30, 1 → 0.18: the lighter it was, the deeper it goes. */
  return withLightness(hex, 0.3 - (l - 0.5) * 0.24)
}

/**
 * A text colour's night value, on its own night surface.
 *
 * It flips only when it has to: a colour that still separates from the night
 * surface keeps its lightness, which is what lets chalk on a dark board go
 * through the night unchanged. Otherwise it is mirrored, then repaired up to
 * `MENU_CONTRAST_MIN`, so a derived night reading is never the unreadable one.
 */
function nightText(hex: string, surface: string): string {
  const flipped =
    contrastRatio(hex, surface) >= 3
      ? hex
      : withLightness(hex, 1 - hexToOklab(hex).l)

  return ensureContrast(flipped, surface)
}

/**
 * The night reading of a set of day colours.
 *
 * Every role gets a value — the issue's rule that picking one colour must
 * never silently mean picking two is answered by *showing* this reading in the
 * preview and letting it be edited, not by leaving it blank.
 */
export function deriveNightColors(day: MenuColorSet): MenuColorSet {
  const ground = nightSurface(day.ground)
  const board = nightSurface(day.board)

  return {
    ground,
    board,
    onBoard: nightText(day.onBoard, board),
    ink: nightText(day.ink, ground),
    inkSoft: nightText(day.inkSoft, ground),
    accent: nightText(day.accent, ground),
  }
}

/** A palette whose night reading is derived from the day one. */
export function paletteFromDay(day: MenuColorSet): MenuPalette {
  return { day, night: deriveNightColors(day) }
}

/**
 * Whether a palette's night reading is still the derived one.
 *
 * The picker has no « nuit personnalisée » flag, and deliberately: the state is
 * readable from the values themselves, so nothing can be stored out of step
 * with them — not across a save, not across a reload, not against a row edited
 * elsewhere. While this is true, retouching a day colour recomputes the whole
 * night reading; the moment a manager edits one night value it stops being
 * true, and their evening is left alone.
 */
export function nightIsDerived(palette: MenuPalette): boolean {
  const derived = deriveNightColors(palette.day)
  return MENU_COLOR_ROLES.every(
    (role) => derived[role.id] === palette.night[role.id],
  )
}

/* ---------------------------------------------------------------- contrast */

export type ContrastCheck = {
  role: MenuColorRole
  label: string
  /** The role the text is read on. */
  surface: MenuColorRole
  ratio: number
  passes: boolean
}

/**
 * Every text role measured against the surface it actually sits on.
 *
 * Four checks per reading, in the order the roles are offered. The surface
 * roles measure nothing: a ground is not read, it is read *on*.
 */
export function paletteContrast(colors: MenuColorSet): Array<ContrastCheck> {
  const checks: Array<ContrastCheck> = []

  for (const role of MENU_COLOR_ROLES) {
    if (role.surface === null) continue

    const surface = role.surface as MenuColorRole
    const ratio = contrastRatio(colors[role.id], colors[surface])

    checks.push({
      role: role.id,
      label: role.label,
      surface,
      ratio,
      passes: ratio >= MENU_CONTRAST_MIN,
    })
  }

  return checks
}

/** The failing checks of both readings, day first. Empty means it is safe. */
export function paletteFailures(palette: MenuPalette): Array<ContrastCheck> {
  return [
    ...paletteContrast(palette.day),
    ...paletteContrast(palette.night),
  ].filter((check) => !check.passes)
}

/** A ratio as the picker prints it: « 8,2:1 ». */
export function formatContrast(ratio: number): string {
  return `${ratio.toFixed(1).replace('.', ',')}:1`
}

/* ------------------------------------------------------------------- render */

/**
 * The custom properties a custom palette inlines on its `[data-menu-custom]`
 * element — the whole contract with `styles/menu-theme.css`.
 *
 * **A `style` attribute, and not a per-request `<style>` tag.** `styles.css`
 * argues at length for shipping one stylesheet, and the carte is server
 * rendered: the colours have to be in the first byte of HTML or the customer
 * sees the named theme repaint itself. An attribute is the only place a
 * per-venue value can live without a second sheet.
 *
 * The names are `--theme-*-day` / `--theme-*-night`, which is not a new
 * convention but the one the named themes already use: `menu-theme.css` picks
 * a reading with three generic rules, and a custom palette simply overrides the
 * values those rules read. That is also why the accent needs no rule of its
 * own — `--theme-bottle-*` and `--theme-bottle-deep-*` are already wired, and
 * `--ring` already follows `--bottle-deep`.
 *
 * Three tokens are **derived here rather than asked of the manager**, because
 * each has a correctness condition a colour picker cannot express:
 *
 * - `--bottle-chalk`, the accent as it appears **on the board**, repaired up to
 *   4.5:1 against it. A wine red that reads on a stone sheet disappears on its
 *   own dark board; asking for a second accent for one kicker would be a field
 *   nobody fills in knowingly.
 * - `--on-bottle`, the text on an accent fill: whichever of the venue's own
 *   ground or ink holds up better on it, then repaired. Keeping it inside the
 *   palette's own two neutrals is what stops a pure white appearing in a carte
 *   that has none.
 * - `--on-board-soft`, `--surface-raised`, `--line` and `--line-soft` are
 *   `color-mix()`es in the stylesheet — hairlines and tinted surfaces, which
 *   carry no text and so need no repair.
 */
export function menuPaletteStyle(palette: MenuPalette): CSSProperties {
  const reading = (colors: MenuColorSet, suffix: 'day' | 'night') => {
    const fill = colors.accent
    const onFill =
      contrastRatio(colors.ground, fill) >= contrastRatio(colors.ink, fill)
        ? colors.ground
        : colors.ink

    return {
      [`--theme-ground-${suffix}`]: colors.ground,
      [`--theme-board-${suffix}`]: colors.board,
      [`--theme-on-board-${suffix}`]: colors.onBoard,
      [`--theme-ink-${suffix}`]: colors.ink,
      [`--theme-ink-soft-${suffix}`]: colors.inkSoft,
      /*
        The fill and the text accent are the same colour per reading, where the
        house keeps two greens: `--bottle` is dark by day *and* by night there
        because the house night accent is a pale chalk green that would make an
        illegible fill. Here the night accent is derived against the night
        ground, so it is already the readable one — and a fill drawn in it with
        `--on-bottle` computed on top stays legible either way.
      */
      [`--theme-bottle-${suffix}`]: fill,
      [`--theme-bottle-deep-${suffix}`]: colors.accent,
      [`--theme-bottle-chalk-${suffix}`]: ensureContrast(
        colors.accent,
        colors.board,
      ),
      [`--theme-on-bottle-${suffix}`]: ensureContrast(onFill, fill),
    }
  }

  return {
    ...reading(palette.day, 'day'),
    ...reading(palette.night, 'night'),
  }
}

/**
 * Reads the six roles off an element already wearing a named theme.
 *
 * This is how a custom palette starts as an **edited copy**: the manager turns
 * custom colours on, and the form is filled with what their carte is showing
 * at that second, in both readings — so the first thing they see is their own
 * carte, not a blank form or someone's idea of a default.
 *
 * It reads the DOM rather than a table of hexes in this file, and that is the
 * point: `styles/menu-theme.css` stays the one place a named palette is
 * written. A copy here would be a fourth list to keep in step with the three
 * `menu-theme.ts` already names, and it would drift **silently** — the carte
 * would keep its colours while the picker seeded last year's.
 *
 * The caller provides the probe: an element carrying `data-menu-theme` inside a
 * `.light` or `.dark` wrapper (see `menu-colors-field.tsx`). Returns `null` if
 * any token comes back empty or in a form this module cannot read, which is
 * what a browser mid-stylesheet-load does.
 */
export function readMenuColors(element: Element): MenuColorSet | null {
  const styles = getComputedStyle(element)

  const token = (name: string) => parseHexColor(styles.getPropertyValue(name))

  const ground = token('--surface')
  const board = token('--board')
  const onBoard = token('--on-board')
  const ink = token('--ink')
  const inkSoft = token('--ink-soft')
  const accent = token('--bottle-deep')

  if (!ground || !board || !onBoard || !ink || !inkSoft || !accent) return null

  return { ground, board, onBoard, ink, inkSoft, accent }
}
