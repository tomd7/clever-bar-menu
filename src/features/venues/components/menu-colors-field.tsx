import { Moon, RotateCcw, Sun, TriangleAlert } from 'lucide-react'
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
} from '#/lib/menu-colors'

import type {
  MenuColorRole,
  MenuColorSet,
  MenuPalette,
} from '#/lib/menu-colors'
import type { LucideIcon } from 'lucide-react'

/** Which of the carte's two readings the editor is showing. */
export type MenuColorReading = 'day' | 'night'

/**
 * Les couleurs de la carte, rôle par rôle.
 *
 * Il n'a pas de bouton d'entrée : c'est l'option « Personnalisé » du sélecteur
 * de thème (`menu-theme-field.tsx`) qui l'ouvre, en semant la palette depuis le
 * thème nommé choisi juste avant. Une palette personnalisée est donc une
 * **copie retouchée** d'un thème nommé, ce qui lui donne une lecture de jour
 * *et* de nuit complète dès la première seconde, et fait du retour en arrière
 * un seul geste — cliquer un thème nommé.
 *
 * **Le soir est calculé, puis modifiable.** Le mode sombre suit le téléphone,
 * sans interrupteur : choisir une couleur de jour, c'est en choisir une de nuit
 * sans le savoir, et c'est exactement ce que `CLOCLO-25` reprochait au
 * sélecteur de couleurs. La dérivation répond en montrant la seconde lecture
 * dans l'aperçu plutôt qu'en la laissant vide, et `nightIsDerived` porte
 * l'état : tant qu'il est vrai, retoucher le jour recalcule le soir ; dès que
 * le gérant touche une valeur du soir, on le laisse tranquille.
 *
 * **Une lecture à la fois, choisie par un sélecteur Jour | Soir.** Les deux
 * lectures ont les mêmes six rôles : les poser l'une sous l'autre, ou cacher
 * le soir derrière un volet, faisait lire douze champs là où il y en a six à
 * comprendre, et laissait le soir à trouver. Le sélecteur dit qu'il y en a
 * deux, lequel on règle, et — par une alerte sur son segment — lequel est
 * illisible. `VenueSettings` tient la lecture active pour entourer la vignette
 * d'aperçu qui lui répond.
 *
 * **Le contraste est mesuré ici et refusé plus loin.** Chaque rôle de texte
 * affiche son rapport WCAG sur le fond où il se lit, dans les deux lectures ;
 * sous 4,5:1 la ligne passe en rouge et `VenueSettings` bloque l'enregistrement
 * — c'est la contrepartie de la règle levée dans `styles/menu-theme.css`, où le
 * fond d'une carte peut désormais bouger.
 */
export function MenuColorsField({
  themeLabel,
  value,
  onChange,
  reading,
  onReadingChange,
  className,
}: {
  /** The French name of the theme the palette was copied from. */
  themeLabel: string
  value: MenuPalette
  onChange: (palette: MenuPalette) => void
  reading: MenuColorReading
  onReadingChange: (reading: MenuColorReading) => void
  className?: string
}) {
  const derived = nightIsDerived(value)

  function changeDay(role: MenuColorRole, color: string) {
    const day = { ...value.day, [role]: color }
    /*
      While the evening is still the calculated one, it follows; once the
      manager has set a value there, it stays theirs. Nothing to remember —
      `nightIsDerived` reads it off the palette.
    */
    onChange(derived ? paletteFromDay(day) : { day, night: value.night })
  }

  function changeNight(role: MenuColorRole, color: string) {
    onChange({ day: value.day, night: { ...value.night, [role]: color } })
  }

  return (
    <fieldset className={cn('min-w-0', className)}>
      <legend className="text-sm font-semibold">Vos couleurs</legend>

      <p className="mt-1 text-xs text-ink-soft">
        Une copie du thème {themeLabel}, retouchée. Votre carte suit le réglage
        du téléphone : elle a des couleurs de jour et des couleurs de soir.
      </p>

      {/*
        A segmented control of two native radios, each wrapped in its label —
        the theme picker's own pattern, so arrows move between the two and
        there is no `htmlFor` to write. Full width on the phone, where the two
        halves are the thumb's targets; sized to its content from `sm`.
      */}
      <div className="mt-4 grid grid-cols-2 gap-1 rounded-xl border border-line bg-surface-raised p-1 sm:inline-grid">
        <ReadingOption
          icon={Sun}
          label="Jour"
          checked={reading === 'day'}
          onSelect={() => onReadingChange('day')}
          failing={paletteContrast(value.day).some((check) => !check.passes)}
        />
        <ReadingOption
          icon={Moon}
          label="Soir"
          checked={reading === 'night'}
          onSelect={() => onReadingChange('night')}
          failing={paletteContrast(value.night).some((check) => !check.passes)}
        />
      </div>

      {/*
        One line under the control says how the two readings are tied, from
        the side being looked at — it is the one thing the fields cannot show.
      */}
      {reading === 'day' ? (
        <p className="mt-2 text-xs text-ink-soft">
          {derived
            ? 'Ce que voient vos clients en journée. Les couleurs du soir en sont calculées, et suivent vos retouches.'
            : 'Ce que voient vos clients en journée. Vos couleurs du soir sont réglées à part.'}
        </p>
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className="min-w-0 flex-1 basis-56 text-xs text-ink-soft">
            {derived
              ? 'Calculées d’après le jour, et vérifiées pour la lisibilité. Retouchez-en une pour les régler vous-même.'
              : 'Réglées à la main : elles ne suivent plus le jour.'}
          </p>

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
              className="px-2 text-xs"
            >
              Recalculer d’après le jour
            </ActionButton>
          )}
        </div>
      )}

      {reading === 'day' ? (
        <ColorRows
          key="day"
          colors={value.day}
          onChange={changeDay}
          className="mt-3"
        />
      ) : (
        <ColorRows
          key="night"
          colors={value.night}
          onChange={changeNight}
          className="mt-3"
        />
      )}
    </fieldset>
  )
}

/**
 * Un segment du sélecteur Jour | Soir.
 *
 * L'alerte sur le segment est ce qui rend le sélecteur sûr : sans elle, un
 * rôle illisible dans la lecture qu'on ne regarde pas grise « Enregistrer »
 * sans rien montrer d'où vient le refus.
 */
function ReadingOption({
  icon: Icon,
  label,
  checked,
  onSelect,
  failing,
}: {
  icon: LucideIcon
  label: string
  checked: boolean
  onSelect: () => void
  failing: boolean
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium text-ink-soft transition-[background-color,color,box-shadow,transform] duration-150 ease-out select-none has-[:checked]:bg-surface has-[:checked]:text-ink has-[:checked]:shadow-[var(--shadow-1)] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring active:scale-[0.97] motion-reduce:transition-none">
      <input
        type="radio"
        name="menu-color-reading"
        checked={checked}
        onChange={onSelect}
        className="sr-only"
      />
      <Icon className="size-4 shrink-0" aria-hidden />
      {label}
      {failing ? (
        <>
          <TriangleAlert
            className="size-3.5 shrink-0 text-destructive"
            aria-hidden
          />
          <span className="sr-only">, couleurs illisibles</span>
        </>
      ) : null}
    </label>
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
  className,
}: {
  colors: MenuColorSet
  onChange: (role: MenuColorRole, color: string) => void
  className?: string
}) {
  const checks = paletteContrast(colors)

  return (
    <div className={className}>
      <div className="grid gap-1">
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
