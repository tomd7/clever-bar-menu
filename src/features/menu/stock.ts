/**
 * Règles du suivi de stock.
 *
 * Le stock n'est pas un champ de plus sur un produit : c'est lui qui décide si
 * une ligne apparaît encore sur la carte d'un client. Ces règles sont donc
 * regroupées ici plutôt que réparties entre l'éditeur, la page Stock et la
 * carte publique, où trois lectures légèrement différentes de « épuisé »
 * finiraient par s'installer.
 *
 * Homologue de `price.ts` pour la partie saisie : la conversion entre ce que le
 * gérant tape et ce que la base contient vit dans un seul fichier.
 */

import type { Product } from '#/lib/supabase'

/** Erreur de saisie, destinée à être affichée telle quelle. */
export class StockFormatError extends Error {}

/**
 * Ce que le stock d'un produit raconte, en un mot.
 *
 * `untracked` n'est pas un état dégradé : c'est le cas normal d'un café ou
 * d'une pression au fût, dont personne ne compte les unités à l'échelle d'un
 * service.
 */
export type StockState = 'untracked' | 'out' | 'low' | 'ok'

/**
 * Le produit est-il surveillé, c'est-à-dire présent sur la page Stock ?
 *
 * Il faut une quantité, sinon il n'y a rien à décompter, et l'une des deux
 * raisons de la montrer :
 *
 * - un **seuil d'alerte**, par lequel le gérant désigne les produits dont il
 *   veut être prévenu. Sans seuil, la ligne ne pourrait jamais rien signaler,
 *   et une page qu'on parcourt debout derrière un comptoir pour savoir quoi
 *   réapprovisionner n'a rien à gagner à la porter ;
 * - **un stock à zéro**, seuil ou pas. Le produit a quitté la carte des
 *   clients : c'est le seul état qu'on ne peut pas se permettre de cacher, et
 *   l'écran qui le répare est celui-ci. L'exclure reviendrait à masquer une
 *   rupture parce que personne n'avait demandé à en être averti.
 *
 * Le produit épuisé sans seuil quitte donc la liste dès qu'il est
 * réapprovisionné : il redevient un produit dont personne n'a demandé de
 * nouvelles. Son niveau se règle alors depuis sa fiche, sur la carte, et le
 * pied de la page Stock compte ces produits-là et y renvoie.
 *
 * Générique plutôt que typée sur ces deux champs : un prédicat qui y réduirait
 * ferait disparaître le nom et le prix du produit après le test, ce qui est
 * exactement l'inverse de l'effet recherché. Seule la quantité est resserrée —
 * le seuil, lui, reste facultatif.
 */
export function isWatched<
  TProduct extends {
    stock_quantity: number | null
    low_stock_threshold: number | null
  },
>(product: TProduct): product is TProduct & { stock_quantity: number } {
  if (product.stock_quantity === null) return false
  return product.low_stock_threshold !== null || product.stock_quantity <= 0
}

export function stockStateOf(product: {
  stock_quantity: number | null
  low_stock_threshold: number | null
}): StockState {
  if (product.stock_quantity === null) return 'untracked'
  if (product.stock_quantity <= 0) return 'out'
  if (
    product.low_stock_threshold !== null &&
    product.stock_quantity <= product.low_stock_threshold
  ) {
    return 'low'
  }
  return 'ok'
}

/** Un produit qui demande une intervention : épuisé ou proche de l'être. */
export function needsRestock(product: {
  stock_quantity: number | null
  low_stock_threshold: number | null
}): boolean {
  const state = stockStateOf(product)
  return state === 'out' || state === 'low'
}

/**
 * Le produit est-il invisible pour un client ?
 *
 * Deux causes, et elles restent séparées en base : la rupture décidée à la main
 * (`is_available`) et l'épuisement du stock. La rupture par épuisement est
 * **déduite**, jamais écrite — un produit réapprovisionné revient donc de
 * lui-même sur la carte, là où basculer `is_available` obligerait à le
 * réactiver produit par produit après chaque livraison, et écraserait au
 * passage une décision que le gérant avait prise pour une tout autre raison.
 *
 * La carte publique n'appelle pas cette fonction : elle filtre dans la requête,
 * pour qu'un produit masqué ne parte même pas dans le HTML. Les deux doivent
 * dire la même chose — si la condition change ici, `fetchPublicMenu` change
 * avec elle.
 */
export function isHiddenFromCustomers(product: {
  is_available: boolean
  stock_quantity: number | null
}): boolean {
  return (
    !product.is_available ||
    (product.stock_quantity !== null && product.stock_quantity <= 0)
  )
}

/**
 * Convertit une saisie de quantité en entier.
 *
 * Un champ vide vaut `null` — « pas de suivi » — et non zéro, exactement comme
 * un prix absent n'est pas un prix nul : `0` veut dire « épuisé » et masque le
 * produit de la carte, ce qui n'est pas ce que demande un gérant qui efface un
 * champ. Les espaces sont retirés au passage, insécables compris, ceux que
 * produit un copier-coller depuis un tableur.
 */
export function parseOptionalStock(input: string): number | null {
  const cleaned = input.replace(/\s/g, '')
  if (!cleaned) return null

  const quantity = Number(cleaned)
  if (!/^\d+$/.test(cleaned) || !Number.isSafeInteger(quantity)) {
    throw new StockFormatError(
      'Quantité invalide. Indiquez un nombre entier, ou laissez vide.',
    )
  }

  return quantity
}

/** Rend une quantité sous la forme éditable d'un champ. `null` donne un champ vide. */
export function stockToInput(quantity: number | null): string {
  return quantity === null ? '' : String(quantity)
}

/** Compte les produits d'une carte qui demandent un réapprovisionnement. */
export function countRestockAlerts(
  categories: Array<{ products: Array<Product> }>,
): { out: number; low: number } {
  let out = 0
  let low = 0

  for (const category of categories) {
    for (const product of category.products) {
      const state = stockStateOf(product)
      if (state === 'out') out += 1
      else if (state === 'low') low += 1
    }
  }

  return { out, low }
}
