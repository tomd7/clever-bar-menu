import { useState } from 'react'
import { MailCheck } from 'lucide-react'

import { ActionButton } from '#/components/buttons/action-button'
import { ErrorNote } from '#/components/error-note'
import { TextField } from '#/components/form/text-field'
import { recoveryUrl } from '#/features/auth/recovery-link'
import { useRequestPasswordReset } from '#/features/auth/mutations'

import type { FormEvent } from 'react'

/**
 * Asks Supabase for a recovery mail.
 *
 * The confirmation replaces the form instead of sitting under it: the manager
 * has nothing left to do on this screen, and a form still standing invites a
 * second send that the rate limit would refuse.
 *
 * That state is read from the mutation (`isSuccess`), not held in a `useState`
 * beside it — React Query already owns it, and `reset()` is what walks it back.
 */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState('')

  const requestReset = useRequestPasswordReset()

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    /*
      The origin is read here, in the handler, and not at render: this screen is
      server-rendered, and the address to come back to is the one the manager is
      actually browsing — a recette host must not mail a production link.
    */
    requestReset.mutate({
      email,
      redirectTo: recoveryUrl(window.location.origin),
    })
  }

  if (requestReset.isSuccess) {
    return <RecoveryMailSent onChangeAddress={() => requestReset.reset()} />
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      <TextField
        label="Adresse e-mail"
        surface="page"
        type="email"
        inputMode="email"
        autoComplete="email"
        autoFocus
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />

      {requestReset.error ? (
        <ErrorNote className="mt-0">{requestReset.error.message}</ErrorNote>
      ) : null}

      <ActionButton
        type="submit"
        surface="page"
        disabled={requestReset.isPending}
        className="w-full"
      >
        {requestReset.isPending ? 'Envoi…' : 'Envoyer le lien'}
      </ActionButton>
    </form>
  )
}

/**
 * The confirmation, worded so it says nothing about the address.
 *
 * « Si un compte existe » is not padding: confirming only for known addresses
 * would turn this screen into the account-enumeration oracle that the sign-in
 * message is written to avoid. The sentence is the same for everyone because
 * the answer has to be.
 */
function RecoveryMailSent({
  onChangeAddress,
}: {
  onChangeAddress: () => void
}) {
  return (
    /*
      The panel arrives where the form stood, so it enters rather than appears
      — 200ms, ease-out, the same short move as `ErrorNote`. Anything longer
      would sit between the manager and their mailbox.
    */
    <div className="mt-6 duration-200 ease-out animate-in fade-in-0 slide-in-from-bottom-1">
      <p className="flex gap-2 text-sm">
        <MailCheck className="mt-0.5 size-4 shrink-0 text-bottle-deep" />
        <span>
          Si un compte existe pour cette adresse, un lien de réinitialisation
          vient d'y être envoyé.
        </span>
      </p>

      <p className="mt-3 text-sm text-ink-soft">
        Pensez à regarder dans les indésirables. Le lien ne fonctionne qu'une
        fois.
      </p>

      <ActionButton
        variant="outline"
        surface="page"
        className="mt-5 w-full"
        onClick={onChangeAddress}
      >
        Utiliser une autre adresse
      </ActionButton>
    </div>
  )
}
