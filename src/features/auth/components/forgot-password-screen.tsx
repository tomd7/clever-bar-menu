import { ArrowLeft } from 'lucide-react'

import { AuthIsland } from '#/features/auth/components/auth-island'
import { ForgotPasswordForm } from '#/features/auth/components/forgot-password-form'
import { NavLink } from '#/components/nav-link'

/** Écran de demande d'un lien de réinitialisation. */
export function ForgotPasswordScreen() {
  return (
    <AuthIsland kicker="Espace gérant" title="Mot de passe oublié">
      <p className="mt-2 text-sm text-ink-soft">
        Indiquez l'adresse de votre compte : vous recevrez un lien pour choisir
        un nouveau mot de passe.
      </p>

      <ForgotPasswordForm />

      <p className="mt-3 border-t border-line pt-2 text-center">
        <NavLink to="/login" icon={ArrowLeft}>
          Retour à la connexion
        </NavLink>
      </p>
    </AuthIsland>
  )
}
