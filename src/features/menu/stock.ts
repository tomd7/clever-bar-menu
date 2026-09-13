/**
 * Règles du suivi de stock.
 *
 * Le stock n'est pas un champ de plus sur un produit : c'est lui qui décide si
 * une ligne se commande encore sur la carte d'un client. Ces règles sont donc
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
 * - **un stock à zéro**, seuil ou pas. Le produit ne se commande plus sur la
 *   carte des clients : c'est le seul état qu'on ne peut pas se permettre de cacher, et
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
 * Can a customer no longer order this product?
 *
 * Two causes, kept apart in the database: a shortage decided by hand
 * (`is_available`) and an exhausted stock. The second is **derived**, never
 * written — a restocked product is back on sale by itself, where flipping
 * `is_available` would force reactivating it after every delivery, and would
 * overwrite a decision the manager took for an entirely different reason.
 *
 * A sold-out product is still **listed**: whether it appears on the menu at all
 * is `is_visible`, a column of its own with no rule to derive. It used to be
 * the other way round — sold out meant hidden — and this function was called
 * `isHiddenFromCustomers`.
 *
 * `fetchPublicMenu` reads it to fill `sold_out`, so the rule is stated once on
 * this side of the wire. `place_order` restates it in SQL for the other side;
 * the two change together.
 */
export function isSoldOut(product: {
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
