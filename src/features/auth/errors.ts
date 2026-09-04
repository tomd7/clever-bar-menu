/**
 * Traduit les erreurs d'authentification Supabase, qui arrivent en anglais.
 *
 * « Identifiants incorrects » reste volontairement indistinct entre une adresse
 * inconnue et un mot de passe erroné : préciser lequel des deux est en cause
 * transformerait l'écran en outil d'énumération des comptes existants.
 */
export function translateAuthError(code: string | undefined): string {
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
    default:
      return 'Connexion impossible. Réessayez.'
  }
}
