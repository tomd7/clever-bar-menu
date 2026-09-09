import { useState } from 'react'

import { ActionButton } from '#/components/buttons/action-button'
import { ErrorNote } from '#/components/error-note'
import { MIN_PASSWORD_LENGTH, passwordProblem } from '#/features/auth/password'
import { TextField } from '#/components/form/text-field'
import { useUpdatePassword } from '#/features/auth/mutations'

import type { FormEvent } from 'react'

/**
 * Sets the new password on the session the recovery link opened.
 *
 * The local `problem` is not a copy of `mutation.error` — it is the answer to
 * the one question the API is never asked: whether the two fields match. It is
 * cleared on the next keystroke, where React Query clears its own on the next
 * `mutate`, and only one of the two shows at a time.
 *
 * `onUpdated` is left to the caller, like `LoginForm`'s `onSignedIn`: where a
 * manager goes next belongs to the route. The router invalidation, which
 * belongs to the change itself, lives in `useUpdatePassword`.
 */
export function ResetPasswordForm({ onUpdated }: { onUpdated: () => void }) {
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [problem, setProblem] = useState<string>()

  const updatePassword = useUpdatePassword()

  function handleSubmit(event: FormEvent) {
    event.preventDefault()

    const found = passwordProblem(password, confirmation)
    setProblem(found)
    if (found) return

    updatePassword.mutate(password, { onSuccess: onUpdated })
  }

  const message = problem ?? updatePassword.error?.message

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      <TextField
        label="Nouveau mot de passe"
        hint={`Au moins ${MIN_PASSWORD_LENGTH} caractères.`}
        surface="page"
        type="password"
        autoComplete="new-password"
        minLength={MIN_PASSWORD_LENGTH}
        autoFocus
        required
        value={password}
        onChange={(event) => {
          setPassword(event.target.value)
          setProblem(undefined)
        }}
      />

      <TextField
        label="Confirmez le mot de passe"
        surface="page"
        type="password"
        autoComplete="new-password"
        required
        value={confirmation}
        onChange={(event) => {
          setConfirmation(event.target.value)
          setProblem(undefined)
        }}
      />

      {message ? <ErrorNote className="mt-0">{message}</ErrorNote> : null}

      <ActionButton
        type="submit"
        surface="page"
        disabled={updatePassword.isPending}
        className="w-full"
      >
        {updatePassword.isPending
          ? 'Un instant…'
          : 'Enregistrer le mot de passe'}
      </ActionButton>
    </form>
  )
}
