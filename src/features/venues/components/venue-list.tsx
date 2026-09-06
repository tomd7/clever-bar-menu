import { Store } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

import { EmptyState } from '#/components/empty-state'
import { ErrorNote } from '#/components/error-note'
import {
  Skeleton,
  SkeletonAddress,
  SkeletonScreen,
} from '#/components/skeleton'
import { VenueCard } from '#/features/venues/components/venue-card'
import { venuesQueryOptions } from '#/features/venues/api'

/** Liste des établissements du gérant, avec ses états de chargement et de vide. */
export function VenueList({ ownerId }: { ownerId: string }) {
  const venuesQuery = useQuery(venuesQueryOptions(ownerId))

  if (venuesQuery.isPending) {
    return <VenueListSkeleton />
  }

  if (venuesQuery.isError) {
    return <ErrorNote>{venuesQuery.error.message}</ErrorNote>
  }

  /*
    Une seule requête ramène les deux listes : la policy `venues_owner_read`
    laisse un gérant voir ses archivés, que le tri sépare ici plutôt que par un
    second aller-retour. Cet écran n'affiche que les actifs — les archivés ont
    leur page, `/admin/corbeille`, annoncée depuis l'en-tête. Il lui reste à
    savoir s'il y en a, pour distinguer « rien n'a jamais été créé » de « tout
    est à la corbeille » : deux vides qui n'appellent pas la même phrase.

    `Boolean(...)` plutôt qu'une comparaison à `null` : tant que la migration
    `0005` n'est pas passée, `select('*')` renvoie des lignes sans la colonne,
    et `undefined !== null` aurait précipité tous les établissements dans la
    corbeille — un écran vide, sans erreur pour l'expliquer.
  */
  const active = venuesQuery.data.filter((venue) => !venue.deleted_at)
  const archivedCount = venuesQuery.data.filter((venue) =>
    Boolean(venue.deleted_at),
  ).length

  if (active.length === 0 && archivedCount === 0) {
    return (
      <EmptyState icon={Store} title="Aucun établissement pour l'instant">
        Créez le premier ci-dessus : vous pourrez ensuite y composer vos
        catégories et vos produits.
      </EmptyState>
    )
  }

  return (
    <>
      {active.length === 0 ? (
        <EmptyState icon={Store} title="Aucun établissement actif">
          Créez-en un ci-dessus, ou restaurez-en un depuis la corbeille.
        </EmptyState>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {active.map((venue, position) => (
            <VenueCard key={venue.id} venue={venue} position={position} />
          ))}
        </ul>
      )}
    </>
  )
}

/**
 * L'attente de la liste, dessinée à la forme de la grille qui arrive.
 *
 * Trois cartes, et non une par établissement connu : le nombre est justement ce
 * que la requête n'a pas encore dit. Trois remplit une rangée sur les trois
 * points d'arrêt de la grille sans jamais promettre une deuxième rangée qui
 * pourrait ne pas venir — une ossature qui annonce plus que la réalité fait
 * rétrécir la page au moment où elle se remplit, soit exactement le saut
 * qu'elle est là pour éviter.
 *
 * Les cartes gardent le `min-h-24`, le rayon et le filet des vraies : la grille
 * ne bouge pas d'un pixel quand les données arrivent.
 */
function VenueListSkeleton() {
  return (
    <SkeletonScreen
      label="Chargement des établissements…"
      className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
    >
      {[0, 1, 2].map((position) => (
        <div
          key={position}
          className="flex min-h-24 flex-col rounded-2xl border border-line p-4"
        >
          {/* Le nom, à la ligne du `text-lg` de `.display-title`. */}
          <Skeleton
            className="h-[1lh] w-40 max-w-full text-lg leading-tight"
            delay={position * 70}
          />
          {/* L'adresse publique et son bouton de copie, qui font la hauteur. */}
          <SkeletonAddress delay={position * 70 + 45} />
          {/* « Composer la carte », au même écart que dans la vraie carte. */}
          <Skeleton
            className="mt-3 h-[1lh] w-28 rounded-full text-xs"
            delay={position * 70 + 95}
          />
        </div>
      ))}
    </SkeletonScreen>
  )
}
