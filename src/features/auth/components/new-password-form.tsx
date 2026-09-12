import { useState } from 'react'

import { ErrorNote } from '#/components/error-note'
import { MIN_PASSWORD_LENGTH, passwordProblem } from '#/features/auth/password'
import { SaveButton } from '#/components/buttons/save-button'
import { TextField } from '#/components/form/text-field'
import { cn } from '#/lib/utils.ts'

import type { FormEvent } from 'react'
import type { Surface } from '#/components/surface'

/** What the form hands over once the two new fields agree. */
export type NewPasswords = { password: string; currentPassword?: string }

/**
 * The form that sets a password — on the recovery link's screen, and on the
 * account screen. One component so the two can't drift: the length rule, the
 * « both fields match » check and the password-manager wiring are the same
 * wherever a password is chosen.
 *
 * It holds the fields and the one check the API is never asked, and nothing
 * else: which call to make, what to do after, and the server's error belong
 * to the screen, which passes `pending` and `error` back in. The local
 * `problem` is not a copy of that error — it is cleared on the next
 * keystroke, where React Query clears its own on the next `mutate`, and only
 * one of the two shows at a time.
 *
 * `askCurrentPassword` adds the current password. Supabase checks it, not
 * this form; the recovery screen leaves it out because a recovery session is
 * exempt from the check.
 *
 * `username` renders a visually hidden field holding the account's address.
 * Without it, a password manager offered « current-password » and
 * « new-password » does not know which saved login they belong to, and offers
 * to save a new one instead of updating it.
 */
export function NewPasswordForm({
  surface,
  submitLabel,
  username,
  askCurrentPassword = false,
  autoFocus = false,
  pending,
  error,
  onSubmit,
  className,
  submitClassName,
}: {
  surface: Surface
  submitLabel: string
  username?: string
  askCurrentPassword?: boolean
  autoFocus?: boolean
  pending: boolean
  error: string | undefined
  onSubmit: (passwords: NewPasswords) => void
  className?: string
  submitClassName?: string
}) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [problem, setProblem] = useState<string>()

  function handleSubmit(event: FormEvent) {
    event.preventDefault()

    const found = passwordProblem(password, confirmation)
    setProblem(found)
    if (found) return

    onSubmit(askCurrentPassword ? { password, currentPassword } : { password })
  }

  const message = problem ?? error

  return (
    <form
      onSubmit={handleSubmit}
      className={cn('relative space-y-4', className)}
    >
      {username !== undefined ? (
        /*
          Not a `TextField`: nobody types in it, it has no label to wire. Out of
          the tab order and the accessibility tree, and `relative` on the form
          keeps its `sr-only` box inside it.
        */
        <input
          type="text"
          name="username"
          autoComplete="username"
          value={username}
          readOnly
          tabIndex={-1}
          aria-hidden
          className="sr-only"
        />
      ) : null}

      {askCurrentPassword ? (
        <TextField
          label="Mot de passe actuel"
          surface={surface}
          type="password"
          name="current-password"
          autoComplete="current-password"
          autoFocus={autoFocus}
          required
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
        />
      ) : null}

      <TextField
        label="Nouveau mot de passe"
        hint={`Au moins ${MIN_PASSWORD_LENGTH} caractères.`}
        surface={surface}
        type="password"
        name="new-password"
        autoComplete="new-password"
        minLength={MIN_PASSWORD_LENGTH}
        autoFocus={autoFocus && !askCurrentPassword}
        required
        value={password}
        onChange={(event) => {
          setPassword(event.target.value)
          setProblem(undefined)
        }}
      />

      <TextField
        label="Confirmez le nouveau mot de passe"
        surface={surface}
        type="password"
        name="confirm-password"
        autoComplete="new-password"
        required
        value={confirmation}
        onChange={(event) => {
          setConfirmation(event.target.value)
          setProblem(undefined)
        }}
      />

      {message ? <ErrorNote className="mt-0">{message}</ErrorNote> : null}

      <SaveButton
        surface={surface}
        pending={pending}
        className={submitClassName}
      >
        {submitLabel}
      </SaveButton>
    </form>
  )
}
