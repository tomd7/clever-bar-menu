import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useState } from 'react'

import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { supabase } from '#/lib/supabase'

import type { FormEvent } from 'react'

const DEFAULT_REDIRECT = '/admin'

/**
 * Une destination de redirection vient de l'URL, donc de l'utilisateur, donc
 * potentiellement d'un lien piégé. On n'accepte qu'un chemin interne : refuser
 * `//evil.com` autant que `https://evil.com`, sans quoi la page de connexion
 * devient un tremplin de phishing (open redirect).
 */
function sanitizeRedirect(value: unknown): string | undefined {
  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    value.startsWith('//')
  ) {
    return undefined
  }
  return value
}

/**
 * Traduit les erreurs d'authentification Supabase, qui arrivent en anglais.
 *
 * « Identifiants incorrects » reste volontairement indistinct entre une adresse
 * inconnue et un mot de passe erroné : préciser lequel des deux est en cause
 * transformerait l'écran en outil d'énumération des comptes existants.
 */
function translateAuthError(code: string | undefined): string {
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

export const Route = createFileRoute('/login')({
  /**
   * La session Supabase vit dans le navigateur : la vérifier pendant le rendu
   * serveur conclurait systématiquement « non connecté ».
   */
  ssr: false,
  /**
   * `redirect` est omise quand elle est absente, et non ramenée à sa valeur
   * par défaut : une clé toujours présente pousserait le routeur à réécrire
   * `/login` en `/login?redirect=%2Fadmin` à chaque visite directe.
   */
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => {
    const target = sanitizeRedirect(search.redirect)
    return target ? { redirect: target } : {}
  },
  beforeLoad: async ({ search }) => {
    const { data } = await supabase.auth.getSession()
    if (data.session) {
      throw redirect({ href: search.redirect ?? DEFAULT_REDIRECT })
    }
  },
  component: LoginPage,
})

/**
 * Écran de connexion — connexion seule.
 *
 * Les comptes sont créés par l'administrateur de la plateforme, jamais par le
 * visiteur : il n'y a donc pas de formulaire d'inscription ici. Attention,
 * cette absence n'est qu'une affaire d'interface. L'endpoint `/auth/v1/signup`
 * de Supabase reste joignable directement avec la clé publiable, qui est par
 * conception dans le bundle. Ce qui ferme réellement l'inscription est le
 * réglage **Allow new users to sign up** du projet Supabase.
 */
function LoginPage() {
  const router = useRouter()
  const search = Route.useSearch()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setPending(true)

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      setError(translateAuthError(signInError.code))
      setPending(false)
      return
    }

    /**
     * Les gardes de route ont déjà évalué la session : sans invalidation,
     * `beforeLoad` conserverait son verdict « non connecté » et renverrait
     * aussitôt ici.
     */
    await router.invalidate()
    await router.navigate({ href: search.redirect ?? DEFAULT_REDIRECT })
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="rise-in w-full max-w-sm">
        <div className="island-shell rounded-2xl p-6 sm:p-8">
          <p className="island-kicker">Espace gérant</p>
          <h1 className="display-title mt-2 text-2xl leading-tight sm:text-3xl">
            Se connecter
          </h1>
          <p className="mt-2 text-sm text-[var(--sea-ink-soft)]">
            Accédez au back-office de votre établissement.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Adresse e-mail</Label>
              <Input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                /* 44px sur mobile : la cible tactile minimale. Plus dense à partir de lg. */
                className="h-11 lg:h-10"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-11 lg:h-10"
              />
            </div>

            {error ? (
              <p
                role="alert"
                className="animate-in fade-in-0 slide-in-from-top-1 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive duration-200 ease-out"
              >
                {error}
              </p>
            ) : null}

            <Button
              type="submit"
              disabled={pending}
              /* scale au maintien : la pression doit se voir immédiatement. */
              className="h-11 w-full transition-transform duration-150 ease-out active:scale-[0.97] lg:h-10"
            >
              {pending ? 'Un instant…' : 'Se connecter'}
            </Button>
          </form>

          <p className="mt-6 border-t border-[var(--line)] pt-4 text-center text-sm text-[var(--sea-ink-soft)]">
            Les accès sont créés par l'administrateur de la plateforme.
            Contactez-le pour obtenir le vôtre.
          </p>
        </div>
      </div>
    </main>
  )
}
