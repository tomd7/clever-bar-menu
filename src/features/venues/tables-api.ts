import { queryOptions } from '@tanstack/react-query'

import { describeError } from '#/lib/postgrest-error'
import { parseTableLabel, parseTableNumber } from '#/features/venues/tables'
import { supabase } from '#/lib/supabase'

import type { VenueTable } from '#/lib/supabase'

/**
 * A venue's tables, on the manager's side: the tables screen, the per-table QR
 * sheet and the count in the settings panel.
 *
 * A file of its own rather than more of `api.ts`, the way `features/orders`
 * splits `public-api.ts` off: tables are their own table with their own
 * policies, and this keeps the venue's own reads and writes readable.
 *
 * The customer reads the same rows through `features/orders/public-api.ts`,
 * with a key of its own — that cache lives on another device, and nothing here
 * could invalidate it anyway.
 */

export const VENUE_TABLES_QUERY_KEY = ['venue-tables'] as const

export function venueTablesQueryOptions(venueId: string) {
  return queryOptions({
    queryKey: [...VENUE_TABLES_QUERY_KEY, venueId],
    queryFn: async (): Promise<Array<VenueTable>> => {
      const { data, error } = await supabase
        .from('venue_tables')
        .select('*')
        .eq('venue_id', venueId)
        .order('number', { ascending: true })

      if (error) throw new Error(describeError(error))
      return data
    },
  })
}

/**
 * Names the two unique constraints `describeError`'s « Cet élément existe
 * déjà. » cannot tell apart. PostgREST puts the constraint's name in the
 * message, which is the only place it says which one fired.
 */
function isDuplicate(
  error: { code?: string; message: string },
  constraint: string,
): boolean {
  return error.code === '23505' && error.message.includes(constraint)
}

function describeTableError(
  error: { code?: string; message: string },
  number: number,
): string {
  return isDuplicate(error, 'venue_tables_venue_id_number_unique')
    ? `La table ${number} existe déjà.`
    : describeError(error)
}

/**
 * Adds a table. Returns the number it was given, so the form can propose the
 * next one.
 *
 * The public id is **not sent**: the column default draws it. A draw that
 * collides with another table's id — about 46 bits, so a rare event across the
 * whole deployment — is retried once, and a second collision surfaces.
 */
export async function createVenueTable(input: {
  venueId: string
  number: string
  label: string
}): Promise<number> {
  const number = parseTableNumber(input.number)
  const label = parseTableLabel(input.label)

  for (let attempt = 1; ; attempt++) {
    const { error } = await supabase
      .from('venue_tables')
      .insert({ venue_id: input.venueId, number, label })

    if (!error) return number

    const retry =
      attempt === 1 && isDuplicate(error, 'venue_tables_public_id_unique')
    if (!retry) throw new Error(describeTableError(error, number))
  }
}

/**
 * Renumbers or relabels a table.
 *
 * **The public id is never written**, and that is what keeps the printed code
 * valid: the code carries the id, not the number.
 *
 * The row is asked back, and its absence is the error — under RLS a refused
 * update matches no row and answers 204, like a success (see `updateVenue`).
 */
export async function updateVenueTable(input: {
  tableId: string
  number: string
  label: string
}): Promise<void> {
  const number = parseTableNumber(input.number)
  const label = parseTableLabel(input.label)

  const { data, error } = await supabase
    .from('venue_tables')
    .update({ number, label })
    .eq('id', input.tableId)
    .select('id')

  if (error) throw new Error(describeTableError(error, number))
  if (data.length === 0) {
    throw new Error(
      'Cette table n’a pas été modifiée : elle a peut-être été supprimée entre-temps.',
    )
  }
}

/**
 * Removes a table.
 *
 * Its orders keep their copied number and label (`orders.table_id` is set to
 * `null`), and its printed code falls back to the picker on the customer menu.
 */
export async function deleteVenueTable(tableId: string): Promise<void> {
  const { data, error } = await supabase
    .from('venue_tables')
    .delete()
    .eq('id', tableId)
    .select('id')

  if (error) throw new Error(describeError(error))
  if (data.length === 0) {
    throw new Error(
      'Cette table n’a pas été supprimée : elle n’est pas rattachée à votre compte.',
    )
  }
}
