import type { User } from '@supabase/supabase-js'

/**
 * The manager's name, as the account screen edits it.
 *
 * Stored in the auth user's `user_metadata`, not in a table: nothing but the
 * manager themself reads it, and the session the guard loads already carries
 * it — no query, no migration, no policy. The flip side is that the manager
 * can write any key there, so this is **display data only**: never let an RLS
 * policy or a server decision read it.
 */
export type ProfileName = { firstName: string; lastName: string }

/** Longest first or last name the form accepts. */
export const MAX_NAME_LENGTH = 60

/**
 * Reads the name out of `user_metadata`.
 *
 * The metadata is untyped JSON the manager can write to, so each value is
 * checked rather than cast: anything that is not a string reads as empty.
 */
export function profileName(user: Pick<User, 'user_metadata'>): ProfileName {
  const metadata: Record<string, unknown> = user.user_metadata

  return {
    firstName: asName(metadata.first_name),
    lastName: asName(metadata.last_name),
  }
}

/** « Camille Lambert », « Camille », or `undefined` when no name is set. */
export function fullName({
  firstName,
  lastName,
}: ProfileName): string | undefined {
  const joined = [firstName, lastName].filter(Boolean).join(' ')
  return joined || undefined
}

function asName(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}
