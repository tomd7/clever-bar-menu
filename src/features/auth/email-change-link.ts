import { translateAuthError } from '#/features/auth/errors'

/**
 * The email-change links: where Supabase sends the manager back to, and what
 * it leaves in the address when they arrive.
 */

/**
 * Where the confirmation links land: the account screen, where the change was
 * asked for and where the pending address is shown.
 *
 * Like `RECOVERY_PATH`, it must be listed in the project's *Redirect URLs*:
 * Supabase silently falls back to the site URL for an address it has not been
 * given, and the manager lands on the home page with no word on the change.
 */
export const EMAIL_CHANGE_PATH = '/admin/compte'

/** The same address, absolute — Supabase only accepts a full URL. */
export function emailChangeUrl(origin: string): string {
  return `${origin}${EMAIL_CHANGE_PATH}`
}

/** What a confirmation link reports once it has brought the manager back. */
export type EmailChangeNotice =
  { kind: 'half-confirmed' } | { kind: 'failed'; message: string }

/**
 * Reads the fragment a confirmation link leaves behind, or `undefined` when
 * there is none.
 *
 * With *Secure email change* on, the change takes two links — one to each
 * address. The first one confirmed comes back with a `message` and no
 * session; that sentence is in English and says one thing only, « now open
 * the other one », so its presence is all that is read. The second comes back
 * with tokens, which `supabase-js` consumes and clears before this screen
 * renders: by then the new address is simply the account's.
 *
 * A dead link comes back with `error_code`. As on the reset screen, only the
 * code is read — `error_description` is English too.
 */
export function emailChangeNotice(hash: string): EmailChangeNotice | undefined {
  const params = new URLSearchParams(hash.replace(/^#/, ''))
  const code = params.get('error_code') ?? params.get('error')

  if (code) {
    return {
      kind: 'failed',
      message: translateAuthError(
        params.get('error_code') ?? undefined,
        "Ce lien de confirmation n'est plus valable. Demandez à nouveau le changement d'adresse.",
      ),
    }
  }

  return params.has('message') ? { kind: 'half-confirmed' } : undefined
}
