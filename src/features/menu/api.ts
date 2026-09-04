import { queryOptions } from '@tanstack/react-query'

import { describeError } from '#/lib/postgrest-error'
import { supabase } from '#/lib/supabase'

import type { Category, Product, Venue } from '#/lib/supabase'

/** Une catégorie et ses produits, dans l'ordre d'affichage de la carte. */
export type CategoryWithProducts = Category & { products: Array<Product> }

export type Menu = {
  venue: Venue
  categories: Array<CategoryWithProducts>
}

/** Écart entre deux positions consécutives (voir `positionFor`). */
const POSITION_STEP = 100

/**
 * Position à donner à un nouvel élément placé en fin de liste.
 *
 * Les positions avancent de 100 en 100 plutôt que de 1 en 1, ce qui laisse la
 * place d'en insérer une entre deux voisines sans réécrire toute la liste. La
 * colonne est un `smallint`, d'où le plafond : au-delà, on retombe sur un pas
 * de 1, et une réécriture complète deviendrait nécessaire.
 */
function nextPosition(existing: Array<{ position: number }>): number {
  const last = existing.at(-1)
  if (!last) return 0
  return Math.min(last.position + POSITION_STEP, 32000)
}

export { nextPosition }

/**
 * Charge un établissement et sa carte complète.
 *
 * Trois requêtes plutôt qu'une seule avec jointures imbriquées : PostgREST sait
 * embarquer les relations (`select('*, products(*)')`), mais le typage de cette
 * forme demande des métadonnées de relation que notre `Database` écrit à la
 * main ne fournit pas. Tant que la carte tient en quelques dizaines de lignes,
 * la simplicité et le typage valent le round-trip supplémentaire.
 */
export async function fetchMenu(venueSlug: string): Promise<Menu> {
  const venueResult = await supabase
    .from('venues')
    .select('*')
    .eq('slug', venueSlug)
    .maybeSingle()

  if (venueResult.error) throw new Error(describeError(venueResult.error))
  if (!venueResult.data) {
    throw new Error("Cet établissement n'existe pas.")
  }

  const venue = venueResult.data

  const categoriesResult = await supabase
    .from('categories')
    .select('*')
    .eq('venue_id', venue.id)
    .order('position', { ascending: true })
    .order('name', { ascending: true })

  if (categoriesResult.error) {
    throw new Error(describeError(categoriesResult.error))
  }

  const categories = categoriesResult.data

  if (categories.length === 0) {
    return { venue, categories: [] }
  }

  const productsResult = await supabase
    .from('products')
    .select('*')
    .in(
      'category_id',
      categories.map((category) => category.id),
    )
    .order('position', { ascending: true })
    .order('name', { ascending: true })

  if (productsResult.error) {
    throw new Error(describeError(productsResult.error))
  }

  const byCategory = new Map<string, Array<Product>>()
  for (const product of productsResult.data) {
    const bucket = byCategory.get(product.category_id)
    if (bucket) bucket.push(product)
    else byCategory.set(product.category_id, [product])
  }

  return {
    venue,
    categories: categories.map((category) => ({
      ...category,
      products: byCategory.get(category.id) ?? [],
    })),
  }
}

/**
 * Échange la position de deux éléments voisins.
 *
 * Deux mises à jour successives et non une transaction : PostgREST n'en expose
 * pas. Si la seconde échoue, deux éléments partagent la même position — l'ordre
 * devient alors indéterminé entre eux, mais la carte reste lisible et un
 * nouveau déplacement rétablit la situation. C'est un compromis acceptable ici,
 * qui ne le serait pas sur des données comptables.
 */
export async function swapPositions(
  table: 'categories' | 'products',
  a: { id: string; position: number },
  b: { id: string; position: number },
): Promise<void> {
  const first = await supabase
    .from(table)
    .update({ position: b.position })
    .eq('id', a.id)
  if (first.error) throw new Error(describeError(first.error))

  const second = await supabase
    .from(table)
    .update({ position: a.position })
    .eq('id', b.id)
  if (second.error) throw new Error(describeError(second.error))
}

/**
 * Requête de la carte d'un établissement.
 *
 * Passer par `queryOptions` plutôt que par une clé écrite à la main à chaque
 * appel : la clé et la fonction de chargement restent solidaires, et
 * l'invalidation après mutation ne peut plus viser une clé légèrement
 * différente de celle qui a servi à lire.
 */
export function menuQueryOptions(venueSlug: string) {
  return queryOptions({
    queryKey: ['menu', venueSlug],
    queryFn: () => fetchMenu(venueSlug),
  })
}
