import { Palette } from 'lucide-react'
import { useRef } from 'react'

import { MenuColorsField } from '#/features/venues/components/menu-colors-field'
import { MENU_THEMES } from '#/lib/menu-theme'
import { cn } from '#/lib/utils.ts'
import {
  menuPaletteStyle,
  paletteFromDay,
  readMenuColors,
} from '#/lib/menu-colors'

import type { MenuColorReading } from '#/features/venues/components/menu-colors-field'
import type { MenuPalette } from '#/lib/menu-colors'
import type { MenuTheme } from '#/lib/menu-theme'
import type { ReactNode } from 'react'

/**
 * Le choix du thème de la carte publique.
 *
 * **Des radios natives, et non un `Select`.** Tout l'intérêt de ce contrôle est
 * de *voir* la couleur : un menu déroulant réduirait chaque thème à une ligne de
 * texte, ce qui demande au gérant de choisir un habillage sans le regarder. La
 * radio native apporte en prime le déplacement aux flèches, le groupement par
 * `name` et la sémantique de formulaire, sans une ligne de JavaScript.
 *
 * Elle est aussi la raison pour laquelle ce fichier ne viole pas la règle du
 * projet sur les libellés : `TextField` existe parce qu'un `htmlFor`/`id` écrit
 * à la main casse en silence, or un `<input>` **enveloppé dans son `<label>`**
 * n'a besoin ni de l'un ni de l'autre. Rien à câbler, donc rien à casser. Le
 * jour où un second groupe de radios apparaîtra, ce sera le moment d'en extraire
 * un `RadioField` — pas avant.
 *
 * La pastille ne connaît aucune couleur : elle porte `data-menu-theme` et lit
 * `--board`, `--bottle` et `--bottle-chalk` comme le fait la carte elle-même
 * (`menu-theme-field.css`). Retoucher une palette dans `styles/menu-theme.css`
 * déplace donc les pastilles avec elle, et aucun hexadécimal ne traîne ici.
 *
 * **« Personnalisé » est une option de plus, pas un panneau à part.** La
 * choisir copie le thème nommé en cours dans une palette éditable et déplie
 * l'éditeur de couleurs (`MenuColorsField`) sous la grille ; cliquer un thème
 * nommé la replie et efface le brouillon. Les deux répondent à la même
 * question — « de quelles couleurs est ma carte ? » — et un seul groupe de
 * radios le dit sans qu'on ait à l'expliquer.
 */
export function MenuThemeField({
  theme,
  colors,
  onThemeChange,
  onColorsChange,
  reading,
  onReadingChange,
  className,
}: {
  /** The named theme — the carte's look, or the base of a custom palette. */
  theme: MenuTheme
  /** The custom palette, or `null` when the named theme is the carte's look. */
  colors: MenuPalette | null
  onThemeChange: (theme: MenuTheme) => void
  onColorsChange: (colors: MenuPalette | null) => void
  /** The reading the colour editor shows — held above, for the preview. */
  reading: MenuColorReading
  onReadingChange: (reading: MenuColorReading) => void
  className?: string
}) {
  /*
    The probe: an element wearing the venue's theme, inside a `.light` wrapper
    so it carries the day reading of the house palette whatever temperature the
    back office itself is in.

    It is how « Personnalisé » starts from what the carte is showing at that
    second, and it reads the DOM rather than a table of hexes in TypeScript —
    `styles/menu-theme.css` stays the one place a named palette is written. See
    `readMenuColors` for why a fourth copy of those values would be the kind of
    duplication that drifts in silence.
  */
  const probe = useRef<HTMLDivElement>(null)

  /*
    The custom draft a named theme click just folded away, with the theme it
    was based on. Clicking a swatch to compare is cheap; it must not cost the
    manager the six colours they spent five minutes on. « Personnalisé »
    brings back the pair as it was — the named theme is invisible while custom
    colours are on, so restoring its base changes nothing the manager sees.
  */
  const folded = useRef<{ theme: MenuTheme; colors: MenuPalette } | null>(null)

  const themeLabel =
    MENU_THEMES.find((entry) => entry.id === theme)?.label ?? 'Ardoise'

  function pickTheme(next: MenuTheme) {
    if (colors) folded.current = { theme, colors }
    onColorsChange(null)
    onThemeChange(next)
  }

  function pickCustom() {
    if (folded.current) {
      onThemeChange(folded.current.theme)
      onColorsChange(folded.current.colors)
      return
    }

    const day = probe.current && readMenuColors(probe.current)
    if (day) onColorsChange(paletteFromDay(day))
  }

  return (
    <fieldset className={cn('min-w-0', className)}>
      <legend className="text-sm font-semibold">Thème de la carte</legend>

      <p className="mt-1 text-xs text-ink-soft">
        Il habille le bandeau et les accents de votre carte publique. Pour
        choisir chaque couleur vous-même, prenez « Personnalisé ».
      </p>

      {/*
        The probe, drawn and unread by anyone: `.light` carries the whole day
        palette (see `styles/theme.css`), and the inner element wears the theme
        exactly as the carte does. Off screen rather than `display: none` —
        `getComputedStyle` resolves custom properties either way, but an
        element with no box is one refactor away from being dropped as dead.
      */}
      <div
        className="light pointer-events-none fixed -left-[9999px] size-px"
        aria-hidden
      >
        <div ref={probe} data-menu-theme={theme} />
      </div>

      {/*
        Two columns from the phone up — a colour swatch stretched across the
        whole width loses its point —, three once the form is full width at
        `sm`. Back to two at `lg`, where the preview takes the right column and
        leaves the form about 300px at 1024; three again from `xl`. Six options
        fill both grids evenly.
      */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
        {MENU_THEMES.map((entry) => (
          <ThemeOption
            key={entry.id}
            value={entry.id}
            checked={!colors && theme === entry.id}
            onSelect={() => pickTheme(entry.id)}
            label={entry.label}
            hint={entry.hint}
            swatch={
              <span
                data-menu-theme={entry.id}
                className="theme-swatch shrink-0"
                aria-hidden
              />
            }
          />
        ))}

        <ThemeOption
          value="custom"
          checked={colors !== null}
          onSelect={pickCustom}
          label="Personnalisé"
          hint="Vos couleurs, une à une."
          swatch={
            colors ? (
              /*
                The same miniature as the named swatches, painted by the draft
                the way the carte is: the two attributes and the inline style
                of `PublicMenu`, so the swatch retints as a colour is dragged.
              */
              <span
                data-menu-theme={theme}
                data-menu-custom=""
                style={menuPaletteStyle(colors)}
                className="theme-swatch shrink-0"
                aria-hidden
              />
            ) : (
              <span
                className="grid size-9 shrink-0 place-items-center rounded-lg border border-dashed border-line text-ink-soft"
                aria-hidden
              >
                <Palette className="size-4" />
              </span>
            )
          }
        />
      </div>

      {colors ? (
        /*
          The rule sits on a wrapper, not on the editor's own fieldset: a
          `<legend>` is drawn *into* its fieldset's top border, which ran the
          line straight through « Vos couleurs ».
        */
        <div className="custom-colors mt-5 border-t border-line pt-4">
          <MenuColorsField
            themeLabel={themeLabel}
            value={colors}
            onChange={onColorsChange}
            reading={reading}
            onReadingChange={onReadingChange}
          />
        </div>
      ) : null}
    </fieldset>
  )
}

/**
 * Une option du groupe : une radio native enveloppée dans son `<label>`, sa
 * pastille, son nom et une ligne d'indice.
 */
function ThemeOption({
  value,
  checked,
  onSelect,
  label,
  hint,
  swatch,
}: {
  value: string
  checked: boolean
  onSelect: () => void
  label: string
  hint: string
  swatch: ReactNode
}) {
  return (
    <label className="theme-option flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg border border-line p-2 transition-[border-color,background-color,transform] duration-150 ease-out select-none has-[:checked]:border-bottle has-[:checked]:bg-surface-raised has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring active:scale-[0.97]">
      <input
        type="radio"
        name="menu-theme"
        value={value}
        checked={checked}
        onChange={onSelect}
        className="sr-only"
      />

      {swatch}

      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{label}</span>
        {/*
          Two lines, not one: on the narrow desktop column a single line cut
          every hint mid-word (« Le thème maiso… »), which is worse than no
          hint. The clamp keeps a long one from growing the row — and it must
          stay alone: `line-clamp-*` sets its own `display`, so a `block` next
          to it silently cancels the clamp.
        */}
        <span className="line-clamp-2 text-xs text-ink-soft">{hint}</span>
      </span>
    </label>
  )
}
