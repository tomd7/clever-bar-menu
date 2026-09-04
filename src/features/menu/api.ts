import { queryOptions } from '@tanstack/react-query'

import { describeError } from '#/lib/postgrest-error'
import { removeProductPhoto } from '#/features/menu/photo'
import { supabase } from '#/lib/supabase'

import type { Category, Product, Venue } from '#/lib/supabase'

/**
 * L'établissement demandé n'existe pas.
 *
 * Distinguée d'une `Error` ordinaire parce que c'est une réponse, pas une
 * panne : la base a répondu, et elle a répondu « rien ». Réessayer ne changera
 * jamais rien, d'où le `retry` désactivé dans `menuQueryOptions`.
 */
export class VenueNotFoundError extends Error {
  constructor() {
    super("Cet établissement n'existe pas.")
  }
}

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
    throw new VenueNotFoundError()
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
  await write(
    supabase.from(table).update({ position: b.position }).eq('id', a.id),
  )
  await write(
    supabase.from(table).update({ position: a.position }).eq('id', b.id),
  )
}

/**
 * Requête de la carte d'un établissement.
 *
 * Passer par `queryOptions` plutôt que par une clé écrite à la main à chaque
 * appel : la clé et la fonction de chargement restent solidaires, et
 * l'invalidation après mutation ne peut plus viser une clé légèrement
 * différente de celle qui a servi à lire.
 */
export const MENU_QUERY_KEY = ['menu'] as const

export function menuQueryOptions(venueSlug: string) {
  return queryOptions({
    queryKey: [...MENU_QUERY_KEY, venueSlug],
    queryFn: () => fetchMenu(venueSlug),
    /*
      Un slug introuvable est une réponse définitive : les trois tentatives par
      défaut ne feraient que retarder le message d'une poignée de secondes.
      Pire, elles laissent l'écran sur « Chargement… » indéfiniment quand
      l'onglet passe à l'arrière-plan — React Query suspend ses tentatives tant
      que le document n'est pas au premier plan, et une erreur qui n'a jamais
      fini de réessayer n'est jamais affichée. Ne pas réessayer supprime les
      deux à la fois.

      Le reste garde les trois tentatives : une coupure réseau, elle, se répare
      toute seule.
    */
    retry: (failureCount, error) =>
      !(error instanceof VenueNotFoundError) && failureCount < 3,
  })
}

/**
 * Exécute une écriture et traduit son échec.
 *
 * Toutes les mutations de la carte partageaient les deux mêmes lignes — lire
 * `error`, lever `describeError(error)`. Les regrouper évite qu'une écriture
 * ajoutée plus tard oublie la traduction et remonte un message PostgREST brut
 * en anglais dans l'interface.
 */
async function write(
  query: PromiseLike<{ error: { code?: string; message: string } | null }>,
): Promise<void> {
  const { error } = await query
  if (error) throw new Error(describeError(error))
}

/**
 * Écritures de la carte.
 *
 * Les composants passent par ici plutôt que d'appeler `supabase` eux-mêmes :
 * une ligne de produit n'a pas à savoir qu'un produit est une ligne de table,
 * ni que l'API parle `snake_case` là où le reste du code est en `camelCase`.
 * C'est cette frontière qui rend le remplacement de PostgREST envisageable
 * sans toucher à un seul composant.
 */

export async function createCategory(input: {
  venueId: string
  name: string
  position: number
}): Promise<void> {
  await write(
    supabase.from('categories').insert({
      venue_id: input.venueId,
      name: input.name,
      position: input.position,
    }),
  )
}

export async function renameCategory(
  categoryId: string,
  name: string,
): Promise<void> {
  await write(supabase.from('categories').update({ name }).eq('id', categoryId))
}

/**
 * Supprime une catégorie, ses produits et leurs photos.
 *
 * La cascade sur les produits est déclarée en base, mais elle s'arrête au bord
 * du Storage : Postgres ne sait rien des fichiers. Les chemins sont donc relevés
 * *avant* la suppression, seul moment où ils sont encore lisibles, puis les
 * fichiers sont retirés une fois la cascade passée.
 */
export async function deleteCategory(categoryId: string): Promise<void> {
  const { data } = await supabase
    .from('products')
    .select('image_path')
    .eq('category_id', categoryId)
    .not('image_path', 'is', null)

  await write(supabase.from('categories').delete().eq('id', categoryId))

  for (const row of data ?? []) {
    if (row.image_path) await removeProductPhoto(row.image_path)
  }
}

/** Champs d'un produit tels que le formulaire les tient, prix déjà en centimes. */
export type ProductDraft = {
  name: string
  description: string | null
  priceCents: number | null
  /** Chemin dans le bucket, jamais une URL : celle-ci dépend du projet. */
  imagePath: string | null
}

function toProductRow(draft: ProductDraft) {
  return {
    name: draft.name,
    description: draft.description,
    price_cents: draft.priceCents,
    image_path: draft.imagePath,
  }
}

export async function createProduct(
  input: { categoryId: string; position: number } & ProductDraft,
): Promise<void> {
  await write(
    supabase.from('products').insert({
      ...toProductRow(input),
      category_id: input.categoryId,
      position: input.position,
    }),
  )
}

export async function updateProduct(
  productId: string,
  draft: ProductDraft,
): Promise<void> {
  await write(
    supabase.from('products').update(toProductRow(draft)).eq('id', productId),
  )
}

/**
 * Supprime un produit et, le cas échéant, sa photo.
 *
 * La ligne part avant le fichier, et pas l'inverse : le Storage n'a pas de
 * cascade, il faut donc choisir lequel des deux restes est acceptable. Un
 * fichier orphelin ne se voit pas et ne coûte que quelques kilo-octets ; une
 * ligne qui pointe vers un fichier disparu affiche une image cassée dans la
 * carte d'un client.
 */
export async function deleteProduct(product: {
  id: string
  imagePath: string | null
}): Promise<void> {
  await write(supabase.from('products').delete().eq('id', product.id))
  if (product.imagePath) await removeProductPhoto(product.imagePath)
}

export async function setProductAvailability(
  productId: string,
  isAvailable: boolean,
): Promise<void> {
  await write(
    supabase
      .from('products')
      .update({ is_available: isAvailable })
      .eq('id', productId),
  )
}
