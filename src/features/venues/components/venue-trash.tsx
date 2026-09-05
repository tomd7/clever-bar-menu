import { ArrowLeft, RotateCcw, Trash2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

import { ActionButton } from '#/components/buttons/action-button'
import { EmptyState } from '#/components/empty-state'
import { ErrorNote } from '#/components/error-note'
import { NavLink } from '#/components/nav-link'
import { useRestoreVenue } from '#/features/venues/mutations'
import { venuesQueryOptions } from '#/features/venues/api'

/**
 * La corbeille des établissements : un écran à part, `/admin/corbeille`.
 *
 * La suppression est logique — la ligne reste en base avec sa carte, ses
 * photos et son slug — et cet écran est ce qui rend ce choix visible : sans
 * lui, le gérant n'aurait aucune raison de croire que « supprimer » est
 * réversible, et l'archivage ne serait qu'une suppression déguisée.
 *
 * Il a sa propre adresse plutôt qu'une section en bas de la liste, où il
 * occupait autant de page que les établissements en service alors que c'est
 * l'inverse qui décrit le travail du gérant. Une page se laisse aussi mettre
 * en favori, ouvrir dans un onglet et atteindre depuis la colonne — ce qu'un
 * repli, lui, oblige à retrouver puis à déplier à chaque visite.
 *
 * L'écran fait sa propre requête, comme `VenueQr` : le fichier de route ne
 * porte que du routage. C'est la même `venuesQueryOptions` que la liste — une
 * seule requête ramène actifs et archivés, donc restaurer ici rafraîchit aussi
 * la liste et la colonne, sans second cache à invalider.
 */
export function VenueTrash({ ownerId }: { ownerId: string }) {
  const venuesQuery = useQuery(venuesQueryOptions(ownerId))
  const restore = useRestoreVenue()

  /*
    `Boolean(...)` plutôt qu'une comparaison à `null` : tant que la migration
    `0005` n'est pas passée, `select('*')` renvoie des lignes sans la colonne,
    et `undefined !== null` précipiterait ici tous les établissements du
    gérant — y compris ceux qui sont en service.
  */
  const archived = (venuesQuery.data ?? []).filter((venue) =>
    Boolean(venue.deleted_at),
  )

  return (
    <div className="page-wrap px-0">
      {/*
        Masqué à partir de `lg` : la colonne du back-office y porte le retour.
        En dessous, elle n'existe pas et ce lien est la seule sortie.
      */}
      <NavLink to="/admin" icon={ArrowLeft} className="lg:hidden">
        Établissements
      </NavLink>

      <header className="mt-2 lg:mt-0">
        <p className="island-kicker">Corbeille</p>
        <h1 className="display-title mt-1 text-2xl leading-tight sm:text-3xl">
          Établissements supprimés
        </h1>
        <p className="mt-2 max-w-prose text-sm text-ink-soft">
          Leur carte publique ne répond plus, mais rien n'est perdu : restaurer
          un établissement le remet en service tel qu'il était, avec ses
          catégories, ses produits et son adresse.
        </p>
      </header>

      <section className="mt-6">
        {venuesQuery.isPending ? (
          <p className="text-sm text-ink-soft">Chargement…</p>
        ) : venuesQuery.isError ? (
          <ErrorNote>{venuesQuery.error.message}</ErrorNote>
        ) : archived.length === 0 ? (
          <EmptyState icon={Trash2} title="La corbeille est vide">
            Les établissements que vous supprimez atterrissent ici. Vous pourrez
            les remettre en service à tout moment.
          </EmptyState>
        ) : (
          <ul className="panel divide-y divide-line rounded-2xl">
            {archived.map((venue) => (
              <li
                key={venue.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink-soft">{venue.name}</p>
                  {/*
                    Un `<code>` inerte et non `MenuAddress` : la carte d'un
                    établissement archivé répond 404, un lien y mènerait à un
                    mur. L'adresse reste affichée parce qu'elle reste réservée.
                  */}
                  <p className="mt-0.5 text-xs text-ink-soft">
                    <code>/m/{venue.slug}</code>
                  </p>
                </div>

                {/*
                  Aucun lien vers la carte : composer le menu d'un établissement
                  hors service n'a pas de sens. Il faut d'abord le restaurer.
                */}
                <ActionButton
                  icon={RotateCcw}
                  variant="outline"
                  disabled={restore.isPending}
                  onClick={() => restore.mutate(venue.id)}
                >
                  Restaurer
                </ActionButton>
              </li>
            ))}
          </ul>
        )}

        {restore.error ? <ErrorNote>{restore.error.message}</ErrorNote> : null}
      </section>
    </div>
  )
}
