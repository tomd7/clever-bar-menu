import { Link } from '@tanstack/react-router'
import { UserRound } from 'lucide-react'

/**
 * The way into `/admin/compte`, placed in `BackOfficeShell`'s `account` slot.
 *
 * **Reachable at every width**, which is the whole point of it: the column
 * only exists from `lg`, and the phone's top bar held nothing but
 * « Déconnexion ». Icon only on the phone, where the bar has the room of two
 * targets; labelled from `sm`. The label stays in the accessibility tree at
 * every width, so the link is never an unnamed icon.
 *
 * **A `.rail-link`, not a `NavLink`**, like every other item of the column
 * (`VenueNav`, `VenueTrashRailLink`): the same padding, the same hover wash,
 * and on its own page the same raised fill and left bar. As a `NavLink` it
 * was the one item marking the current page with a heavier weight and an
 * underline. `min-w-11` is the width half of the 44px target while the label
 * is out of the flow; `.rail-link` already gives the height.
 */
export function AccountLink() {
  return (
    <Link
      to="/admin/compte"
      activeProps={{ className: 'is-active' }}
      className="rail-link min-w-11 justify-center lg:justify-start"
    >
      <UserRound className="size-4 shrink-0" />
      <span className="sr-only sm:not-sr-only">Compte</span>
    </Link>
  )
}
