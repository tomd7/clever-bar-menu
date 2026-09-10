/**
 * The themes a public menu can wear, as the browser knows them.
 *
 * Two features need this list and neither may import the other:
 * `features/venues` writes the theme from the settings screen, `features/menu`
 * renders it on the customer's card. So it descends here, for the same reason
 * that sent `formatPrice` to `lib/money.ts` and `describeError` to
 * `lib/postgrest-error.ts`.
 *
 * It is **recopied** from `VENUE_THEMES` in `src/db/schema.ts` rather than
 * imported from it, and the duplication is deliberate: that file describes the
 * tables to Drizzle and pulls `drizzle-orm/pg-core` with it, which has no
 * business in a browser bundle. `OrderStatusValue` in `src/lib/supabase.ts` is
 * recopied for exactly that reason — this file is where the browser's copy
 * lives, so there is one, not two.
 *
 * The whitelist therefore exists in three places, and they change together:
 *
 *   1. `VENUE_THEMES` and the `venues_theme_allowed` check — `src/db/schema.ts`
 *   2. this catalogue
 *   3. the token blocks of `src/styles/menu-theme.css`
 *
 * Miss the third and the menu renders an attribute no rule matches, which is
 * silent — hence `parseMenuTheme`, which never lets an unknown value through.
 */

/** The house board, the one `src/styles/theme.css` already paints on `:root`. */
export const DEFAULT_MENU_THEME = 'ardoise'

export type MenuTheme = 'ardoise' | 'pelouse' | 'rubis' | 'prune' | 'indigo'

/**
 * The catalogue, in the order the picker offers it.
 *
 * The house theme comes first because it is the one every venue starts on.
 * Labels are French — they are read by a manager, not by this file.
 */
export const MENU_THEMES: ReadonlyArray<{
  id: MenuTheme
  label: string
  /** What the board actually looks like, said in words for the picker. */
  hint: string
}> = [
  { id: 'ardoise', label: 'Ardoise', hint: 'Le thème maison, noir et craie.' },
  { id: 'pelouse', label: 'Pelouse', hint: 'Vert et blanc, comme un maillot.' },
  {
    id: 'rubis',
    label: 'Rubis',
    hint: 'Rouge profond, comme un vin de garde.',
  },
  { id: 'prune', label: 'Prune', hint: 'Violet sombre, un fond de velours.' },
  { id: 'indigo', label: 'Indigo', hint: 'Bleu de nuit, pour les cocktails.' },
]

/**
 * Reads a theme off a row, and falls back to the house board.
 *
 * A value this build does not know — a row written by a newer deployment, or
 * edited by hand — degrades to `'ardoise'` instead of setting an attribute no
 * CSS rule matches. The failure mode of the alternative is an unstyled board
 * that nobody reports, because it looks like a design choice.
 */
export function parseMenuTheme(value: string): MenuTheme {
  return MENU_THEMES.some((theme) => theme.id === value)
    ? (value as MenuTheme)
    : DEFAULT_MENU_THEME
}
