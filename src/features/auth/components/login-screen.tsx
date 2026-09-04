import { LoginForm } from '#/features/auth/components/login-form'

/** Écran de connexion au back-office. */
export function LoginScreen({ onSignedIn }: { onSignedIn: () => void }) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="rise-in w-full max-w-sm">
        <div className="island-shell rounded-2xl p-6 sm:p-8">
          <p className="island-kicker">Espace gérant</p>
          <h1 className="display-title mt-2 text-2xl leading-tight sm:text-3xl">
            Se connecter
          </h1>
          <p className="mt-2 text-sm text-ink-soft">
            Accédez au back-office de votre établissement.
          </p>

          <LoginForm onSignedIn={onSignedIn} />

          <p className="mt-6 border-t border-line pt-4 text-center text-sm text-ink-soft">
            Les accès sont créés par l'administrateur de la plateforme.
            Contactez-le pour obtenir le vôtre.
          </p>
        </div>
      </div>
    </main>
  )
}
