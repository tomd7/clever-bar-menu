import { useState } from 'react'

import { ActionButton } from '#/components/buttons/action-button'
import { ErrorNote } from '#/components/error-note'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { useSignIn } from '#/features/auth/mutations'

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
 * route, pas du formulaire. L'invalidation du routeur, elle, appartient à la
 * connexion et vit dans `useSignIn`.
 */
export function LoginForm({ onSignedIn }: { onSignedIn: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const signIn = useSignIn()

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    signIn.mutate({ email, password }, { onSuccess: onSignedIn })
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

      {signIn.error ? (
        <ErrorNote className="mt-0">{signIn.error.message}</ErrorNote>
      ) : null}

      <ActionButton
        type="submit"
        surface="page"
        disabled={signIn.isPending}
        className="w-full"
      >
        {signIn.isPending ? 'Un instant…' : 'Se connecter'}
      </ActionButton>
    </form>
  )
}
