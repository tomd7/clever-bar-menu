import { useMutation } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'

import {
  requestPasswordReset,
  signIn,
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
 * No router invalidation, unlike the two hooks around it: nothing about the
 * session changed. The screen reads `isSuccess` to swap the form for its
 * confirmation, which is why no `useState` mirrors that here either.
 */
export function useRequestPasswordReset() {
  return useMutation({ mutationFn: requestPasswordReset })
}

/**
 * Sets the new password, then invalidates the router.
 *
 * Same reason as `useSignIn`: the manager arrives from a mail, so the guards
 * have already concluded « not signed in » — for `/login`, which sent them
 * here, and for `/admin`, where they are about to land. Without this, the
 * navigation that follows would bounce straight back to the sign-in screen.
 */
export function useUpdatePassword() {
  const router = useRouter()

  return useMutation({
    mutationFn: updatePassword,
    onSuccess: () => router.invalidate(),
  })
}
