import { useState } from 'react'

import { ActionButton } from '#/components/buttons/action-button'
import { ErrorNote } from '#/components/error-note'
import { TextField } from '#/components/form/text-field'
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
      <TextField
        label="Adresse e-mail"
        surface="page"
        type="email"
        inputMode="email"
        autoComplete="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />

      <TextField
        label="Mot de passe"
        surface="page"
        type="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />

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
