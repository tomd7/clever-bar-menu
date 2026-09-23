import { ArrowLeft, Check, LogOut, RotateCw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { ActionButton } from '#/components/buttons/action-button'
import { ErrorNote } from '#/components/error-note'
import { NewPasswordForm } from '#/features/auth/components/new-password-form'
import { SaveButton } from '#/components/buttons/save-button'
import { TextField } from '#/components/form/text-field'
import { authFailureCode } from '#/features/auth/errors'
import {
  useChangePassword,
  useRequestReauthentication,
  useSignOutOtherDevices,
} from '#/features/auth/mutations'

import type { FormEvent } from 'react'
import type { NewPasswords } from '#/features/auth/components/new-password-form'

/**
 * Refusals that are about the passwords, not the code. Met on the code step,
 * they send the manager back to the three fields — where the fix is.
 */
const PASSWORD_REFUSALS = new Set([
  'current_password_required',
  'current_password_invalid',
  'same_password',
  'weak_password',
])

/**
 * The signed-in password change: current password, new password twice, and —
 * on a session older than a day — the code Supabase mails to prove it is still
 * the account's owner holding the device.
 *
 * **Two steps, one state machine, and every typed password kept.** The
 * password step stays mounted while the code step shows (`hidden`, not
 * unmounted), so a manager who goes back finds the three fields as they left
 * them. `passwords` holds what was *submitted*, which is what the retry with
 * the code sends — not a mirror of the fields.
 *
 * **A code is spent once Supabase has verified it**, and GoTrue verifies it
 * *before* checking the current password or refusing a reused one. So when
 * the code step meets a password refusal, the code is dropped with it: the
 * next submit asks for a new one rather than sending one that can only fail.
 * Short of that, a code already sent is reused — going back to fix a typo
 * does not mail a second one.
 *
 * **The sign-out is its own call and can fail on its own.** Once
 * `useChangePassword` succeeds the password has changed, whatever follows;
 * the fields are cleared then, and a failed sign-out says exactly that and
 * offers to retry the sign-out alone.
 */
export function ChangePasswordForm({ email }: { email: string | undefined }) {
  const change = useChangePassword()
  const reauthentication = useRequestReauthentication()
  const signOutOthers = useSignOutOtherDevices()

  const [step, setStep] = useState<'password' | 'code'>('password')
  const [passwords, setPasswords] = useState<NewPasswords>()
  const [code, setCode] = useState('')
  const [codeSent, setCodeSent] = useState(false)

  /*
    Bumped after a successful change: remounting `NewPasswordForm` is what
    clears its fields. Cleared fields are also the signal a password manager
    reads as « the change went through ».
  */
  const [formKey, setFormKey] = useState(0)

  /*
    Whether the password step has been left once. Its entrance only plays when
    it comes *back* — animating it on the page's first paint would move a form
    the manager has not touched yet.
  */
  const [leftOnce, setLeftOnce] = useState(false)

  const passwordStep = useRef<HTMLDivElement>(null)
  const focusPasswords = useRef(false)

  /*
    The code field held the focus and has just been unmounted. Without this,
    focus falls to `<body>` and a keyboard or screen reader user starts again
    from the top of the page.
  */
  useEffect(() => {
    if (step !== 'password' || !focusPasswords.current) return
    focusPasswords.current = false
    passwordStep.current
      ?.querySelector<HTMLInputElement>('input[type="password"]')
      ?.focus()
  }, [step])

  function goToCode() {
    setLeftOnce(true)
    setStep('code')
  }

  function backToPasswords() {
    focusPasswords.current = true
    setStep('password')
  }

  function requestCode(reason: 'first' | 'resend') {
    change.reset()
    reauthentication.mutate(reason, {
      onSuccess: () => {
        setCodeSent(true)
        setCode('')
        goToCode()
      },
    })
  }

  function send(next: NewPasswords, nonce?: string) {
    change.mutate(
      { ...next, nonce },
      {
        onSuccess: () => {
          setFormKey((key) => key + 1)
          setPasswords(undefined)
          setCode('')
          setCodeSent(false)
          setStep('password')
          reauthentication.reset()
          signOutOthers.mutate()
        },
        onError: (error) => {
          const refusal = authFailureCode(error)

          if (refusal === 'reauthentication_needed') {
            requestCode('first')
          } else if (
            nonce !== undefined &&
            refusal !== undefined &&
            PASSWORD_REFUSALS.has(refusal)
          ) {
            setCode('')
            setCodeSent(false)
            backToPasswords()
          }
        },
      },
    )
  }

  function handlePasswords(next: NewPasswords) {
    setPasswords(next)
    signOutOthers.reset()

    /*
      A code already sent is still good: go and use it rather than asking
      Supabase to mail another one on a session that can only have aged.
    */
    if (codeSent) {
      change.reset()
      goToCode()
      return
    }

    reauthentication.reset()
    send(next)
  }

  function handleCode(event: FormEvent) {
    event.preventDefault()
    if (passwords) send(passwords, code.trim())
  }

  /*
    `reauthentication_needed` is a cue, not an error: it is caught above and
    never printed. Any other refusal is shown on the step it belongs to — the
    code's own refusals on the code step, the rest wherever the manager is.
  */
  const changeMessage =
    authFailureCode(change.error) === 'reauthentication_needed'
      ? undefined
      : change.error?.message

  /*
    No `space-y-*` on this wrapper: the live regions below are always rendered,
    and an empty one would still take its share of the spacing. Each carries
    its own margin and drops it while empty.
  */
  return (
    <div>
      <div
        ref={passwordStep}
        hidden={step !== 'password'}
        className={
          leftOnce
            ? 'animate-in fade-in-0 slide-in-from-left-2 duration-200 ease-out'
            : undefined
        }
      >
        <NewPasswordForm
          key={formKey}
          surface="panel"
          submitLabel="Changer le mot de passe"
          username={email}
          askCurrentPassword
          pending={change.isPending || reauthentication.isPending}
          error={
            step === 'password'
              ? (reauthentication.error?.message ?? changeMessage)
              : undefined
          }
          onSubmit={handlePasswords}
        />
      </div>

      {step === 'code' ? (
        /*
          The one transition on this screen worth designing: the fields the
          manager just filled slide out of the way for a single new one. It
          enters from the right, the direction of « next », and the password
          step comes back from the left. 200ms, the house `ease-out`; the exit
          is instant so the two never share the panel. Reduced motion collapses
          it in `motion.css`.
        */
        <form
          onSubmit={handleCode}
          className="animate-in fade-in-0 slide-in-from-right-2 space-y-4 duration-200 ease-out"
        >
          <div>
            <p className="text-sm font-semibold">
              Confirmez que c'est bien vous
            </p>
            <p className="mt-1 text-sm text-ink-soft">
              Votre connexion date de plus d'un jour. Pour changer le mot de
              passe, saisissez le code que nous venons d'envoyer
              {email ? (
                <>
                  {' à '}
                  <span className="font-medium wrap-break-word text-ink">
                    {email}
                  </span>
                </>
              ) : null}
              .
            </p>
          </div>

          <TextField
            label="Code reçu par e-mail"
            hint={
              <>
                Pensez à regarder dans les indésirables.{' '}
                {/*
                  The resend's confirmation lives in the hint so it takes no
                  room while empty — and it is always rendered, so the live
                  region exists before its text arrives.
                */}
                <span role="status" className="text-bottle-deep">
                  {reauthentication.isSuccess &&
                  reauthentication.variables === 'resend'
                    ? 'Un nouveau code vient de partir.'
                    : null}
                </span>
              </>
            }
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            required
            maxLength={10}
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />

          {changeMessage || reauthentication.error ? (
            <ErrorNote className="mt-0">
              {changeMessage ?? reauthentication.error?.message}
            </ErrorNote>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <SaveButton
              surface="panel"
              pending={change.isPending}
              disabled={reauthentication.isPending}
            >
              Changer le mot de passe
            </SaveButton>
            <ActionButton
              icon={RotateCw}
              variant="outline"
              disabled={change.isPending || reauthentication.isPending}
              onClick={() => requestCode('resend')}
            >
              {reauthentication.isPending ? 'Envoi…' : 'Renvoyer le code'}
            </ActionButton>
          </div>

          <ActionButton
            icon={ArrowLeft}
            variant="ghost"
            disabled={change.isPending}
            onClick={() => {
              change.reset()
              backToPasswords()
            }}
            className="-ml-3"
          >
            Modifier les mots de passe
          </ActionButton>
        </form>
      ) : null}

      {/*
        The outcome of the whole flow, under both steps. Always rendered, like
        the settings screen's: a `role="status"` inserted together with its
        message is often not announced.
      */}
      <p role="status" className="mt-4 text-sm empty:mt-0">
        {signOutOthers.isPending ? (
          <span className="text-ink-soft">
            Mot de passe changé. Déconnexion de vos autres appareils…
          </span>
        ) : signOutOthers.isSuccess ? (
          <span className="inline-flex items-start gap-1.5 text-bottle-deep">
            <Check className="mt-0.5 size-4 shrink-0" aria-hidden />
            Mot de passe changé. Vos autres appareils ont été déconnectés.
          </span>
        ) : null}
      </p>

      {signOutOthers.isError ? (
        <div className="mt-4 space-y-3">
          {/*
            Never the generic sentence here. The password did change, and a
            manager told « échec » would change it a second time — while the
            devices they wanted out stay in.
          */}
          <ErrorNote className="mt-0">
            Votre mot de passe a bien été changé, mais vos autres appareils
            n'ont pas pu être déconnectés.
          </ErrorNote>
          <ActionButton
            icon={LogOut}
            variant="outline"
            onClick={() => signOutOthers.mutate()}
          >
            Réessayer la déconnexion
          </ActionButton>
        </div>
      ) : null}
    </div>
  )
}
