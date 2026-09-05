import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Boxes, QrCode } from 'lucide-react'

import { AddCategoryForm } from '#/features/menu/components/add-category-form'
import { CategorySection } from '#/features/menu/components/category-section'
import { EmptyState } from '#/components/empty-state'
import { MenuAddress } from '#/components/back-office/menu-address'
import { NavLink } from '#/components/nav-link'
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
    return <p className="text-sm text-ink-soft">Chargement…</p>
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
