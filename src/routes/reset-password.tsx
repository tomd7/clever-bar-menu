import { createFileRoute, useRouter } from '@tanstack/react-router'

import { DEFAULT_REDIRECT } from '#/features/auth/redirect'
import {
  ResetPasswordScreen,
  ResetPasswordSkeleton,
} from '#/features/auth/components/reset-password-screen'
import { recoveryLinkError } from '#/features/auth/recovery-link'
import { supabase } from '#/lib/supabase'

export const Route = createFileRoute('/reset-password')({
  /**
   * La session Supabase vit dans le navigateur : la vérifier pendant le rendu
   * serveur conclurait systématiquement « non connecté ».
   */
  ssr: false,
  /**
   * **No guard here, deliberately.** The recovery link opens a session before
   * this route is reached, so a `beforeLoad` bouncing authenticated visitors to
   * `/admin` — the one `/login` carries — would make this screen unreachable
   * for exactly the people it exists for.
   *
   * `getSession()` awaits the client's initialisation, which is what consumes
   * the tokens the link leaves in the URL. Past that await, a missing session
   * means the link did not work, and the failure is still readable in the hash:
   * Supabase only clears it on success.
   */
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession()

    return {
      linkError: data.session
        ? undefined
        : recoveryLinkError(window.location.hash),
    }
  },
  component: ResetPasswordRoute,
  /*
    `beforeLoad` above is the only wait in the application that can be a network
    round trip, so it is the only one that needs this: the router holds the
    previous screen for `pendingMs` (1s) before showing the ossature, and the
    ossature fades in over its own 140ms — a fast check still shows nothing.
  */
  pendingComponent: ResetPasswordSkeleton,
})

function ResetPasswordRoute() {
  const router = useRouter()
  const { linkError } = Route.useRouteContext()

  /* `useUpdatePassword` a déjà invalidé le routeur : il ne reste que la destination. */
  return (
    <ResetPasswordScreen
      linkError={linkError}
      onUpdated={() => router.navigate({ href: DEFAULT_REDIRECT })}
    />
  )
}
