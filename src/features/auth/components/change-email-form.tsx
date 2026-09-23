import { Check, MailCheck, RotateCw } from 'lucide-react'
import { useEffect, useState } from 'react'

import { ActionButton } from '#/components/buttons/action-button'
import { ErrorNote } from '#/components/error-note'
import { SaveButton } from '#/components/buttons/save-button'
import { TextField } from '#/components/form/text-field'
import {
  emailChangeNotice,
  emailChangeUrl,
} from '#/features/auth/email-change-link'
import { useRequestEmailChange } from '#/features/auth/mutations'

import type { FormEvent } from 'react'

/**
 * Moves the account to a new address — the one the manager signs in with.
 *
 * **Asking changes nothing yet.** Supabase mails a link to each address
 * (*Secure email change*, see `requestEmailChange`) and keeps the new one as
 * the user's `new_email` until both are followed. `pendingEmail` is that
 * field, read by the route from the session: while it is set, the screen says
 * which address is waiting and which one still signs in, and offers to send
 * the links again — the first mail is the one that lands in the spam folder.
 *
 * **The links come back here.** A link followed first returns with a
 * `#message`, a dead one with an `#error_code`; `emailChangeNotice` reads it
 * once on mount, and the fragment is then removed from the address bar so a
 * reload does not announce it twice. A link that completes the change returns
 * with tokens instead, which `supabase-js` has consumed before this renders:
 * the new address is then simply the account's, and there is nothing to say.
 */
export function ChangeEmailForm({
  email,
  pendingEmail,
}: {
  email: string | undefined
  pendingEmail: string | undefined
}) {
  const request = useRequestEmailChange()

  const [draft, setDraft] = useState('')
  const [problem, setProblem] = useState<string>()

  /*
    Read during the first render rather than in an effect, so the notice is
    in the first paint. The route is `ssr: false`: `window` is always there.
  */
  const [linkNotice] = useState(() => emailChangeNotice(window.location.hash))

  useEffect(() => {
    if (!linkNotice) return
    const { pathname, search } = window.location
    window.history.replaceState(window.history.state, '', pathname + search)
  }, [linkNotice])

  function send(address: string, onSent?: () => void) {
    request.mutate(
      { email: address, redirectTo: emailChangeUrl(window.location.origin) },
      { onSuccess: onSent },
    )
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()

    /*
      Supabase treats the current address as « nothing to change » and
      answers 200 without mailing anything — the screen would announce links
      that never leave.
    */
    const same = draft.trim().toLowerCase() === email?.toLowerCase()
    setProblem(same ? "C'est déjà l'adresse de votre compte." : undefined)
    if (same) return

    /* The address now shows as pending above; the field starts over. */
    send(draft, () => setDraft(''))
  }

  const message = problem ?? request.error?.message

  /*
    One mutation behind two buttons: each says « in progress » only for its
    own call, and both are disabled while either runs.
  */
  const resending =
    request.isPending && request.variables.email === pendingEmail

  return (
    <div className="space-y-4">
      {linkNotice?.kind === 'failed' ? (
        <ErrorNote className="mt-0">{linkNotice.message}</ErrorNote>
      ) : null}

      {pendingEmail ? (
        <div className="rounded-xl border border-line bg-surface-raised p-3 text-sm sm:p-4">
          <p className="flex items-start gap-2 font-semibold">
            <MailCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span className="min-w-0">
              En attente de confirmation :{' '}
              <span className="wrap-break-word">{pendingEmail}</span>
            </span>
          </p>
          <p className="mt-1 text-ink-soft">
            {linkNotice?.kind === 'half-confirmed'
              ? "Première confirmation reçue. Ouvrez maintenant le lien envoyé à l'autre adresse."
              : 'Ouvrez le lien envoyé à chacune des deux adresses.'}{' '}
            Jusque-là, vous vous connectez toujours avec{' '}
            <span className="font-medium wrap-break-word text-ink">
              {email}
            </span>
            .
          </p>
          <ActionButton
            icon={RotateCw}
            variant="ghost"
            disabled={request.isPending}
            onClick={() => {
              setProblem(undefined)
              send(pendingEmail)
            }}
            className="mt-2 -ml-3"
          >
            {resending ? 'Envoi…' : 'Renvoyer les liens'}
          </ActionButton>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-4">
        <TextField
          label="Nouvelle adresse"
          hint="Un lien de confirmation part vers l'adresse actuelle et vers la nouvelle."
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value)
            setProblem(undefined)
          }}
        />

        {message ? <ErrorNote className="mt-0">{message}</ErrorNote> : null}

        <div className="flex flex-wrap items-center gap-3">
          <SaveButton
            surface="panel"
            pending={request.isPending && !resending}
            disabled={resending}
          >
            Changer d'adresse
          </SaveButton>
          {/*
            Always rendered: a `role="status"` inserted together with its
            message is often not announced.
          */}
          <p role="status" className="text-sm">
            {request.isSuccess ? (
              <span className="inline-flex items-center gap-1.5 text-bottle-deep">
                <Check className="size-4 shrink-0" aria-hidden />
                Liens de confirmation envoyés.
              </span>
            ) : null}
          </p>
        </div>
      </form>
    </div>
  )
}
