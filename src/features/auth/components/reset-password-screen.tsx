import { ArrowLeft } from 'lucide-react'
import { Link } from '@tanstack/react-router'

import { ActionButton } from '#/components/buttons/action-button'
import { AuthIsland } from '#/features/auth/components/auth-island'
import { ErrorNote } from '#/components/error-note'
import { NavLink } from '#/components/nav-link'
import { ResetPasswordForm } from '#/features/auth/components/reset-password-form'
import { Skeleton, SkeletonLine, SkeletonScreen } from '#/components/skeleton'

/**
 * Écran de choix d'un nouveau mot de passe, atteint depuis le lien reçu par
 * mail.
 *
 * `linkError` decides which of the two screens this is. A recovery link is
 * single-use and expires, so arriving on a dead one is an ordinary outcome —
 * not an edge case — and it gets a screen of its own with the way out on it,
 * never a blank card.
 */
export function ResetPasswordScreen({
  linkError,
  onUpdated,
}: {
  linkError?: string
  onUpdated: () => void
}) {
  if (linkError) {
    return (
      <AuthIsland kicker="Espace gérant" title="Lien invalide">
        <ErrorNote className="mt-4">{linkError}</ErrorNote>

        <p className="mt-3 text-sm text-ink-soft">
          Un lien de réinitialisation ne sert qu'une fois, et il expire. En
          demander un nouveau prend quelques secondes.
        </p>

        {/*
          The one action on a dead-end screen, so it is drawn as the primary
          call to action even though it navigates — the `asChild` case
          `src/components/CLAUDE.md` allows, not a licence to draw links as
          buttons elsewhere.
        */}
        <ActionButton asChild surface="page" className="mt-5 w-full">
          <Link to="/forgot-password">Demander un nouveau lien</Link>
        </ActionButton>

        <p className="mt-3 border-t border-line pt-2 text-center">
          <NavLink to="/login" icon={ArrowLeft}>
            Retour à la connexion
          </NavLink>
        </p>
      </AuthIsland>
    )
  }

  return (
    <AuthIsland kicker="Espace gérant" title="Nouveau mot de passe">
      <p className="mt-2 text-sm text-ink-soft">
        Choisissez un mot de passe : il remplacera l'ancien dès son
        enregistrement.
      </p>

      <ResetPasswordForm onUpdated={onUpdated} />
    </AuthIsland>
  )
}

/**
 * L'attente pendant la vérification du lien.
 *
 * The only screen in the application whose wait can be a network round trip
 * rather than a `localStorage` read: opening the recovery link makes Supabase
 * fetch the user behind the token before a session exists. Left blank, that
 * moment reads as the very thing this screen was built to repair — a link that
 * leads nowhere — and it happens on a phone, on the mobile network, standing
 * behind a bar.
 *
 * The form is what it draws, because that is what the manager is here for. The
 * title alone stays a bar: it is the one line that depends on the answer.
 */
export function ResetPasswordSkeleton() {
  return (
    <SkeletonScreen label="Vérification du lien…">
      <AuthIsland
        kicker="Espace gérant"
        title={
          <Skeleton className="h-[1lh] w-56 max-w-full rounded-full text-2xl leading-tight sm:text-3xl" />
        }
      >
        <SkeletonLine className="mt-2 w-full" delay={60} />
        <SkeletonLine className="mt-1 w-2/3" delay={90} />

        <div className="mt-6 space-y-4">
          {/* Label, saisie, and the hint that sits under the first field. */}
          <div className="space-y-2">
            <SkeletonLine className="w-44" delay={120} />
            <Skeleton className="h-11 w-full lg:h-10" delay={140} />
            <SkeletonLine className="mt-2 w-32 text-xs" delay={160} />
          </div>

          <div className="space-y-2">
            <SkeletonLine className="w-48" delay={180} />
            <Skeleton className="h-11 w-full lg:h-10" delay={200} />
          </div>

          <Skeleton className="h-11 w-full lg:h-10" delay={220} />
        </div>
      </AuthIsland>
    </SkeletonScreen>
  )
}
