import { AuthIsland } from '#/features/auth/components/auth-island'
import { LoginForm } from '#/features/auth/components/login-form'
import { NavLink } from '#/components/nav-link'

/** Écran de connexion au back-office. */
export function LoginScreen({ onSignedIn }: { onSignedIn: () => void }) {
  return (
    <AuthIsland kicker="Espace gérant" title="Se connecter">
      <p className="mt-2 text-sm text-ink-soft">
        Accédez au back-office de votre établissement.
      </p>

      <LoginForm onSignedIn={onSignedIn} />

      {/*
        A text link, not a button: it is a destination, and it must weigh less
        than « Se connecter » right above it. Its 44px target comes from
        `.nav-link`, so the row needs no padding of its own.
      */}
      <p className="mt-1 text-center">
        <NavLink to="/forgot-password">Mot de passe oublié ?</NavLink>
      </p>

      <p className="mt-3 border-t border-line pt-4 text-center text-sm text-ink-soft">
        Les accès sont créés par l'administrateur de la plateforme. Contactez-le
        pour obtenir le vôtre.
      </p>
    </AuthIsland>
  )
}
