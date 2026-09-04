import { Link } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'

import type { Venue } from '#/lib/supabase'

/**
 * Carte d'un établissement dans la liste du back-office.
 *
 * `position` ne sert qu'à décaler l'animation d'entrée : court entre les
 * cartes, l'entrée se lit comme une cascade plutôt que comme un bloc. Au-delà
 * de quelques dizaines de millisecondes, l'interface paraîtrait simplement
 * lente — d'où le plafond au neuvième élément.
 */
export function VenueCard({
  venue,
  position,
}: {
  venue: Venue
  position: number
}) {
  return (
    <li
      className="rise-in"
      style={{ animationDelay: `${Math.min(position, 8) * 45}ms` }}
    >
      <Link
        to="/admin/$venueSlug"
        params={{ venueSlug: venue.slug }}
        className="feature-card flex min-h-24 flex-col rounded-2xl border border-line p-4 no-underline"
      >
        <p className="display-title text-lg leading-tight text-ink">
          {venue.name}
        </p>
        <p className="mt-1 text-xs text-ink-soft">
          <code>/m/{venue.slug}</code>
        </p>
        <p className="mt-3 flex items-center gap-1 text-xs font-semibold text-brass-deep">
          Composer la carte
          <ChevronRight className="size-3" />
        </p>
      </Link>
    </li>
  )
}
