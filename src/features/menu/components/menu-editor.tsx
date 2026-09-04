import { Link } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'

import { AddCategoryForm } from '#/features/menu/components/add-category-form'
import { CategorySection } from '#/features/menu/components/category-section'
import { EmptyState } from '#/components/empty-state'
import { menuQueryOptions, swapPositions } from '#/features/menu/api'

/**
 * Éditeur de la carte d'un établissement.
 *
 * Chaque mutation d'une sous-partie remonte ici par `onDone` pour invalider la
 * requête : la carte se recharge d'un bloc plutôt que chaque composant ne tienne
 * sa propre copie locale, ce qui garantit que les positions affichées sont bien
 * celles de la base après un déplacement.
 */
export function MenuEditor({ venueSlug }: { venueSlug: string }) {
  const queryClient = useQueryClient()
  const options = menuQueryOptions(venueSlug)

  const menuQuery = useQuery(options)

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: options.queryKey })

  if (menuQuery.isPending) {
    return <p className="text-sm text-ink-soft">Chargement…</p>
  }

  if (menuQuery.isError) {
    return (
      <div className="panel rounded-2xl p-6">
        <p role="alert" className="text-sm text-destructive">
          {menuQuery.error.message}
        </p>
        <Link to="/admin" className="mt-4 inline-block text-sm">
          Retour aux établissements
        </Link>
      </div>
    )
  }

  const { venue, categories } = menuQuery.data

  return (
    <div className="page-wrap px-0">
      <Link
        to="/admin"
        className="nav-link inline-flex min-h-11 items-center gap-1 text-sm no-underline"
      >
        <ArrowLeft className="size-4" />
        Établissements
      </Link>

      <header className="mt-2">
        <p className="island-kicker">Carte</p>
        <h1 className="display-title mt-1 text-2xl leading-tight sm:text-3xl">
          {venue.name}
        </h1>
        <p className="mt-2 text-sm text-ink-soft">
          <code>/m/{venue.slug}</code> — les produits en rupture sont masqués
          pour les clients.
        </p>
      </header>

      <AddCategoryForm
        venueId={venue.id}
        categories={categories}
        onDone={refresh}
      />

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
              onMove={async (direction) => {
                const neighbour = categories[index + direction]
                await swapPositions('categories', category, neighbour)
                await refresh()
              }}
              onDone={refresh}
            />
          ))}
        </div>
      )}
    </div>
  )
}
