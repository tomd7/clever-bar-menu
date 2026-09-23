import { useId } from 'react'

import { cn } from '#/lib/utils.ts'

/** One choice of a `ChoiceField`: the value written, what it is called, and a hint. */
export type ChoiceOption<TValue extends string> = {
  value: TValue
  label: string
  hint?: string
}

/**
 * A short group of exclusive choices, drawn as cards.
 *
 * Extracted the day a second radio group appeared, as `menu-theme-field.tsx`
 * said it would be — three of them, in the settings screen's « Commandes »
 * panel. The theme picker keeps its own markup: its cards carry a swatch this
 * one has no use for.
 *
 * **Native radios wrapped in their `<label>`**, for the reason the theme picker
 * gives: arrow keys, grouping by `name` and form semantics for free, and no
 * `htmlFor`/`id` to hand-write — so nothing that can break in silence. The
 * group's `name` comes from `useId`, so two fields on one page never share one.
 *
 * The card is `relative`: its `sr-only` radio is `position: absolute`, and
 * without a positioned ancestor it could land outside a scrolling container and
 * scroll the page when focused (see the font picker's note in
 * `features/venues/CLAUDE.md`).
 */
export function ChoiceField<TValue extends string>({
  legend,
  hint,
  options,
  value,
  onChange,
  className,
}: {
  legend: string
  hint?: string
  options: ReadonlyArray<ChoiceOption<TValue>>
  value: TValue
  onChange: (value: TValue) => void
  className?: string
}) {
  const name = useId()

  return (
    <fieldset className={cn('min-w-0', className)}>
      <legend className="text-sm font-medium">{legend}</legend>
      {hint ? <p className="mt-1 text-xs text-ink-soft">{hint}</p> : null}

      {/* One column on the phone, where a hint needs the width; two from `sm`. */}
      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {options.map((option) => (
          <label
            key={option.value}
            className="group relative flex min-h-11 cursor-pointer items-start gap-2.5 rounded-lg border border-line px-3 py-2.5 transition-[border-color,background-color,transform] duration-150 ease-out select-none has-[:checked]:border-bottle has-[:checked]:bg-surface-raised has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring active:scale-[0.97]"
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />

            {/*
              The dot says which card is chosen without relying on the border's
              colour alone. It fades, it does not grow: a state indication, seen
              once per visit.
            */}
            <span
              aria-hidden
              className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border border-line bg-surface group-has-[:checked]:border-bottle"
            >
              <span className="size-2 rounded-full bg-bottle opacity-0 transition-opacity duration-150 ease-out group-has-[:checked]:opacity-100" />
            </span>

            <span className="min-w-0">
              <span className="block text-sm font-medium">{option.label}</span>
              {option.hint ? (
                <span className="mt-0.5 block text-xs text-ink-soft">
                  {option.hint}
                </span>
              ) : null}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
