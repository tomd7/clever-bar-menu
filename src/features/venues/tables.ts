/**
 * A venue's tables, as the manager types them.
 *
 * The number is the table's name in the room, the label an optional area
 * (« Terrasse »). Both are parsed here, once, in French — the checks on
 * `venue_tables` restate the same bounds and would otherwise answer in English.
 */

/** The bounds of `venue_tables_number_range`. */
export const TABLE_NUMBER_MAX = 9999

/** The bound of `venue_tables_label_length`. */
export const TABLE_LABEL_MAX = 40

/**
 * Reads a table number typed in a field.
 *
 * Digits only: « 12b » is not a table this schema can hold, and silently
 * keeping the 12 would print a code for a table that does not match the one on
 * the floor.
 */
export function parseTableNumber(value: string): number {
  const trimmed = value.trim()

  if (!/^[0-9]+$/.test(trimmed)) {
    throw new Error('Le numéro de table s’écrit en chiffres, sans lettre.')
  }

  const number = Number(trimmed)
  if (number < 1 || number > TABLE_NUMBER_MAX) {
    throw new Error(`Le numéro de table va de 1 à ${TABLE_NUMBER_MAX}.`)
  }

  return number
}

/** Reads the optional label: blank is `null`, like a blank size or price. */
export function parseTableLabel(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  if (trimmed.length > TABLE_LABEL_MAX) {
    throw new Error(
      `Le nom de la zone tient en ${TABLE_LABEL_MAX} caractères au plus.`,
    )
  }

  return trimmed
}

/**
 * The number the add form proposes: one after the highest, so entering twenty
 * tables is pressing « Ajouter » twenty times.
 */
export function nextTableNumber(
  tables: ReadonlyArray<{ number: number }>,
): number {
  const highest = tables.reduce((max, table) => Math.max(max, table.number), 0)
  return Math.min(highest + 1, TABLE_NUMBER_MAX)
}
