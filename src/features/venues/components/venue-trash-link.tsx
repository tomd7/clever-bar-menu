import { Link } from '@tanstack/react-router'
import { Trash2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

import { NavLink } from '#/components/nav-link'
import { venuesQueryOptions } from '#/features/venues/api'

/**
 * Le nombre d'établissements à la corbeille.
 *
 * `select` sur `venuesQueryOptions` plutôt qu'une requête à part : c'est le
 * même cache que la liste et que la colonne — une seule ligne sur le réseau —
 * et le composant ne se redessine que si le nombre change, pas à chaque fois
 * qu'un nom d'établissement est modifié.
 */
function useArchivedCount(ownerId: string): number {
  const { data } = useQuery({
    ...venuesQueryOptions(ownerId),
    select: (venues) =>
      venues.filter((venue) => Boolean(venue.deleted_at)).length,
  })

  return data ?? 0
}

/**
 * L'accès à la corbeille depuis la page des établissements, dans l'en-tête.
 *
 * Il n'existe qu'une fois la corbeille non vide : rien ne sert d'annoncer un
 * écran vide, et la première suppression fait apparaître le lien — le moment
 * exact où le gérant a besoin d'apprendre que la corbeille existe. Le nombre
 * est là pour qu'il sache s'il vaut la peine d'y aller.
 */
export function VenueTrashLink({ ownerId }: { ownerId: string }) {
  const count = useArchivedCount(ownerId)

  if (count === 0) return null

  return (
    <NavLink to="/admin/corbeille" icon={Trash2}>
      Corbeille ({count})
    </NavLink>
  )
}

/**
 * Le même accès dans la colonne du back-office, en bas.
 *
 * Il porte son propre filet parce qu'il est le seul élément de cette zone :
 * dessiné par la coquille, le trait resterait quand le lien disparaît, et il
 * séparerait la déconnexion de rien.
 *
 * Sans le nombre, contrairement au lien de l'en-tête : les autres éléments de
 * la colonne — Carte, Stock, QR code — n'en portent pas, et un chiffre isolé
 * dans une liste de destinations se lit comme une alerte alors qu'il n'y a
 * rien à traiter.
 */
export function VenueTrashRailLink({ ownerId }: { ownerId: string }) {
  const count = useArchivedCount(ownerId)

  if (count === 0) return null

  return (
    <div className="border-t border-line pt-3">
      <Link
        to="/admin/corbeille"
        activeProps={{ className: 'is-active' }}
        className="rail-link"
      >
        <Trash2 className="size-4 shrink-0" />
        Corbeille
      </Link>
    </div>
  )
}
