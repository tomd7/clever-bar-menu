/** The floor this application sets, above Supabase's own default of six. */
export const MIN_PASSWORD_LENGTH = 8

/**
 * What is wrong with the password just typed, or `undefined`.
 *
 * The confirmation field has no server-side counterpart: two identically
 * mistyped passwords are a perfectly valid pair for the API, and the manager
 * would be locked out by a password they never meant to set. That check can
 * only happen here.
 *
 * The length is checked here too, so the answer comes before the round trip —
 * Supabase enforces its own minimum anyway, and `weak_password` covers the
 * gap should the project raise it above this one.
 */
export function passwordProblem(
  password: string,
  confirmation: string,
): string | undefined {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Le mot de passe doit faire au moins ${MIN_PASSWORD_LENGTH} caractères.`
  }

  if (password !== confirmation) {
    return 'Les deux mots de passe ne sont pas identiques.'
  }

  return undefined
}
