import { useMutation } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'

import {
  requestPasswordReset,
  requestReauthentication,
  signIn,
  signOutOtherDevices,
  updatePassword,
} from '#/features/auth/api'

/**
 * Connexion, suivie de l'invalidation du routeur.
 *
 * C'est l'équivalent, pour l'authentification, de l'invalidation de requête que
 * portent les mutations de la carte : les gardes de route ont déjà évalué la
 * session, et sans cette invalidation `beforeLoad` conserverait son verdict
 * « non connecté » et renverrait l'utilisateur aussitôt sur /login.
 *
 * Elle est ici plutôt que dans la route parce qu'elle est indissociable de la
 * connexion elle-même — l'oublier ne casse rien de visible tout de suite, et
 * beaucoup une fois en production.
 */
export function useSignIn() {
  const router = useRouter()

  return useMutation({
    mutationFn: signIn,
    onSuccess: () => router.invalidate(),
  })
}

/**
 * Requests the recovery mail.
 *
 * No router invalidation, unlike `useSignIn` and `useResetPassword`: nothing
 * about the session changed. The screen reads `isSuccess` to swap the form for
 * its confirmation, which is why no `useState` mirrors that here either.
 */
export function useRequestPasswordReset() {
  return useMutation({ mutationFn: requestPasswordReset })
}

/**
 * Sets the password chosen from a recovery link, then invalidates the router.
 *
 * Same reason as `useSignIn`: the manager arrives from a mail, so the guards
 * have already concluded « not signed in » — for `/login`, which sent them
 * here, and for `/admin`, where they are about to land. Without this, the
 * navigation that follows would bounce straight back to the sign-in screen.
 *
 * **Recovery only.** The signed-in change goes through `useChangePassword`,
 * which is the same call without the invalidation — split rather than shared,
 * on purpose. On the account screen no guard's verdict changes, so the re-run
 * would be harmless but meaningless, and a hook that invalidates « just in
 * case » is how the reason for the other one gets forgotten.
 */
export function useResetPassword() {
  const router = useRouter()

  return useMutation({
    mutationFn: updatePassword,
    onSuccess: () => router.invalidate(),
  })
}

/**
 * Changes the signed-in manager's password, from the account screen.
 *
 * No router invalidation — see `useResetPassword` for why the two are split.
 * Signing the other devices out is a separate hook, `useSignOutOtherDevices`,
 * because the two calls can fail apart: when this one succeeds and the
 * sign-out does not, the password *has* changed, and the screen must say so
 * instead of inviting a second change.
 */
export function useChangePassword() {
  return useMutation({ mutationFn: updatePassword })
}

/**
 * Mails the code that `useChangePassword` needs on a session older than a day.
 *
 * The variable says whether this is the first send or a resend. It reaches
 * the API not at all — it is there so the screen can read, from React Query
 * rather than a mirrored `useState`, whether to announce « nouveau code
 * envoyé ».
 */
export function useRequestReauthentication() {
  return useMutation({
    mutationFn: (_reason: 'first' | 'resend') => requestReauthentication(),
  })
}

/**
 * Signs out every other session of the account, keeping this one.
 *
 * No router invalidation: `scope: 'others'` leaves the current session alone
 * and fires no `SIGNED_OUT` here.
 */
export function useSignOutOtherDevices() {
  return useMutation({ mutationFn: signOutOtherDevices })
}
