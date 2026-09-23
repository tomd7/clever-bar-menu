import { useId } from 'react'

import { tableName } from '#/lib/order-settings'

import type { PublicTable } from '#/features/orders/public-api'

/**
 * The customer picks their table.
 *
 * Shown in the cart sheet of a table-mode venue whenever the table is not
 * known: the venue-wide code was scanned, the code's table has been deleted,
 * or the customer asked to change a table they picked here. A table named by
 * the scanned code never leads back to it. **An unknown id is not an error
 * page** — a code stuck on a table must never become a dead end.
 *
 * One chip per table, the number in large type: it is what is written on the
 * table the customer is sitting at. Tables sharing an area are grouped under
 * it (« Terrasse »), in number order, so a terrace of twelve does not read as
 * a wall of digits.
 *
 * **Native radios in their labels**, like the settings' choices: arrow keys
 * move through the tables and each move chooses — which is why the sheet keeps
 * the picker open after a choice instead of collapsing it under the finger.
 * The accessible name is the full table name, so a screen reader announces
 * « Terrasse · 12 », not « 12 ».
 */
export function TablePicker({
  tables,
  value,
  onChoose,
}: {
  tables: ReadonlyArray<PublicTable>
  /** The public id of the chosen table, if one is. */
  value: string | null
  onChoose: (publicId: string) => void
}) {
  const name = useId()

  /* Unlabelled tables first, then each area in order of its first table. */
  const groups = new Map<string, Array<PublicTable>>()
  for (const table of [...tables].sort((a, b) => a.number - b.number)) {
    const key = table.label ?? ''
    const group = groups.get(key)
    if (group) group.push(table)
    else groups.set(key, [table])
  }
  const unlabelled = groups.get('')
  const ordered = [
    ...(unlabelled ? ([['', unlabelled]] as const) : []),
    ...[...groups].filter(([label]) => label !== ''),
  ]
  const showHeadings = ordered.length > 1 || !unlabelled

  return (
    <fieldset className="min-w-0">
      <legend className="text-sm font-medium">Votre table</legend>
      <p className="mt-1 text-xs text-ink-soft">
        Touchez le numéro inscrit sur votre table.
      </p>

      {ordered.map(([label, group]) => (
        <div key={label} className="mt-3">
          {showHeadings ? (
            <p className="text-xs font-semibold text-ink-soft">
              {label || 'Tables'}
            </p>
          ) : null}

          <div className="mt-1.5 grid grid-cols-4 gap-2 sm:grid-cols-6">
            {group.map((table) => (
              <label
                key={table.public_id}
                className="relative flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-line bg-surface-raised text-base font-semibold tabular-nums transition-transform duration-150 ease-(--ease-out) select-none has-[:checked]:border-bottle has-[:checked]:bg-bottle has-[:checked]:text-on-bottle has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring active:scale-[0.97]"
              >
                <input
                  type="radio"
                  name={name}
                  value={table.public_id}
                  checked={value === table.public_id}
                  onChange={() => onChoose(table.public_id)}
                  aria-label={tableName(table.number, table.label)}
                  className="sr-only"
                />
                {table.number}
              </label>
            ))}
          </div>
        </div>
      ))}
    </fieldset>
  )
}
