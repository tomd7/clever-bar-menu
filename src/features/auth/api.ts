import { translateAuthError } from '#/features/auth/errors'
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
  if (error) throw new Error(translateAuthError(error.code))
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
  if (error) throw new Error(translateAuthError(error.code))
}

/**
 * Sets a new password on the session the recovery link opened.
 *
 * Nothing here proves the caller followed a link: `updateUser` only needs a
 * session. What makes that acceptable is the project's *Secure password
 * change* setting, which makes Supabase refuse the change when the session is
 * not recent — the boundary is server-side, as with RLS.
 */
export async function updatePassword(password: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password })
  if (error) throw new Error(translateAuthError(error.code))
}
