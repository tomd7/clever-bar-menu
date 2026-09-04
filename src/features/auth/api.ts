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
