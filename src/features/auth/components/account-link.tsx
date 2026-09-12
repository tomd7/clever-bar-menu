import { UserRound } from 'lucide-react'

import { NavLink } from '#/components/nav-link'

/**
 * The way into `/admin/compte`, placed in `BackOfficeShell`'s `account` slot.
 *
 * **Reachable at every width**, which is the whole point of it: the column
 * only exists from `lg`, and the phone's top bar held nothing but
 * « Déconnexion ». Icon only on the phone, where the bar has the room of two
 * targets; labelled from `sm`. The label stays in the accessibility tree at
 * every width, so the link is never an unnamed icon.
 *
 * A link, not a button — it goes somewhere. `min-w-11` is the width half of
 * the 44px target when the label is out of the flow; `.nav-link` already
 * gives the height.
 */
export function AccountLink() {
  return (
    <NavLink
      to="/admin/compte"
      icon={UserRound}
      activeProps={{ className: 'font-semibold' }}
      className="min-w-11 justify-center lg:justify-start lg:px-3"
    >
      <span className="sr-only sm:not-sr-only">Compte</span>
    </NavLink>
  )
}
