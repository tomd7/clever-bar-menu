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
    default:
      return fallback
  }
}
