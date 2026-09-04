import { useState } from 'react'

import { Button } from '#/components/ui/button'
import { ErrorNote } from '#/components/error-note'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { supabase } from '#/lib/supabase'
import { translateAuthError } from '#/features/auth/errors'

import type { FormEvent } from 'react'

/**
 * Formulaire de connexion — connexion seule.
 *
 * Les comptes sont créés par l'administrateur de la plateforme, jamais par le
 * visiteur : il n'y a donc pas de formulaire d'inscription ici. Attention,
 * cette absence n'est qu'une affaire d'interface. L'endpoint `/auth/v1/signup`
 * de Supabase reste joignable directement avec la clé publiable, qui est par
 * conception dans le bundle. Ce qui ferme réellement l'inscription est le
 * réglage **Allow new users to sign up** du projet Supabase.
 *
 * `onSignedIn` est laissé à l'appelant : la navigation qui suit dépend de la
 * route, pas du formulaire.
 */
export function LoginForm({ onSignedIn }: { onSignedIn: () => Promise<void> }) {
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

    await onSignedIn()
  }

  return (
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

      {error ? <ErrorNote className="mt-0">{error}</ErrorNote> : null}

      <Button
        type="submit"
        disabled={pending}
        /* scale au maintien : la pression doit se voir immédiatement. */
        className="h-11 w-full transition-transform duration-150 ease-out active:scale-[0.97] lg:h-10"
      >
        {pending ? 'Un instant…' : 'Se connecter'}
      </Button>
    </form>
  )
}
