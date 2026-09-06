import { Link } from '@tanstack/react-router'
import {
  Boxes,
  ConciergeBell,
  QrCode,
  Store,
  UtensilsCrossed,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

import { venuesQueryOptions } from '#/features/venues/api'

import type { ReactNode } from 'react'

/**
 * Navigation de la colonne du back-office.
 *
 * Elle remplace un lien unique vers `/admin` qui ne faisait que redoubler le
 * lien de retour déjà présent en haut de chaque écran : une colonne de 256px
 * pour une destination que le contenu donnait déjà. Ce qu'un gérant fait
 * réellement, c'est passer d'un établissement à l'autre et, dans l'un d'eux,
 * de la carte au stock ou au QR code — des mouvements qui n'existaient nulle part
 * ailleurs que par un aller-retour vers la liste.
 *
 * L'arbre ne répète jamais une destination : l'établissement ouvert devient un
 * intitulé de groupe, et ce sont ses sections qui portent les liens. Les
 * autres établissements restent de simples liens.
 *
 * La corbeille n'est pas ici : elle relève de l'outil et non du travail, et
 * `VenueTrashRailLink` la pose dans la zone basse de la colonne, au-dessus de
 * la déconnexion.
 *
 * `ordersBadge` is a slot, not a number: counting open orders belongs to
 * `features/orders`, which this feature may not import. The route assembles
 * the two — the same wiring as `productAction` on the customer menu. The slot
 * is only read under the open venue, the one that unfolds its sections: a pill
 * per venue in the list would mean as many queues polled at once.
 *
 * `activeVenueSlug` est passé par la route plutôt que lu ici : savoir où l'on
 * se trouve est une question de routage, et ce composant reste ainsi une
 * fonction de ses props.
 */
export function VenueNav({
  ownerId,
  activeVenueSlug,
  ordersBadge,
}: {
  ownerId: string
  activeVenueSlug: string | undefined
  ordersBadge?: ReactNode
}) {
  const venuesQuery = useQuery(venuesQueryOptions(ownerId))

  /*
    Les archivés sont écartés — sauf celui qu'on est en train de consulter.
    Son écran reste atteignable par son URL, et le faire disparaître de la
    colonne pendant qu'on le regarde donnerait une colonne qui contredit la
    page.
  */
  const venues = (venuesQuery.data ?? []).filter(
    (venue) => !venue.deleted_at || venue.slug === activeVenueSlug,
  )

  return (
    <nav aria-label="Back-office">
      <Link
        to="/admin"
        /*
          `exact` : sans lui, le routeur marquerait ce lien actif depuis
          `/admin/le-comptoir`, et la liste des établissements resterait
          désignée comme la page courante pendant qu'on édite une carte.
        */
        activeOptions={{ exact: true }}
        activeProps={{ className: 'is-active' }}
        className="rail-link"
      >
        <Store className="size-4 shrink-0" />
        Établissements
      </Link>

      {venuesQuery.isError ? (
        <p className="mt-1 px-2.5 text-xs text-ink-soft">Liste indisponible.</p>
      ) : null}

      <ul className="mt-1 space-y-0.5">
        {venues.map((venue) =>
          venue.slug === activeVenueSlug ? (
            <li key={venue.id}>
              {/*
                L'établissement ouvert n'est pas un lien : on y est déjà, et sa
                destination par défaut est « Carte », juste en dessous.
              */}
              <p className="flex min-h-11 items-center px-2.5 text-sm font-semibold">
                {venue.name}
              </p>

              <ul className="space-y-0.5 pl-3">
                <li>
                  <Link
                    to="/admin/$venueSlug"
                    params={{ venueSlug: venue.slug }}
                    activeOptions={{ exact: true }}
                    activeProps={{ className: 'is-active' }}
                    className="rail-link"
                  >
                    <UtensilsCrossed className="size-4 shrink-0" />
                    Carte
                  </Link>
                </li>
                <li>
                  <Link
                    to="/admin/$venueSlug/commandes"
                    params={{ venueSlug: venue.slug }}
                    activeProps={{ className: 'is-active' }}
                    className="rail-link"
                  >
                    <ConciergeBell className="size-4 shrink-0" />
                    Commandes
                    {ordersBadge}
                  </Link>
                </li>
                <li>
                  <Link
                    to="/admin/$venueSlug/stock"
                    params={{ venueSlug: venue.slug }}
                    activeProps={{ className: 'is-active' }}
                    className="rail-link"
                  >
                    <Boxes className="size-4 shrink-0" />
                    Stock
                  </Link>
                </li>
                <li>
                  <Link
                    to="/admin/$venueSlug/qr"
                    params={{ venueSlug: venue.slug }}
                    activeProps={{ className: 'is-active' }}
                    className="rail-link"
                  >
                    <QrCode className="size-4 shrink-0" />
                    QR code
                  </Link>
                </li>
              </ul>
            </li>
          ) : (
            <li key={venue.id}>
              <Link
                to="/admin/$venueSlug"
                params={{ venueSlug: venue.slug }}
                className="rail-link"
              >
                <span className="truncate">{venue.name}</span>
              </Link>
            </li>
          ),
        )}
      </ul>
    </nav>
  )
}
