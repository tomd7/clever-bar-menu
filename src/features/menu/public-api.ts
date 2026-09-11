import { queryOptions } from '@tanstack/react-query'

import { VenueNotFoundError } from '#/features/menu/api'
import { describeError } from '#/lib/postgrest-error'
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
>

export type PublicCategory = Pick<Category, 'id' | 'name' | 'description'> & {
  products: Array<PublicProduct>
}

export type PublicMenuData = {
  venue: PublicVenue
  categories: Array<PublicCategory>
}

/*
  Les colonnes demandées à PostgREST, écrites une fois et lues par la requête.
  `is_available`, `stock_quantity` et `position` sont absents alors que la
  requête s'en sert : ils filtrent et ordonnent **côté serveur**, le client n'a
  pas à les recevoir pour autant.
*/
const VENUE_COLUMNS =
  'id,slug,name,description,currency,orders_enabled,theme,logo_path,logo_plate,font_title,font_category,font_product,font_description'
const CATEGORY_COLUMNS = 'id,name,description'
const PRODUCT_COLUMNS =
  'id,category_id,name,description,size,price_cents,image_path'

/**
 * Lecture de la carte telle qu'un client la voit.
 *
 * Volontairement séparée de `fetchMenu`, qui sert l'éditeur : ce n'est pas la
 * même requête. Celle-ci écarte les ruptures et les catégories devenues vides,
 * et surtout elle s'exécute **sans compte**, sous le rôle `anon`. Les policies
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
      Le filtre des ruptures est ici, dans la requête, et non à l'affichage :
      un produit masqué ne doit pas transiter jusqu'au navigateur du client. Ce
      qui n'est pas envoyé ne peut pas apparaître par accident dans le HTML
      rendu au serveur.
    */
    .eq('is_available', true)
    /*
      Seconde cause de disparition, indépendante de la première : le stock est
      épuisé. Elle est **déduite** et jamais écrite dans `is_available` — un
      produit réapprovisionné revient donc tout seul, sans que personne ait à
      rouvrir la carte pour le réactiver.

      `stock_quantity is null` doit rester dans la condition : c'est l'immense
      majorité des lignes, celles qu'on ne compte pas. Un filtre écrit
      naïvement `gt.0` viderait la carte de tous les produits non suivis.

      La règle est la même que `isHiddenFromCustomers` dans `stock.ts`, écrite
      deux fois parce qu'elle s'applique de deux côtés — SQL ici, TypeScript
      pour le back-office. Elles se modifient ensemble.
    */
    .or('stock_quantity.is.null,stock_quantity.gt.0')
    .order('position', { ascending: true })
    .order('name', { ascending: true })

  if (productsResult.error) {
    throw new Error(describeError(productsResult.error))
  }

  const byCategory = new Map<string, Array<PublicProduct>>()
  for (const product of productsResult.data) {
    const bucket = byCategory.get(product.category_id)
    if (bucket) bucket.push(product)
    else byCategory.set(product.category_id, [product])
  }

  return {
    venue,
    /*
      Une catégorie sans produit disponible disparaît. Un client n'a rien à
      faire d'un intitulé « Cocktails » suivi de rien — et c'est exactement ce
      qu'affiche une carte dont tout le rayon est en rupture.
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
