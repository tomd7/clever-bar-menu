import type { ReactNode } from 'react'

/**
 * The frame the auth screens share: sign in, ask for a link, set a password.
 *
 * Extracted the day the second one appeared. These three screens are the only
 * place in the application where a lone card sits on the empty page ground,
 * and a manager meets them minutes apart, in sequence — a card that shifted or
 * a title that changed weight between two steps would read as a different
 * site. Keeping the shell in one file is what makes that continuity a fact
 * rather than a habit.
 *
 * The body is a slot rather than a set of props: the three screens agree on
 * the frame and on nothing else. One holds a form, one swaps its form for a
 * confirmation, one may hold no form at all.
 *
 * `title` is a node and `kicker` a string, which is not an oversight: while a
 * recovery link is being checked, the section is already known (« Espace
 * gérant ») and the title is not — the screen is about to be « Nouveau mot de
 * passe » or « Lien invalide ». Its loading bar therefore stands in the real
 * `h1`, and takes its `1lh` height from it.
 */
export function AuthIsland({
  kicker,
  title,
  children,
}: {
  kicker: string
  title: ReactNode
  children: ReactNode
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="rise-in w-full max-w-sm">
        <div className="island-shell rounded-2xl p-6 sm:p-8">
          <p className="island-kicker">{kicker}</p>
          <h1 className="display-title mt-2 text-2xl leading-tight sm:text-3xl">
            {title}
          </h1>
          {children}
        </div>
      </div>
    </main>
  )
}
