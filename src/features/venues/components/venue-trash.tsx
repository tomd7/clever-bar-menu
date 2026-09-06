import { ArrowLeft, RotateCcw, Trash2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

import { ActionButton } from '#/components/buttons/action-button'
import { DeleteButton } from '#/components/buttons/delete-button'
import { EmptyState } from '#/components/empty-state'
import { ErrorNote } from '#/components/error-note'
import { NavLink } from '#/components/nav-link'
import { Skeleton, SkeletonScreen } from '#/components/skeleton'
import {
  usePurgeVenueTrash,
  useRestoreVenue,
} from '#/features/venues/mutations'
import { venuesQueryOptions } from '#/features/venues/api'

/**
 * « 1 établissement », « 3 établissements » — la question de confirmation dit
 * ce qu'elle détruit, et le nombre est ce qui distingue une purge d'un
 * dérapage : le gérant qui en attendait un seul doit pouvoir le voir avant de
 * confirmer.
 */
function describeCount(count: number): string {
  return `${count} établissement${count > 1 ? 's' : ''}`
}

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
  const purge = usePurgeVenueTrash()

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

      {/*
        Une grille à partir de `lg` seulement, et le flux ordinaire en dessous.

        Sur large, le vidage se pose au bout de la ligne du titre — c'est là
        qu'on cherche l'action d'un écran, et la colonne de gauche garde sa
        largeur de lecture parce que la description reste sous le titre plutôt
        que de partager sa ligne avec le bouton.

        Sur téléphone, l'ordre du DOM suffit : titre, description, bouton. Il
        arrive donc après la phrase qui promet qu'on peut restaurer — l'ordre
        que la lecture impose de toute façon sur une colonne unique, et le bon
        pour la seule action irréversible du back-office. Aligné à gauche et à
        sa largeur naturelle : pleine largeur, il aurait le poids de l'action
        principale de l'écran, laquelle est « Restaurer ».
      */}
      <header className="mt-2 lg:mt-0 lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-x-6">
        <div className="lg:col-start-1 lg:row-start-1">
          <p className="island-kicker">Corbeille</p>
          <h1 className="display-title mt-1 text-2xl leading-tight sm:text-3xl">
            Établissements supprimés
          </h1>
        </div>

        <p className="mt-2 max-w-prose text-sm text-ink-soft lg:col-start-1 lg:row-start-2">
          Leur carte publique ne répond plus, mais rien n'est perdu : restaurer
          un établissement le remet en service tel qu'il était, avec ses
          catégories, ses produits et son adresse.
        </p>

        {/*
          Rien sur une corbeille vide : il n'y aurait rien à vider, et un
          bouton destructeur inerte n'est qu'une menace sans objet.
        */}
        {archived.length > 0 ? (
          <div className="mt-5 lg:col-start-2 lg:row-start-1 lg:mt-0 lg:justify-self-end">
            <DeleteButton
              labelled
              surface="page"
              label={purge.isPending ? 'Suppression…' : 'Vider la corbeille'}
              question={`Supprimer définitivement ${describeCount(archived.length)} ? Leur carte, leurs photos et leur adresse seront perdues, et cette fois sans retour possible.`}
              pending={purge.isPending}
              onConfirm={() => purge.mutate(ownerId)}
            />
          </div>
        ) : null}

        {purge.error ? (
          <ErrorNote className="lg:col-span-2">{purge.error.message}</ErrorNote>
        ) : null}
      </header>

      <section className="mt-6">
        {venuesQuery.isPending ? (
          <VenueTrashSkeleton />
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

/**
 * L'attente de la corbeille — l'ossature la plus courte de l'application, et
 * c'est voulu.
 *
 * Deux lignes seulement : la corbeille est vide la plupart du temps, et une
 * ossature de six lignes fabriquerait, le temps d'une requête, l'impression
 * d'un désastre. L'en-tête, lui, n'attend rien — il ne lit aucune donnée et
 * reste affiché au-dessus.
 */
function VenueTrashSkeleton() {
  return (
    <SkeletonScreen
      label="Chargement de la corbeille…"
      className="panel divide-y divide-line rounded-2xl"
    >
      {[0, 1].map((row) => (
        <div
          key={row}
          className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3"
        >
          <div className="min-w-0 flex-1">
            <Skeleton
              className="h-[1lh] w-40 max-w-full rounded-full"
              delay={row * 70}
            />
            {/* L'adresse réservée, en `<code>` : plus étroite et plus basse. */}
            <Skeleton
              className="mt-0.5 h-[1lh] w-28 rounded-full text-xs"
              delay={row * 70 + 45}
            />
          </div>

          {/* « Restaurer », l'action de l'écran. */}
          <Skeleton className="h-11 w-32 shrink-0" delay={row * 70 + 90} />
        </div>
      ))}
    </SkeletonScreen>
  )
}
