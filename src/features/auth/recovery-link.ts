import { translateAuthError } from '#/features/auth/errors'

/**
 * The recovery link — the address Supabase sends the manager back to, and what
 * it leaves behind when the link no longer works.
 */

/**
 * Where the mail lands.
 *
 * Two places have to agree on it: the request screen, which hands it to
 * Supabase, and the route that receives the link. It is also the value to
 * declare in the project's *Redirect URLs* — Supabase silently falls back to
 * the site URL for an address it has not been given, and the manager then ends
 * up on the home page holding a valid session and no form.
 */
export const RECOVERY_PATH = '/reset-password'

/**
 * The same address, absolute: Supabase only accepts a full URL.
 *
 * `origin` is passed rather than read here, like `publicMenuUrl` does, so the
 * function stays verifiable without a browser.
 */
export function recoveryUrl(origin: string): string {
  return `${origin}${RECOVERY_PATH}`
}

/**
 * Why the link did not open a session, as a sentence to show.
 *
 * Always returns one: reaching the reset screen without a session means the
 * link failed, whether or not Supabase said why — a dead link, an address
 * typed by hand, a mail opened twice. A screen that rendered nothing in that
 * case would look like a loading failure.
 *
 * Only `error_code` is read. `error_description` arrives in English, and
 * `error` alone (« access_denied ») names no cause the manager can act on.
 */
export function recoveryLinkError(hash: string): string {
  const params = new URLSearchParams(hash.replace(/^#/, ''))

  return translateAuthError(
    params.get('error_code') ?? undefined,
    "Ce lien de réinitialisation n'est plus valable. Demandez-en un nouveau.",
  )
}
