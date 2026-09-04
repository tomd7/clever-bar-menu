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

type Mode = 'signin' | 'signup'

function LoginPage() {
  const router = useRouter()
  const search = Route.useSearch()

  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setNotice(null)
    setPending(true)

    try {
      if (mode === 'signup') {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        })
        if (signUpError) throw signUpError

        /**
         * Si la confirmation d'e-mail est active sur le projet Supabase,
         * `signUp` réussit sans ouvrir de session. Sans ce cas explicite,
         * l'écran resterait figé sans rien expliquer.
         */
        if (!data.session) {
          setNotice(
            'Compte créé. Vérifiez votre boîte mail pour confirmer votre adresse, puis connectez-vous.',
          )
          setMode('signin')
          return
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (signInError) throw signInError
      }

      /**
       * Les gardes de route ont déjà évalué la session : sans invalidation,
       * `beforeLoad` conserverait son verdict « non connecté » et renverrait
       * aussitôt ici.
       */
      await router.invalidate()
      await router.navigate({ href: search.redirect ?? DEFAULT_REDIRECT })
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Connexion impossible. Réessayez.',
      )
    } finally {
      setPending(false)
    }
  }

  const isSignup = mode === 'signup'

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="rise-in w-full max-w-sm">
        <div className="island-shell rounded-2xl p-6 sm:p-8">
          <p className="island-kicker">Espace gérant</p>
          <h1 className="display-title mt-2 text-2xl leading-tight sm:text-3xl">
            {isSignup ? 'Créer un compte' : 'Se connecter'}
          </h1>
          <p className="mt-2 text-sm text-[var(--sea-ink-soft)]">
            {isSignup
              ? 'Créez votre accès pour gérer la carte de votre établissement.'
              : 'Accédez au back-office de votre établissement.'}
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
                autoComplete={isSignup ? 'new-password' : 'current-password'}
                required
                minLength={isSignup ? 8 : undefined}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-11 lg:h-10"
              />
              {isSignup ? (
                <p className="text-xs text-[var(--sea-ink-soft)]">
                  8 caractères minimum.
                </p>
              ) : null}
            </div>

            {error ? (
              <p
                role="alert"
                className="animate-in fade-in-0 slide-in-from-top-1 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive duration-200 ease-out"
              >
                {error}
              </p>
            ) : null}

            {notice ? (
              <p
                role="status"
                className="animate-in fade-in-0 slide-in-from-top-1 rounded-md border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-2 text-sm duration-200 ease-out"
              >
                {notice}
              </p>
            ) : null}

            <Button
              type="submit"
              disabled={pending}
              /* scale au maintien : la pression doit se voir immédiatement. */
              className="h-11 w-full transition-transform duration-150 ease-out active:scale-[0.97] lg:h-10"
            >
              {pending
                ? 'Un instant…'
                : isSignup
                  ? 'Créer mon compte'
                  : 'Se connecter'}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-[var(--sea-ink-soft)]">
            {isSignup ? 'Vous avez déjà un compte ?' : 'Pas encore de compte ?'}{' '}
            <button
              type="button"
              onClick={() => {
                setMode(isSignup ? 'signin' : 'signup')
                setError(null)
                setNotice(null)
              }}
              className="font-semibold text-[var(--lagoon-deep)] underline underline-offset-2"
            >
              {isSignup ? 'Se connecter' : 'Créer un compte'}
            </button>
          </p>
        </div>
      </div>
    </main>
  )
}
