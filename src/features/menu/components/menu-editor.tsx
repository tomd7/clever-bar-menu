import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Boxes, ConciergeBell, QrCode, Settings } from 'lucide-react'

import { AddCategoryForm } from '#/features/menu/components/add-category-form'
import { CategorySection } from '#/features/menu/components/category-section'
import { EmptyState } from '#/components/empty-state'
import { MenuAddress } from '#/components/back-office/menu-address'
import { NavLink } from '#/components/nav-link'
import {
  Skeleton,
  SkeletonAddress,
  SkeletonHeader,
  SkeletonLine,
  SkeletonScreen,
} from '#/components/skeleton'
import { menuQueryOptions } from '#/features/menu/api'
import { useMoveItem } from '#/features/menu/mutations'

/**
 * Éditeur de la carte d'un établissement.
 *
 * Chaque écriture invalide la requête depuis son propre hook de mutation : la
 * carte se recharge d'un bloc plutôt que chaque composant ne tienne sa propre
 * copie locale, ce qui garantit que les positions affichées sont bien celles de
 * la base après un déplacement.
 */
export function MenuEditor({ venueSlug }: { venueSlug: string }) {
  const menuQuery = useQuery(menuQueryOptions(venueSlug))
  const moveCategory = useMoveItem()

  if (menuQuery.isPending) {
    return <MenuEditorSkeleton />
  }

  if (menuQuery.isError) {
    return (
      <div className="panel rounded-2xl p-6">
        <p role="alert" className="text-sm text-destructive">
          {menuQuery.error.message}
        </p>
        <NavLink to="/admin" className="mt-4">
          Retour aux établissements
        </NavLink>
      </div>
    )
  }

  const { venue, categories } = menuQuery.data

  return (
    <div className="page-wrap px-0">
      {/*
        Masqué à partir de `lg` : la colonne du back-office y porte la même
        destination, et la répéter en tête de page ferait deux chemins pour un
        seul mouvement. En dessous, la colonne n'existe pas — ce lien est alors
        la seule sortie.
      */}
      <NavLink to="/admin" icon={ArrowLeft} className="lg:hidden">
        Établissements
      </NavLink>

      <header className="mt-2 lg:mt-0">
        <p className="island-kicker">Carte</p>
        <h1 className="display-title mt-1 text-2xl leading-tight sm:text-3xl">
          {venue.name}
        </h1>
        <MenuAddress slug={venue.slug} className="mt-1" />

        <p className="mt-2 text-sm text-ink-soft">
          Les produits en rupture sont masqués pour les clients.
        </p>

        {/* Même raison : ces sections sont dans la colonne à partir de `lg`. */}
        <div className="flex flex-wrap gap-x-5 lg:hidden">
          <NavLink
            to="/admin/$venueSlug/commandes"
            params={{ venueSlug: venue.slug }}
            icon={ConciergeBell}
            className="mt-1 font-medium"
          >
            Commandes
          </NavLink>
          <NavLink
            to="/admin/$venueSlug/stock"
            params={{ venueSlug: venue.slug }}
            icon={Boxes}
            className="mt-1 font-medium"
          >
            Stock
          </NavLink>
          <NavLink
            to="/admin/$venueSlug/qr"
            params={{ venueSlug: venue.slug }}
            icon={QrCode}
            className="mt-1 font-medium"
          >
            QR code à imprimer
          </NavLink>
          <NavLink
            to="/admin/$venueSlug/reglages"
            params={{ venueSlug: venue.slug }}
            icon={Settings}
            className="mt-1 font-medium"
          >
            Réglages
          </NavLink>
        </div>
      </header>

      <AddCategoryForm venueId={venue.id} categories={categories} />

      {categories.length === 0 ? (
        <EmptyState title="Carte vide" className="mt-6">
          Commencez par une catégorie — « Bières pression », « Cocktails » —
          puis ajoutez-y vos produits.
        </EmptyState>
      ) : (
        <div className="mt-6 space-y-4">
          {categories.map((category, index) => (
            <CategorySection
              key={category.id}
              category={category}
              currency={venue.currency}
              isFirst={index === 0}
              isLast={index === categories.length - 1}
              onMove={(direction) =>
                moveCategory.mutate({
                  table: 'categories',
                  a: category,
                  b: categories[index + direction],
                })
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * L'attente de l'éditeur.
 *
 * Deux catégories de quatre et de trois produits : une carte de bar en a
 * rarement moins, et l'ossature doit tenir la page assez haut pour que la barre
 * de défilement ne se rétracte pas au moment où la carte arrive — un saut de
 * défilement est le plus désagréable de tous, parce qu'il déplace ce que l'œil
 * est déjà en train de lire.
 *
 * Elle vit dans ce fichier plutôt que dans le sien : une ossature n'a d'autre
 * raison d'être que de ressembler à l'écran qu'elle remplace, et rangée
 * ailleurs elle cesserait d'être modifiée en même temps que lui.
 */
function MenuEditorSkeleton() {
  return (
    <SkeletonScreen label="Chargement de la carte…" className="page-wrap px-0">
      {/* Le lien de retour n'existe qu'en dessous de `lg`, où la colonne du
          back-office n'est pas là — l'ossature suit la même règle, sans quoi
          l'en-tête remonterait d'une ligne sur téléphone en fin de chargement. */}
      <Skeleton className="h-4 w-36 rounded-full lg:hidden" />

      <SkeletonHeader>
        <SkeletonAddress delay={100} />
        <SkeletonLine className="mt-2 w-72 max-w-full" delay={150} />
      </SkeletonHeader>

      {/* Les deux sections de l'établissement, elles aussi propres au téléphone. */}
      <div className="mt-2 flex gap-5 lg:hidden">
        <Skeleton className="h-3.5 w-16 rounded-full" delay={150} />
        <Skeleton className="h-3.5 w-36 rounded-full" delay={175} />
      </div>

      {/*
        « Nouvelle catégorie » : le libellé, le champ et le bouton, dans leur
        panneau et à la hauteur commune de `SURFACE_HEIGHT` (44px au doigt,
        `lg:h-10` sur une page). C'est la seule commande de l'écran, et la voir
        arriver à sa place évite que le pouce parte vers un endroit qui bougera.
      */}
      <section className="panel mt-6 rounded-2xl p-4 sm:p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-40 rounded-full" delay={180} />
            <Skeleton className="h-11 w-full lg:h-10" delay={205} />
          </div>
          <Skeleton className="h-11 w-full lg:h-10 lg:w-32" delay={235} />
        </div>
      </section>

      <div className="mt-6 space-y-4">
        {[4, 3].map((products, section) => (
          <section key={section} className="panel rounded-2xl p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <Skeleton
                  className="h-5 w-36 max-w-full"
                  delay={280 + section * 120}
                />
                <Skeleton
                  className="mt-1.5 h-3 w-24 rounded-full"
                  delay={320 + section * 120}
                />
              </div>
              {/* Les commandes de la catégorie : monter, descendre, renommer,
                  supprimer — quatre cibles carrées au bord droit. */}
              <div className="flex shrink-0 items-center gap-1">
                {[0, 1, 2, 3].map((control) => (
                  <Skeleton
                    key={control}
                    className="size-9"
                    delay={340 + section * 120 + control * 25}
                  />
                ))}
              </div>
            </div>

            <div className="mt-4 divide-y divide-line border-t border-line">
              {Array.from({ length: products }, (_, row) => (
                <div key={row} className="flex items-center gap-x-3 py-3">
                  <div className="min-w-0 flex-1">
                    <Skeleton
                      className="h-[1lh] w-44 max-w-full rounded-full"
                      delay={420 + section * 120 + row * 55}
                    />
                    <Skeleton
                      className="mt-0.5 h-[1lh] w-64 max-w-full rounded-full text-sm"
                      delay={450 + section * 120 + row * 55}
                    />
                  </div>

                  {/* Le prix : la colonne que le gérant lit en descendant, et
                      la seule qui doive rester alignée. */}
                  <Skeleton
                    className="h-[1lh] w-14 shrink-0 rounded-full"
                    delay={440 + section * 120 + row * 55}
                  />

                  {/*
                    Les commandes de la ligne : l'interrupteur « En vente »,
                    puis monter, descendre, modifier, supprimer. Elles sont ce
                    qui donne sa hauteur à la ligne (`lg:min-h-9`), bien avant
                    le texte — les oublier aurait fait une ossature plus serrée
                    que la carte qu'elle annonce.
                  */}
                  <div className="flex shrink-0 items-center gap-1">
                    <Skeleton
                      className="h-5 w-9 rounded-full"
                      delay={460 + section * 120 + row * 55}
                    />
                    {[0, 1, 2, 3].map((control) => (
                      <Skeleton
                        key={control}
                        className="size-9"
                        delay={480 + section * 120 + row * 55 + control * 20}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* « Ajouter un produit » ferme chaque catégorie. */}
            <Skeleton
              className="mt-3 h-11 w-44 lg:h-9"
              delay={620 + section * 120}
            />
          </section>
        ))}
      </div>
    </SkeletonScreen>
  )
}
