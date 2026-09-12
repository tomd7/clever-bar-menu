import { AuthFailure, translateAuthError } from '#/features/auth/errors'
import { supabase } from '#/lib/supabase'

/**
 * Connexion par e-mail et mot de passe.
 *
 * L'échec est levé déjà traduit, comme `write()` le fait pour les écritures de
 * la carte : le composant qui affiche le message n'a pas à savoir que Supabase
 * répond en anglais, ni à choisir quelle traduction appliquer.
 */
export async function signIn(credentials: {
  email: string
  password: string
}): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword(credentials)
  if (error) throw new AuthFailure(error.code, translateAuthError(error.code))
}

/**
 * Sends the recovery mail.
 *
 * Resolves the same way whether the address has an account or not: Supabase
 * answers 200 in both cases, and that silence is the point. A call that failed
 * on an unknown address would hand the screen an oracle to enumerate accounts
 * with — the very thing the credentials message avoids. Errors that do come
 * back (a rate limit, a malformed address) reveal nothing of the kind.
 *
 * `redirectTo` is passed in rather than derived here: it depends on the origin
 * the manager is browsing, which only the browser knows.
 */
export async function requestPasswordReset({
  email,
  redirectTo,
}: {
  email: string
  redirectTo: string
}): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  })
  if (error) throw new AuthFailure(error.code, translateAuthError(error.code))
}

/**
 * Sets a new password on the current session — the one a recovery link
 * opened, or an ordinary signed-in one on the account screen.
 *
 * Nothing here proves who is holding the session: `updateUser` only needs one,
 * and on a tablet left signed in behind a bar that is the easiest thing in the
 * building to borrow. The boundary is server-side, as with RLS, and it takes
 * two project settings:
 *
 * - **Require current password when updating** makes Supabase check
 *   `currentPassword`. It skips the check for a recovery session, which is why
 *   the reset screen sends none — the manager has just proved access to the
 *   mailbox instead.
 * - **Secure password change** refuses a session created more than 24 hours
 *   ago with `reauthentication_needed`. The caller then asks for a code with
 *   `requestReauthentication` and calls this again with it as `nonce`.
 *
 * The fallback names a password change, not a sign-in: « Connexion
 * impossible » on this call would send the manager looking for the wrong
 * problem.
 */
export async function updatePassword({
  password,
  currentPassword,
  nonce,
}: {
  password: string
  currentPassword?: string
  nonce?: string
}): Promise<void> {
  const { error } = await supabase.auth.updateUser({
    password,
    current_password: currentPassword,
    nonce,
  })
  if (error) {
    throw new AuthFailure(
      error.code,
      translateAuthError(
        error.code,
        "Le mot de passe n'a pas pu être enregistré. Réessayez.",
      ),
    )
  }
}

/**
 * Mails a one-time code to the account's own address.
 *
 * Only needed when `updatePassword` answered `reauthentication_needed`. The
 * code is what `updatePassword` takes as `nonce`; the mail's wording is the
 * project's *Reauthentication* template, which ships in English.
 */
export async function requestReauthentication(): Promise<void> {
  const { error } = await supabase.auth.reauthenticate()
  if (error) {
    throw new AuthFailure(
      error.code,
      translateAuthError(
        error.code,
        "Le code n'a pas pu être envoyé. Réessayez.",
      ),
    )
  }
}

/**
 * Revokes every session of this account except the current one.
 *
 * `scope: 'others'` fires no `SIGNED_OUT` locally, so nothing on this screen
 * needs invalidating. Changing the password does not do this on its own:
 * Supabase's update handler revokes nothing, so the other devices would stay
 * signed in with the old password's sessions.
 *
 * Revoking a refresh token does not recall the access tokens already issued:
 * a signed-out device keeps working until its token expires (one hour by
 * default). Say « déconnectés », never « immédiatement ».
 */
export async function signOutOtherDevices(): Promise<void> {
  const { error } = await supabase.auth.signOut({ scope: 'others' })
  if (error) {
    throw new AuthFailure(
      error.code,
      translateAuthError(
        error.code,
        "Vos autres appareils n'ont pas pu être déconnectés. Réessayez.",
      ),
    )
  }
}
