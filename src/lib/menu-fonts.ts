import archivoFile from '@fontsource-variable/archivo/files/archivo-latin-wdth-normal.woff2?url'
import bigShouldersDisplayFile from '@fontsource-variable/big-shoulders-display/files/big-shoulders-display-latin-wght-normal.woff2?url'
import caveatFile from '@fontsource-variable/caveat/files/caveat-latin-wght-normal.woff2?url'
import cormorantGaramondFile from '@fontsource-variable/cormorant-garamond/files/cormorant-garamond-latin-wght-normal.woff2?url'
import courierPrimeBoldFile from '@fontsource/courier-prime/files/courier-prime-latin-700-normal.woff2?url'
import fredokaFile from '@fontsource-variable/fredoka/files/fredoka-latin-wght-normal.woff2?url'
import newsreaderFile from '@fontsource-variable/newsreader/files/newsreader-latin-wght-normal.woff2?url'
import oswaldFile from '@fontsource-variable/oswald/files/oswald-latin-wght-normal.woff2?url'
import playfairDisplayFile from '@fontsource-variable/playfair-display/files/playfair-display-latin-wght-normal.woff2?url'

/**
 * The typefaces a customer menu can be set in, role by role.
 *
 * In `lib/` for the reason `menu-theme.ts` is: `features/venues` writes the
 * choice from the settings screen, `features/menu` renders it on the carte, and
 * neither may import the other.
 *
 * The whitelist exists in three places, and they change together:
 *
 *   1. `VENUE_FONTS` and the four `venues_font_*_allowed` checks —
 *      `src/db/schema.ts`, which restate the role lists below
 *   2. this catalogue
 *   3. `src/styles/fonts.css` (the `@font-face`) and `src/styles/menu-fonts.css`
 *      (the rule that applies each face)
 *
 * Miss the third and the carte names a family no stylesheet declares — it
 * silently renders in the fallback, which reads as a design choice.
 */

export type MenuFont =
  | 'archivo'
  | 'playfair-display'
  | 'newsreader'
  | 'fredoka'
  | 'courier-prime'
  | 'oswald'
  | 'caveat'
  | 'cormorant-garamond'
  | 'big-shoulders-display'

/** The house face — every venue starts on it, for every role. */
export const DEFAULT_MENU_FONT: MenuFont = 'archivo'

/**
 * What a face can be used for on the carte.
 *
 * `title` is the venue's name on the board, `category` the section headings,
 * `product` a menu line (name, size, price), `description` every paragraph —
 * the venue's, a category's, a product's. The kicker, the summary rail and the
 * back-to-top link are controls, not content: they stay in the house face.
 */
export type MenuFontRole = 'title' | 'category' | 'product' | 'description'

export type MenuFonts = Record<MenuFontRole, MenuFont>

export const HOUSE_MENU_FONTS: MenuFonts = {
  title: DEFAULT_MENU_FONT,
  category: DEFAULT_MENU_FONT,
  product: DEFAULT_MENU_FONT,
  description: DEFAULT_MENU_FONT,
}

/** The roles, in the order the carte reads them — and the picker offers them. */
export const MENU_FONT_ROLES: ReadonlyArray<{
  id: MenuFontRole
  label: string
}> = [
  { id: 'title', label: 'Nom de l’établissement' },
  { id: 'category', label: 'Catégories' },
  { id: 'product', label: 'Produits et prix' },
  { id: 'description', label: 'Descriptions' },
]

const ALL_ROLES: ReadonlyArray<MenuFontRole> = [
  'title',
  'category',
  'product',
  'description',
]

/*
  A handwritten or condensed face that makes a fine heading stops being
  readable in a 14px paragraph read at a dim table. Those faces are simply not
  offered for the roles they would ruin: a constrained choice, for the reason
  CLOCLO-25 chose named palettes over a colour picker.
*/
const TITLES_AND_PRODUCTS: ReadonlyArray<MenuFontRole> = [
  'title',
  'category',
  'product',
]
const TITLES_ONLY: ReadonlyArray<MenuFontRole> = ['title', 'category']

/**
 * The catalogue, house face first, then the faces open to every role.
 *
 * Labels and hints are French — a manager reads them.
 */
export const MENU_FONTS: ReadonlyArray<{
  id: MenuFont
  label: string
  /** What the face is like, said in words under the picker. */
  hint: string
  roles: ReadonlyArray<MenuFontRole>
  /**
   * The latin file a title set in this face needs — the bold one for a family
   * that is not variable. It is what `menuFontPreloads` hands the route.
   */
  titleFile: string
}> = [
  {
    id: 'archivo',
    label: 'Archivo',
    hint: 'La police maison, large et nette.',
    roles: ALL_ROLES,
    titleFile: archivoFile,
  },
  {
    id: 'playfair-display',
    label: 'Playfair',
    hint: 'Un empattement de bistrot, classique.',
    roles: ALL_ROLES,
    titleFile: playfairDisplayFile,
  },
  {
    id: 'newsreader',
    label: 'Newsreader',
    hint: 'Un caractère de journal, très lisible.',
    roles: ALL_ROLES,
    titleFile: newsreaderFile,
  },
  {
    id: 'fredoka',
    label: 'Fredoka',
    hint: 'Ronde et chaleureuse.',
    roles: ALL_ROLES,
    titleFile: fredokaFile,
  },
  {
    id: 'courier-prime',
    label: 'Courier',
    hint: 'Tapée à la machine.',
    roles: ALL_ROLES,
    titleFile: courierPrimeBoldFile,
  },
  {
    id: 'oswald',
    label: 'Oswald',
    hint: 'Étroite, façon brasserie.',
    roles: TITLES_AND_PRODUCTS,
    titleFile: oswaldFile,
  },
  {
    id: 'caveat',
    label: 'Caveat',
    hint: 'Écrite à la craie, comme sur l’ardoise.',
    roles: TITLES_AND_PRODUCTS,
    titleFile: caveatFile,
  },
  {
    id: 'cormorant-garamond',
    label: 'Cormorant',
    hint: 'Élégante, pour un bar à vin.',
    roles: TITLES_ONLY,
    titleFile: cormorantGaramondFile,
  },
  {
    id: 'big-shoulders-display',
    label: 'Big Shoulders',
    hint: 'Industrielle, pour une brasserie artisanale.',
    roles: TITLES_ONLY,
    titleFile: bigShouldersDisplayFile,
  },
]

/** The faces a role may be set in, in catalogue order. */
export function menuFontsFor(role: MenuFontRole) {
  return MENU_FONTS.filter((font) => font.roles.includes(role))
}

/** Whether a value names a face this role may use. */
export function isMenuFontAllowed(
  value: string,
  role: MenuFontRole,
): value is MenuFont {
  return MENU_FONTS.some(
    (font) => font.id === value && font.roles.includes(role),
  )
}

/**
 * Reads the four faces off a venue row, falling back to the house face.
 *
 * A value this build doesn't know — a row written by a newer deployment, or
 * edited by hand — or a face not allowed for its role degrades to Archivo,
 * exactly as `parseMenuTheme` degrades to « ardoise ».
 */
export function parseMenuFonts(row: {
  font_title: string
  font_category: string
  font_product: string
  font_description: string
}): MenuFonts {
  const parse = (value: string, role: MenuFontRole) =>
    isMenuFontAllowed(value, role) ? value : DEFAULT_MENU_FONT

  return {
    title: parse(row.font_title, 'title'),
    category: parse(row.font_category, 'category'),
    product: parse(row.font_product, 'product'),
    description: parse(row.font_description, 'description'),
  }
}

/**
 * The `data-menu-face` value that sets an element in a face — or nothing for
 * the house face, which every element already inherits.
 *
 * Omitting the attribute rather than writing `archivo` keeps a carte that never
 * changed its fonts byte-for-byte what it was, and keeps `menu-fonts.css` from
 * needing a rule for the house face.
 */
export function menuFace(font: MenuFont): MenuFont | undefined {
  return font === DEFAULT_MENU_FONT ? undefined : font
}

/** A `<link rel="preload">` for the file a face's titles need first. */
export function menuFontPreload(font: MenuFont) {
  const entry = MENU_FONTS.find((candidate) => candidate.id === font)

  return {
    rel: 'preload',
    href: (entry ?? MENU_FONTS[0]).titleFile,
    as: 'font',
    type: 'font/woff2',
    /*
      A font request is always CORS-mode, same origin or not. A preload without
      `crossorigin` doesn't match it, and the browser downloads the file twice.
    */
    crossOrigin: 'anonymous' as const,
  }
}

/**
 * The preloads a carte's head adds: its title face, when that face is not the
 * house one — which the root preloads on every page already.
 *
 * One at most, on purpose. The title is the largest text of the first screen;
 * every other face is fetched once the stylesheet asks for it, and
 * `font-display: swap` with the fallback metrics of `fonts.css` keeps that wait
 * from moving anything.
 */
export function menuFontPreloads(fonts: MenuFonts) {
  return fonts.title === DEFAULT_MENU_FONT ? [] : [menuFontPreload(fonts.title)]
}
