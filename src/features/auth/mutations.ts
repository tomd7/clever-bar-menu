import { useMutation } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'

import { signIn } from '#/features/auth/api'

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
