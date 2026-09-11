import { RotateCcw } from 'lucide-react'

import { ActionButton } from '#/components/buttons/action-button'
import {
  DEFAULT_MENU_FONT,
  HOUSE_MENU_FONTS,
  MENU_FONTS,
  MENU_FONT_ROLES,
  menuFace,
  menuFontsFor,
} from '#/lib/menu-fonts'
import { cn } from '#/lib/utils.ts'

import type { MenuFonts } from '#/lib/menu-fonts'

/**
 * The choice of the carte's typefaces, one row per role.
 *
 * **Native radios in a scrolling rail, not a `Select`**, for the reason the
 * theme picker gives: the point is to *see* the face, and each chip is set in
 * the face it names. A dropdown would reduce nine typefaces to nine lines of
 * the same Archivo. The rail is the one the product form's size suggestions
 * and the customer menu's summary use (`scrollbar-none`, `rail-fade`).
 *
 * Each radio is wrapped in its own `<label>`, so no `id`/`htmlFor` is written —
 * same reasoning as `MenuThemeField`. Each role is its own `<fieldset>`, which
 * both groups the radios for the arrow keys and names the group for a screen
 * reader.
 *
 * Rendering every chip in its face means this screen downloads the nine latin
 * files — about 400 KB, once, cached. It is the back office, opened by a
 * manager, never the customer's carte.
 */
export function MenuFontField({
  value,
  onChange,
  className,
}: {
  value: MenuFonts
  onChange: (fonts: MenuFonts) => void
  className?: string
}) {
  const isHouse = MENU_FONT_ROLES.every(
    (role) => value[role.id] === DEFAULT_MENU_FONT,
  )

  return (
    /* `min-w-0`: a fieldset's minimum width is its content's, and a rail of
       nine chips would otherwise widen the whole column. */
    <fieldset className={cn('min-w-0', className)}>
      <legend className="text-sm font-semibold">Polices de la carte</legend>

      <p className="mt-1 text-xs text-ink-soft">
        Choisies usage par usage. Les polices de titre ne sont pas proposées
        pour les descriptions : elles se lisent mal en petit.
      </p>

      <div className="mt-4 space-y-4">
        {MENU_FONT_ROLES.map((role) => {
          const selected =
            MENU_FONTS.find((font) => font.id === value[role.id]) ??
            MENU_FONTS[0]

          return (
            <fieldset key={role.id} className="min-w-0">
              {/*
                The hint of the selected face only, on the role's own line: nine
                hints would not fit in chips a thumb can scroll, and a hint shown
                on hover would not exist on the phone. On a line of its own under
                the rail it cost four rows of the same sentence while every role
                was still on Archivo; here it wraps on the phone and takes no row
                of its own from `sm`. It also becomes part of the group's name,
                so a screen reader hears what the current face is like.
              */}
              <legend className="text-xs">
                <span className="font-medium">{role.label}</span>
                <span className="text-ink-soft"> · {selected.hint}</span>
              </legend>

              {/*
                `py-1` leaves room for the focus ring: a horizontally scrolling
                box clips vertically too, and would cut the ring in half.
              */}
              <ul className="scrollbar-none rail-fade mt-1 flex gap-2 overflow-x-auto py-1">
                {menuFontsFor(role.id).map((font) => (
                  <li key={font.id} className="shrink-0">
                    {/*
                      `relative` keeps the visually hidden radio inside its chip.
                      `sr-only` is `position: absolute`, and with no positioned
                      ancestor in the rail the input sat outside the rail's
                      scroll box: focusing a chip scrolled off to the right — the
                      last four of nine — scrolled the whole page sideways and
                      pushed the back office's column off screen. Contained, the
                      focus scrolls the rail instead.
                    */}
                    <label className="relative flex min-h-11 cursor-pointer items-center rounded-full border border-line bg-surface px-3.5 whitespace-nowrap transition-[border-color,background-color,transform] duration-150 ease-out select-none has-[:checked]:border-bottle has-[:checked]:bg-surface-raised has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring active:scale-[0.97] lg:min-h-9">
                      <input
                        type="radio"
                        name={`menu-font-${role.id}`}
                        value={font.id}
                        checked={value[role.id] === font.id}
                        onChange={() =>
                          onChange({ ...value, [role.id]: font.id })
                        }
                        className="sr-only"
                      />
                      <span
                        data-menu-face={menuFace(font.id)}
                        className="text-base leading-none"
                      >
                        {font.label}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
          )
        })}
      </div>

      {/*
        Back to the house face in one gesture, for all four roles at once — a
        manager who wandered through the catalogue should not have to remember
        which rows they touched. Absent while there is nothing to undo.
      */}
      {isHouse ? null : (
        <ActionButton
          variant="ghost"
          icon={RotateCcw}
          onClick={() => onChange(HOUSE_MENU_FONTS)}
          className="mt-3"
        >
          Revenir à Archivo partout
        </ActionButton>
      )}
    </fieldset>
  )
}
