import { Check } from 'lucide-react'
import { useState } from 'react'

import { ErrorNote } from '#/components/error-note'
import { MAX_NAME_LENGTH } from '#/features/auth/profile'
import { SaveButton } from '#/components/buttons/save-button'
import { TextField } from '#/components/form/text-field'
import { useUpdateName } from '#/features/auth/mutations'

import type { FormEvent } from 'react'
import type { ProfileName } from '#/features/auth/profile'

/**
 * The manager's first and last name.
 *
 * `saved` is what the account holds, read by the route from the session. The
 * fields start from it and the form is dirty whenever they differ from it —
 * once the save lands, `useUpdateName` invalidates the router, `saved` catches
 * up with the fields, and the button goes quiet on its own. No « saved » flag
 * is mirrored: the confirmation shows while the mutation is a success and
 * nothing has been typed since.
 *
 * Both fields may be left empty: a name is a courtesy, not a requirement, and
 * clearing it is a legitimate edit.
 */
export function ProfileForm({ saved }: { saved: ProfileName }) {
  const update = useUpdateName()

  const [firstName, setFirstName] = useState(saved.firstName)
  const [lastName, setLastName] = useState(saved.lastName)

  const isDirty =
    firstName.trim() !== saved.firstName || lastName.trim() !== saved.lastName

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    update.mutate({ firstName, lastName })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/*
        Side by side from `sm`: two short fields in the panel's width read as
        one name. Below it each takes the full row, so neither is cut short on
        a phone.
      */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          label="Prénom"
          autoComplete="given-name"
          maxLength={MAX_NAME_LENGTH}
          value={firstName}
          onChange={(event) => setFirstName(event.target.value)}
        />
        <TextField
          label="Nom"
          autoComplete="family-name"
          maxLength={MAX_NAME_LENGTH}
          value={lastName}
          onChange={(event) => setLastName(event.target.value)}
        />
      </div>

      {update.error ? (
        <ErrorNote className="mt-0">{update.error.message}</ErrorNote>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <SaveButton
          surface="panel"
          pending={update.isPending}
          disabled={!isDirty}
        />
        {/*
          Always rendered: a `role="status"` inserted together with its
          message is often not announced.
        */}
        <p role="status" className="text-sm">
          {update.isSuccess && !isDirty ? (
            <span className="inline-flex items-center gap-1.5 text-bottle-deep">
              <Check className="size-4 shrink-0" aria-hidden />
              Nom enregistré.
            </span>
          ) : null}
        </p>
      </div>
    </form>
  )
}
