import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'

import { LoginScreen } from '#/features/auth/components/login-screen'
import { DEFAULT_REDIRECT, sanitizeRedirect } from '#/features/auth/redirect'
import { supabase } from '#/lib/supabase'

export const Route = createFileRoute('/login')({
  /**
   * La session Supabase vit dans le navigateur : la vérifier pendant le rendu
   * serveur conclurait systématiquement « non connecté ».
   */
  ssr: false,
  /**
   * `redirect` est omise quand elle est absente, et non ramenée à sa valeur
   * par défaut : une clé toujours présente pousserait le routeur à réécrire
   * `/login` en `/login?redirect=%2Fadmin` à chaque visite directe.
   */
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => {
    const target = sanitizeRedirect(search.redirect)
    return target ? { redirect: target } : {}
  },
  beforeLoad: async ({ search }) => {
    const { data } = await supabase.auth.getSession()
    if (data.session) {
      throw redirect({ href: search.redirect ?? DEFAULT_REDIRECT })
    }
  },
  component: LoginRoute,
})

function LoginRoute() {
  const router = useRouter()
  const search = Route.useSearch()

  /* `useSignIn` a déjà invalidé le routeur : il ne reste que la destination. */
  return (
    <LoginScreen
      onSignedIn={() =>
        router.navigate({ href: search.redirect ?? DEFAULT_REDIRECT })
      }
    />
  )
}
