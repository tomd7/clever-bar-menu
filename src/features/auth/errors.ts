/**
 * An auth failure whose message is already French, with Supabase's `code` kept.
 *
 * Most screens only print the message. The account screen has to branch on
 * the code as well: `reauthentication_needed` is not an error to show but the
 * cue to send the emailed code, and a refused code sends the manager to a
 * different step than a refused password. Keeping the code on the thrown
 * error lets it do that without `api.ts` handing back Supabase's English.
 */
export class AuthFailure extends Error {
  readonly code: string | undefined

  constructor(code: string | undefined, message: string) {
    super(message)
    this.name = 'AuthFailure'
    this.code = code
  }
}

/** The Supabase code behind an error, when it is an `AuthFailure`. */
export function authFailureCode(error: unknown): string | undefined {
  return error instanceof AuthFailure ? error.code : undefined
}

/**
 * Traduit les erreurs d'authentification Supabase, qui arrivent en anglais.
 *
 * « Identifiants incorrects » reste volontairement indistinct entre une adresse
 * inconnue et un mot de passe erroné : préciser lequel des deux est en cause
 * transformerait l'écran en outil d'énumération des comptes existants.
 *
 * `fallback` exists because the default sentence is a *sign-in* failure, and
 * this function now also translates a recovery link that no longer opens: an
 * unknown code met on that screen must not tell the manager their connection
 * failed. Callers outside sign-in pass the sentence that fits their screen.
 */
export function translateAuthError(
  code: string | undefined,
  fallback = 'Connexion impossible. Réessayez.',
): string {
  switch (code) {
    case 'invalid_credentials':
      return 'Adresse e-mail ou mot de passe incorrect.'
    case 'email_not_confirmed':
      return "Votre adresse e-mail n'a pas encore été confirmée. Consultez le message d'invitation reçu par mail."
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return 'Trop de tentatives. Patientez quelques instants avant de réessayer.'
    case 'user_banned':
      return 'Cet accès a été suspendu. Contactez votre administrateur.'
    /*
      A recovery link is single-use and short-lived, so this code is the
      ordinary outcome of a link opened twice or a day late — not an edge case.
    */
    case 'otp_expired':
      return 'Ce lien a expiré ou a déjà été utilisé. Demandez-en un nouveau.'
    case 'same_password':
      return 'Ce mot de passe est déjà le vôtre. Choisissez-en un autre.'
    case 'weak_password':
      return 'Mot de passe trop faible. Allongez-le ou variez les caractères.'
    /*
      The project's « Require current password when updating » setting. Both
      strings come from GoTrue's `apierrors/errorcode.go` — auth-js's `ErrorCode`
      union does not list them. Naming the *current* password is safe here, and
      only here: the caller is already signed in, so there is no account to
      enumerate.
    */
    case 'current_password_required':
      return 'Saisissez votre mot de passe actuel.'
    case 'current_password_invalid':
      return 'Le mot de passe actuel est incorrect.'
    /* The code mailed by `reauthenticate()`: mistyped, expired, or already spent. */
    case 'reauthentication_not_valid':
      return 'Ce code est incorrect ou a expiré. Vérifiez-le, ou demandez-en un nouveau.'
    /*
      A safety net. The account screen catches this code and turns it into the
      code step, so the sentence should never be read — but if a new caller
      forgets to, it still says what to do.
    */
    case 'reauthentication_needed':
      return "Confirmez d'abord votre identité avec le code envoyé par e-mail."
    default:
      return fallback
  }
}
