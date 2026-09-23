import { ArrowLeft } from 'lucide-react'

import { ChangePasswordForm } from '#/features/auth/components/change-password-form'
import { NavLink } from '#/components/nav-link'

/**
 * The manager's own account, `/admin/compte`.
 *
 * Named for the account and holding only the password for now: the screen is
 * where the next account setting will go, but it shows no field that does not
 * exist yet.
 *
 * No skeleton: it reads nothing. The address comes from the route context the
 * guard already filled.
 */
export function AccountPage({ email }: { email: string | undefined }) {
  return (
    <div className="page-wrap px-0">
      {/*
        Hidden from `lg`, where the back office's column is the way out. Below
        it the column does not exist, and this link is the only one.
      */}
      <NavLink to="/admin" icon={ArrowLeft} className="lg:hidden">
        Établissements
      </NavLink>

      <header className="mt-2 lg:mt-0">
        <p className="island-kicker">Compte</p>
        <h1 className="display-title mt-1 text-2xl leading-tight sm:text-3xl">
          Votre compte
        </h1>
        {email ? (
          <p className="mt-1 text-sm wrap-break-word text-ink-soft">{email}</p>
        ) : null}
      </header>

      {/*
        One column on the phone: what the section does, then the form. From
        `lg`, the explanation takes a narrow left column and the form a
        readable one beside it — three password fields stretched across a
        1080px page would be a form nobody reads to the end of.
      */}
      <section className="mt-6 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,17rem)_minmax(0,28rem)] lg:gap-10">
        <div>
          <h2 className="text-sm font-semibold">Mot de passe</h2>
          <p className="mt-1 max-w-prose text-sm text-ink-soft">
            Votre mot de passe actuel vous sera demandé. Une fois le nouveau
            enregistré, vos autres appareils sont déconnectés — une tablette
            restée ouverte derrière le bar, par exemple. Celui-ci reste
            connecté.
          </p>
        </div>

        <div className="panel rounded-2xl p-4 sm:p-6">
          <ChangePasswordForm email={email} />
        </div>
      </section>
    </div>
  )
}
