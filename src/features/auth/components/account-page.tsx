import { ArrowLeft } from 'lucide-react'

import { ChangeEmailForm } from '#/features/auth/components/change-email-form'
import { ChangePasswordForm } from '#/features/auth/components/change-password-form'
import { NavLink } from '#/components/nav-link'
import { ProfileForm } from '#/features/auth/components/profile-form'
import { fullName, profileName } from '#/features/auth/profile'

import type { ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'

/**
 * The manager's own account, `/admin/compte`: their name, the address they
 * sign in with, and their password.
 *
 * No skeleton: it reads nothing. The user comes from the route context the
 * guard already filled, and the two mutations that change it invalidate the
 * router so that context is re-read — see `useUpdateName`.
 */
export function AccountPage({ user }: { user: User }) {
  const name = profileName(user)
  const displayName = fullName(name)

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
          {displayName ?? 'Votre compte'}
        </h1>
        {user.email ? (
          <p className="mt-1 text-sm wrap-break-word text-ink-soft">
            {user.email}
          </p>
        ) : null}
      </header>

      <div className="mt-6 space-y-8 lg:space-y-10">
        <AccountSection
          title="Identité"
          description="Votre nom apparaît dans le back-office. Vos clients ne le voient pas."
        >
          <ProfileForm saved={name} />
        </AccountSection>

        <AccountSection
          title="Adresse e-mail"
          description="C'est l'adresse avec laquelle vous vous connectez. Elle ne change qu'une fois confirmée depuis l'ancienne et depuis la nouvelle — un appareil resté connecté ne suffit pas à la détourner."
        >
          <ChangeEmailForm email={user.email} pendingEmail={user.new_email} />
        </AccountSection>

        <AccountSection
          title="Mot de passe"
          description="Votre mot de passe actuel vous sera demandé. Une fois le nouveau enregistré, vos autres appareils sont déconnectés — une tablette restée ouverte derrière le bar, par exemple. Celui-ci reste connecté."
        >
          <ChangePasswordForm email={user.email} />
        </AccountSection>
      </div>
    </div>
  )
}

/**
 * One setting of the account. One column on the phone: what the section
 * does, then the form. From `lg`, the explanation takes a narrow left column
 * and the form a readable one beside it — fields stretched across a 1080px
 * page would be a form nobody reads to the end of. The same grid for every
 * section, so their forms line up down the page.
 */
function AccountSection({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <section className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,17rem)_minmax(0,28rem)] lg:gap-10">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="mt-1 max-w-prose text-sm text-ink-soft">{description}</p>
      </div>

      <div className="panel rounded-2xl p-4 sm:p-6">{children}</div>
    </section>
  )
}
