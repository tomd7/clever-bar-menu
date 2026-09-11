import { MENU_THEMES } from '#/lib/menu-theme'
import { cn } from '#/lib/utils.ts'

import type { MenuTheme } from '#/lib/menu-theme'

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
 */
export function MenuThemeField({
  value,
  onChange,
  className,
}: {
  value: MenuTheme
  onChange: (theme: MenuTheme) => void
  className?: string
}) {
  return (
    <fieldset className={cn('min-w-0', className)}>
      <legend className="text-sm font-semibold">Thème de la carte</legend>

      <p className="mt-1 text-xs text-ink-soft">
        Il habille le bandeau et les accents de votre carte publique. Le fond ne
        change pas : une carte se lit.
      </p>

      {/*
        Two columns from the phone up — a colour swatch stretched across the
        whole width loses its point —, three once the form is full width at
        `sm`. Back to two at `lg`, where the preview takes the right column and
        leaves the form about 300px at 1024; three again from `xl`.
      */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
        {MENU_THEMES.map((theme) => (
          <label
            key={theme.id}
            className="theme-option flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg border border-line p-2 transition-[border-color,background-color,transform] duration-150 ease-out select-none has-[:checked]:border-bottle has-[:checked]:bg-surface-raised has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring active:scale-[0.97]"
          >
            <input
              type="radio"
              name="menu-theme"
              value={theme.id}
              checked={value === theme.id}
              onChange={() => onChange(theme.id)}
              className="sr-only"
            />

            <span
              data-menu-theme={theme.id}
              className="theme-swatch shrink-0"
              aria-hidden
            />

            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">
                {theme.label}
              </span>
              {/*
                Two lines, not one: on the narrow desktop column a single line
                cut every hint mid-word (« Le thème maiso… »), which is worse
                than no hint. The clamp keeps a long one from growing the row —
                and it must stay alone: `line-clamp-*` sets its own `display`,
                so a `block` next to it silently cancels the clamp.
              */}
              <span className="line-clamp-2 text-xs text-ink-soft">
                {theme.hint}
              </span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
