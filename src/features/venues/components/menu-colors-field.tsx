import { Palette, RotateCcw, TriangleAlert } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { ActionButton } from '#/components/buttons/action-button'
import { cn } from '#/lib/utils.ts'
import {
  MENU_COLOR_ROLES,
  MENU_CONTRAST_MIN,
  deriveNightColors,
  formatContrast,
  nightIsDerived,
  paletteContrast,
  paletteFromDay,
  parseHexColor,
  readMenuColors,
} from '#/lib/menu-colors'

import type {
  MenuColorRole,
  MenuColorSet,
  MenuPalette,
} from '#/lib/menu-colors'
import type { MenuTheme } from '#/lib/menu-theme'

/**
 * Les couleurs de la carte, rôle par rôle.
 *
 * Il prolonge le sélecteur de thème au lieu de le remplacer : une palette
 * personnalisée est une **copie retouchée** d'un thème nommé, ce qui lui donne
 * une lecture de jour *et* de nuit complète dès la première seconde, et fait du
 * retour en arrière un seul geste — supprimer la ligne, le thème est toujours
 * là.
 *
 * **Le soir est calculé, puis modifiable.** Le mode sombre suit le téléphone,
 * sans interrupteur : choisir une couleur de jour, c'est en choisir une de nuit
 * sans le savoir, et c'est exactement ce que `CLOCLO-25` reprochait au
 * sélecteur de couleurs. La dérivation répond en montrant la seconde lecture
 * dans l'aperçu plutôt qu'en la laissant vide, et `nightIsDerived` porte
 * l'état : tant qu'il est vrai, retoucher le jour recalcule le soir ; dès que
 * le gérant touche une valeur du soir, on le laisse tranquille.
 *
 * **Le contraste est mesuré ici et refusé plus loin.** Chaque rôle de texte
 * affiche son rapport WCAG sur le fond où il se lit, dans les deux lectures ;
 * sous 4,5:1 la ligne passe en rouge et `VenueSettings` bloque l'enregistrement
 * — c'est la contrepartie de la règle levée dans `styles/menu-theme.css`, où le
 * fond d'une carte peut désormais bouger.
 */
export function MenuColorsField({
  theme,
  themeLabel,
  value,
  onChange,
  className,
}: {
  /** The named theme a custom palette starts as a copy of. */
  theme: MenuTheme
  /** Its French name, for « Revenir au thème Ardoise ». */
  themeLabel: string
  value: MenuPalette | null
  onChange: (palette: MenuPalette | null) => void
  className?: string
}) {
  /*
    The probe: an element wearing the venue's theme, inside a `.light` wrapper
    so it carries the day reading of the house palette whatever temperature the
    back office itself is in.

    It is how « personnaliser » starts from what the carte is showing at that
    second, and it reads the DOM rather than a table of hexes in TypeScript —
    `styles/menu-theme.css` stays the one place a named palette is written. See
    `readMenuColors` for why a fourth copy of those values would be the kind of
    duplication that drifts in silence.
  */
  const probe = useRef<HTMLDivElement>(null)

  /* The evening's fields, once asked for. Closed is the ordinary case. */
  const [showNight, setShowNight] = useState(false)

  const derived = value ? nightIsDerived(value) : true

  function customise() {
    const day = probe.current && readMenuColors(probe.current)
    if (!day) return

    onChange(paletteFromDay(day))
  }

  function changeDay(role: MenuColorRole, color: string) {
    if (!value) return

    const day = { ...value.day, [role]: color }
    /*
      While the evening is still the calculated one, it follows; once the
      manager has set a value there, it stays theirs. Nothing to remember —
      `nightIsDerived` reads it off the palette.
    */
    onChange(derived ? paletteFromDay(day) : { day, night: value.night })
  }

  function changeNight(role: MenuColorRole, color: string) {
    if (!value) return
    onChange({ day: value.day, night: { ...value.night, [role]: color } })
  }

  return (
    <fieldset className={cn('min-w-0', className)}>
      <legend className="text-sm font-semibold">Couleurs</legend>

      <p className="mt-1 text-xs text-ink-soft">
        {value
          ? `Une copie du thème ${themeLabel}, retouchée. Les couleurs du soir sont calculées à partir de celles du jour.`
          : 'Votre carte porte les couleurs du thème choisi ci-dessus. Vous pouvez les reprendre une à une.'}
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

      {value ? (
        <>
          <ColorRows
            colors={value.day}
            onChange={changeDay}
            className="mt-4"
            legend="Le jour"
          />

          {/*
            The evening, behind a disclosure. Six more fields open by default
            would double a form that is already long, to show values most
            managers will accept as calculated — and the preview shows the
            result right beside it either way.
          */}
          <div className="mt-4 border-t border-line pt-3">
            <button
              type="button"
              onClick={() => setShowNight((open) => !open)}
              className="flex min-h-11 w-full items-center justify-between gap-3 text-left text-sm font-medium transition-colors hover:text-bottle-deep"
              aria-expanded={showNight}
            >
              <span className="min-w-0">
                Couleurs du soir
                <span className="mt-0.5 block text-xs font-normal text-ink-soft">
                  {derived
                    ? 'Calculées d’après le jour, et vérifiées pour la lisibilité.'
                    : 'Réglées à la main.'}
                </span>
              </span>
              <span className="shrink-0 text-xs text-ink-soft">
                {showNight ? 'Masquer' : 'Afficher'}
              </span>
            </button>

            {showNight ? (
              <>
                <ColorRows
                  colors={value.night}
                  onChange={changeNight}
                  className="mt-2"
                />

                {/*
                  Only while there is something to undo. A « recalculer » that
                  stands there permanently is a button that does nothing nine
                  times out of ten.
                */}
                {derived ? null : (
                  <ActionButton
                    icon={RotateCcw}
                    variant="ghost"
                    onClick={() =>
                      onChange({
                        day: value.day,
                        night: deriveNightColors(value.day),
                      })
                    }
                    className="mt-2 px-2 text-xs"
                  >
                    Recalculer d’après le jour
                  </ActionButton>
                )}
              </>
            ) : null}
          </div>

          {/*
            Going back is a plain button and not a `DeleteButton`: nothing is
            deleted here. It clears a draft, and the row itself only goes when
            « Enregistrer » is pressed — which is the confirmation the rule
            about first-click deletion asks for.
          */}
          <ActionButton
            icon={RotateCcw}
            variant="outline"
            onClick={() => onChange(null)}
            className="mt-4 w-full sm:w-auto"
          >
            Revenir au thème {themeLabel}
          </ActionButton>
        </>
      ) : (
        <ActionButton
          icon={Palette}
          variant="outline"
          onClick={customise}
          className="mt-4 w-full sm:w-auto"
        >
          Personnaliser les couleurs
        </ActionButton>
      )}
    </fieldset>
  )
}

/**
 * Les six rôles d'une lecture, et ce que chacun donne à lire.
 *
 * Le rapport de contraste remplace l'explication du rôle dès qu'il y en a un à
 * donner : « 8,2:1 sur le fond » dit à la fois où la couleur se pose et si elle
 * s'y lit, là où la description du rôle ne sert qu'au premier passage.
 */
function ColorRows({
  colors,
  onChange,
  legend,
  className,
}: {
  colors: MenuColorSet
  onChange: (role: MenuColorRole, color: string) => void
  legend?: string
  className?: string
}) {
  const checks = paletteContrast(colors)

  return (
    <div className={className}>
      {legend ? (
        <p className="text-xs font-medium text-ink-soft">{legend}</p>
      ) : null}

      <div className={cn('grid gap-1', legend && 'mt-2')}>
        {MENU_COLOR_ROLES.map((role) => {
          const check = checks.find((entry) => entry.role === role.id)
          const surface = check
            ? MENU_COLOR_ROLES.find((entry) => entry.id === check.surface)
            : undefined

          return (
            <div key={role.id} className="flex items-center gap-3">
              {/*
                One `<label>` around the swatch and the role's name: the native
                colour input is the control it names, so there is no `htmlFor`
                to hand-write and nothing to mistype — the same sidestep the
                theme picker's radios make. The hex field beside it is a second
                control and takes an `aria-label` of its own.
              */}
              <label className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-3 select-none">
                <input
                  type="color"
                  value={colors[role.id]}
                  onChange={(event) => onChange(role.id, event.target.value)}
                  className="color-swatch shrink-0"
                />

                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    {role.label}
                  </span>

                  {check && surface ? (
                    /*
                      The icon and the sentence are two flex items; the
                      sentence is **one** of them, wrapped in its own span. Left
                      as bare text nodes they become anonymous flex items each,
                      which do not wrap into one another — at phone width the
                      line simply ran past the panel instead of folding.
                    */
                    <span
                      className={cn(
                        'flex items-start gap-1 text-xs',
                        check.passes
                          ? 'text-ink-soft'
                          : 'font-medium text-destructive',
                      )}
                    >
                      {check.passes ? null : (
                        <TriangleAlert
                          className="mt-0.5 size-3 shrink-0"
                          aria-hidden
                        />
                      )}
                      <span className="min-w-0">
                        {formatContrast(check.ratio)} sur «{' '}
                        {surface.label.toLowerCase()} »
                        {check.passes
                          ? null
                          : ` — illisible, ${formatContrast(MENU_CONTRAST_MIN)} minimum`}
                      </span>
                    </span>
                  ) : (
                    <span className="line-clamp-1 text-xs text-ink-soft">
                      {role.hint}
                    </span>
                  )}
                </span>
              </label>

              <HexInput
                label={role.label}
                value={colors[role.id]}
                onChange={(color) => onChange(role.id, color)}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Le champ hexadécimal, à côté de la pastille.
 *
 * Il existe parce qu'un gérant arrive souvent avec un code — celui de son
 * enseigne, de son logo, de sa charte — et que le sélecteur du système ne sait
 * pas le recevoir sans qu'on le lui tape dans un onglet de plus.
 *
 * Il garde sa propre saisie tant qu'elle n'est pas valide : sans cela, taper
 * « #1 » commettrait une couleur à chaque frappe, et la pastille clignoterait
 * le temps d'écrire six caractères. Une saisie abandonnée revient à la valeur
 * en vigueur à la sortie du champ.
 */
function HexInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (color: string) => void
}) {
  const [draft, setDraft] = useState(value)

  /* The picker, the derivation and « revenir au thème » all move the value
     under this field; the draft follows unless it is being typed into. */
  const editing = useRef(false)

  useEffect(() => {
    if (!editing.current) setDraft(value)
  }, [value])

  return (
    <input
      type="text"
      inputMode="text"
      autoComplete="off"
      spellCheck={false}
      aria-label={`${label}, code hexadécimal`}
      value={draft}
      maxLength={7}
      onFocus={() => {
        editing.current = true
      }}
      onChange={(event) => {
        setDraft(event.target.value)
        const parsed = parseHexColor(event.target.value)
        if (parsed) onChange(parsed)
      }}
      onBlur={() => {
        editing.current = false
        setDraft(value)
      }}
      className="h-11 w-24 shrink-0 rounded-lg border border-line bg-surface px-2 text-center font-mono text-xs tabular-nums focus-visible:border-bottle focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    />
  )
}
