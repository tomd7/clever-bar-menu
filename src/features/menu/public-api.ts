import { queryOptions } from '@tanstack/react-query'

import { VenueNotFoundError } from '#/features/menu/api'
import { describeError } from '#/lib/postgrest-error'
import { isSoldOut } from '#/features/menu/stock'
import { supabase } from '#/lib/supabase'

import type { Category, Product, Venue } from '#/lib/supabase'

/**
 * La carte telle qu'elle voyage jusqu'au client — colonne par colonne.
 *
 * Volontairement plus étroite que `Menu`, qui sert l'éditeur : cette charge
 * utile est rendue au serveur **et** déshydratée dans le HTML de la page, donc
 * chaque colonne inutile est envoyée deux fois à un téléphone sur réseau
 * mobile. Et surtout, elle est lue sous le rôle `anon` : `owner_id` n'a rien à
 * faire dans une page publique, `barcode` non plus — il désigne l'article en
 * rayon, ce qui est une information de comptoir et pas de carte.
 *
 * Les `Pick` partent des types partagés plutôt que d'une forme réécrite à la
 * main : une colonne renommée dans `src/lib/supabase.ts` casse ici, ce qu'une
 * copie indépendante n'aurait pas fait.
 */
export type PublicVenue = Pick<
  Venue,
  | 'id'
  | 'slug'
  | 'name'
  | 'description'
  | 'currency'
  | 'orders_enabled'
  | 'theme'
  | 'logo_path'
  | 'logo_plate'
  | 'font_title'
  | 'font_category'
  | 'font_product'
  | 'font_description'
>

export type PublicProduct = Pick<
  Product,
  | 'id'
  | 'category_id'
  | 'name'
  | 'description'
  | 'size'
  | 'price_cents'
  | 'image_path'
> & {
  /**
   * Listed, but no longer orderable — out of stock by hand or at zero, see
   * `isSoldOut`. Derived here rather than shipped as the two columns it comes
   * from: the menu needs the verdict, not the stock level.
   */
  sold_out: boolean
}

export type PublicCategory = Pick<Category, 'id' | 'name' | 'description'> & {
  products: Array<PublicProduct>
}

export type PublicMenuData = {
  venue: PublicVenue
  categories: Array<PublicCategory>
}

/*
  The columns asked of PostgREST, written once and read by the query.
  `is_visible` and `position` are absent although the query uses them: they
  filter and order **server-side**, and the client has no need to receive them.

  `is_available` and `stock_quantity` are asked for, but never returned:
  `fetchPublicMenu` folds them into `sold_out` before building the payload, so
  the stock level is not dehydrated into the page's HTML.
*/
const VENUE_COLUMNS =
  'id,slug,name,description,currency,orders_enabled,theme,logo_path,logo_plate,font_title,font_category,font_product,font_description'
const CATEGORY_COLUMNS = 'id,name,description'
const PRODUCT_COLUMNS =
  'id,category_id,name,description,size,price_cents,image_path,is_available,stock_quantity'

/**
 * Lecture de la carte telle qu'un client la voit.
 *
 * Volontairement séparée de `fetchMenu`, qui sert l'éditeur : ce n'est pas la
 * même requête. Celle-ci écarte les produits masqués et les catégories devenues
 * vides, marque les ruptures (`sold_out`), et surtout elle s'exécute **sans
 * compte**, sous le rôle `anon`. Les policies
 * de lecture publique déclarées dans `src/db/schema.ts` sont ce qui la rend
 * possible ; rien ici n'a besoin d'être authentifié.
 *
 * Elle vit dans `features/menu` plutôt que dans une feature à part parce qu'il
 * s'agit du même objet de domaine — la carte d'un établissement — vu par un
 * autre public. Une feature séparée devrait importer `VenueNotFoundError` et le
 * type `CategoryWithProducts` d'ici, ce que la règle du projet interdit entre
 * features.
 */
export async function fetchPublicMenu(
  venueSlug: string,
): Promise<PublicMenuData> {
  const venueResult = await supabase
    .from('venues')
    .select(VENUE_COLUMNS)
    .eq('slug', venueSlug)
    .maybeSingle()

  if (venueResult.error) throw new Error(describeError(venueResult.error))
  if (!venueResult.data) throw new VenueNotFoundError()

  const venue = venueResult.data

  const categoriesResult = await supabase
    .from('categories')
    .select(CATEGORY_COLUMNS)
    .eq('venue_id', venue.id)
    .order('position', { ascending: true })
    .order('name', { ascending: true })

  if (categoriesResult.error) {
    throw new Error(describeError(categoriesResult.error))
  }

  const categories = categoriesResult.data
  if (categories.length === 0) return { venue, categories: [] }

  const productsResult = await supabase
    .from('products')
    .select(PRODUCT_COLUMNS)
    .in(
      'category_id',
      categories.map((category) => category.id),
    )
    /*
      A hidden product is filtered here, in the query, and not at render: it
      must not travel to the customer's browser at all. What isn't sent cannot
      turn up by accident in the server-rendered HTML.

      Sold out filters nothing any more. Such a product stays listed, marked
      « épuisé » (`sold_out`, below): a line the customer can read as gone is
      information, where a line that silently vanished is a question for the
      counter.
    */
    .eq('is_visible', true)
    .order('position', { ascending: true })
    .order('name', { ascending: true })

  if (productsResult.error) {
    throw new Error(describeError(productsResult.error))
  }

  const byCategory = new Map<string, Array<PublicProduct>>()
  for (const row of productsResult.data) {
    const { is_available, stock_quantity, ...columns } = row
    const product: PublicProduct = {
      ...columns,
      sold_out: isSoldOut({ is_available, stock_quantity }),
    }
    const bucket = byCategory.get(product.category_id)
    if (bucket) bucket.push(product)
    else byCategory.set(product.category_id, [product])
  }

  return {
    venue,
    /*
      A category with no listed product disappears: a customer has nothing to
      do with a « Cocktails » heading followed by nothing, which is what a
      section whose every product is hidden would show. A section of sold-out
      products stays — each of its lines says « épuisé », which is the thing to
      read.
    */
    categories: categories
      .map((category) => ({
        ...category,
        products: byCategory.get(category.id) ?? [],
      }))
      .filter((category) => category.products.length > 0),
  }
}

export const PUBLIC_MENU_QUERY_KEY = ['public-menu'] as const

export function publicMenuQueryOptions(venueSlug: string) {
  return queryOptions({
    queryKey: [...PUBLIC_MENU_QUERY_KEY, venueSlug],
    queryFn: () => fetchPublicMenu(venueSlug),
    /*
      Une adresse inconnue est une réponse définitive : réessayer ne la fera pas
      exister. Même raisonnement que pour l'éditeur.
    */
    retry: (failureCount, error) =>
      !(error instanceof VenueNotFoundError) && failureCount < 3,
  })
}
