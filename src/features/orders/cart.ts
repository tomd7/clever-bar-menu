/**
 * Le panier du client, avant envoi.
 *
 * Il ne vit qu'ici : ni en base — une commande n'existe qu'une fois envoyée —
 * ni dans React Query, qui sert à refléter un serveur et n'a rien à refléter
 * tant que rien n'est parti.
 *
 * ## Pourquoi un magasin de module plutôt qu'un contexte
 *
 * Deux composants éloignés le lisent : le bouton « + » posé sur chaque produit
 * de la carte, et la barre de commande en bas de l'écran. Ils n'ont aucun
 * parent commun autre que la route, et `PublicMenu` — qui les sépare —
 * appartient à `features/menu`, qui ne doit rien savoir des commandes.
 *
 * Un contexte imposerait donc de faire traverser un provider à toute la carte
 * pour un état que la carte ignore. `useSyncExternalStore` sur un magasin de
 * module donne le même abonnement sans rien ajouter à l'arbre, et c'est l'API
 * que React fournit exactement pour ça.
 *
 * ## Pourquoi le magasin démarre vide, même côté navigateur
 *
 * `/m/$venueSlug` est rendue au serveur. Si `getSnapshot` lisait
 * `localStorage`, le premier rendu client différerait du HTML reçu et React
 * jetterait l'hydratation entière. Le magasin démarre donc vide des deux
 * côtés, et `hydrateCart` le remplit **après** le montage. Le panier apparaît
 * une image plus tard ; l'hydratation ne casse jamais.
 */

import { useCallback, useEffect, useSyncExternalStore } from 'react'

/** Une ligne de panier : un produit, une quantité. */
export type CartLine = {
  productId: string
  quantity: number
}

export type Cart = ReadonlyArray<CartLine>

/**
 * Plafond par ligne, le même que celui inscrit dans `place_order`.
 *
 * Les deux existent, et ce n'est pas une redondance : celui-ci est une
 * courtoisie d'interface, celui de la base est la limite. Un formulaire ne
 * ferme rien — l'appel HTTP se fabrique à la main.
 */
export const MAX_LINE_QUANTITY = 20

/**
 * Un tableau vide constant, et non un `[]` fabriqué à chaque appel.
 *
 * `getSnapshot` doit renvoyer une référence stable tant que rien n'a changé :
 * un nouveau tableau à chaque lecture ferait boucler `useSyncExternalStore`
 * indéfiniment.
 */
const EMPTY: Cart = []

const carts = new Map<string, Cart>()
const listeners = new Map<string, Set<() => void>>()

function storageKey(venueSlug: string): string {
  return `clever-bar-menu:cart:${venueSlug}`
}

export function getCart(venueSlug: string): Cart {
  return carts.get(venueSlug) ?? EMPTY
}

export function subscribeToCart(
  venueSlug: string,
  listener: () => void,
): () => void {
  const bucket = listeners.get(venueSlug) ?? new Set()
  listeners.set(venueSlug, bucket)
  bucket.add(listener)

  return () => {
    bucket.delete(listener)
  }
}

function commit(venueSlug: string, next: Cart): void {
  carts.set(venueSlug, next)

  /*
    L'écriture est enveloppée : un navigateur en navigation privée, un quota
    plein ou un `localStorage` désactivé lèvent. Perdre la persistance du
    panier est ennuyeux, perdre l'écran de commande ne l'est pas — il ne faut
    donc pas que la seconde suive la première.
  */
  try {
    if (next.length === 0) {
      localStorage.removeItem(storageKey(venueSlug))
    } else {
      localStorage.setItem(storageKey(venueSlug), JSON.stringify(next))
    }
  } catch {
    /* Le panier reste en mémoire pour cette visite : c'est déjà l'essentiel. */
  }

  for (const listener of listeners.get(venueSlug) ?? []) listener()
}

/**
 * Recharge le panier depuis le stockage. À appeler **après** le montage, une
 * fois par écran — jamais pendant le rendu, sous peine de casser l'hydratation.
 */
export function hydrateCart(venueSlug: string): void {
  if (carts.has(venueSlug)) return

  let stored: Cart = EMPTY
  try {
    const raw = localStorage.getItem(storageKey(venueSlug))
    stored = raw ? sanitize(JSON.parse(raw)) : EMPTY
  } catch {
    stored = EMPTY
  }

  /*
    Toujours écrire, même vide : c'est ce qui marque le panier comme chargé et
    empêche une seconde lecture d'écraser un ajout fait entre-temps.
  */
  carts.set(venueSlug, stored)
  for (const listener of listeners.get(venueSlug) ?? []) listener()
}

/**
 * Ce qui sort de `localStorage` a été écrit par une version antérieure de
 * l'application, ou à la main dans les outils du navigateur. Rien n'y est cru
 * sur parole : une ligne mal formée est jetée, pas réparée.
 */
function sanitize(value: unknown): Cart {
  if (!Array.isArray(value)) return EMPTY

  const lines: Array<CartLine> = []
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) continue
    const { productId, quantity } = entry as Partial<CartLine>
    if (typeof productId !== 'string' || !productId) continue
    if (typeof quantity !== 'number' || !Number.isInteger(quantity)) continue
    if (quantity < 1) continue
    lines.push({ productId, quantity: Math.min(quantity, MAX_LINE_QUANTITY) })
  }

  return lines
}

/** Ajoute une unité d'un produit, ou l'incrémente s'il est déjà au panier. */
export function addToCart(venueSlug: string, productId: string): void {
  const cart = getCart(venueSlug)
  const existing = cart.find((line) => line.productId === productId)

  commit(
    venueSlug,
    existing
      ? cart.map((line) =>
          line.productId === productId
            ? {
                ...line,
                quantity: Math.min(line.quantity + 1, MAX_LINE_QUANTITY),
              }
            : line,
        )
      : [...cart, { productId, quantity: 1 }],
  )
}

/** Fixe la quantité d'une ligne. Zéro la retire — c'est le geste attendu. */
export function setCartQuantity(
  venueSlug: string,
  productId: string,
  quantity: number,
): void {
  const cart = getCart(venueSlug)

  commit(
    venueSlug,
    quantity <= 0
      ? cart.filter((line) => line.productId !== productId)
      : cart.map((line) =>
          line.productId === productId
            ? { ...line, quantity: Math.min(quantity, MAX_LINE_QUANTITY) }
            : line,
        ),
  )
}

export function clearCart(venueSlug: string): void {
  commit(venueSlug, EMPTY)
}

/** Nombre d'articles, toutes lignes confondues — ce qu'affiche la pastille. */
export function cartItemCount(cart: Cart): number {
  return cart.reduce((total, line) => total + line.quantity, 0)
}

/**
 * Le total du panier, et ce qu'il ne sait pas.
 *
 * `pending` compte les lignes dont le produit n'affiche pas de prix. Elles ne
 * pèsent rien dans le total et ce n'est pas un oubli : la carte ne leur en
 * donne pas non plus. Les compter permet à l'écran de dire « et deux articles
 * au prix du comptoir » plutôt que d'annoncer un total qui serait faux.
 *
 * Un produit que `priceOf` ne connaît pas — disparu de la carte entre-temps —
 * est compté comme sans prix plutôt qu'à zéro : annoncer un total ferme sur
 * une ligne dont on ignore tout serait le seul des deux choix qui puisse
 * mentir. C'est `place_order` qui refusera l'envoi, avec un message que ce
 * total ne saurait pas formuler.
 */
export function cartTotal(
  cart: Cart,
  priceOf: (productId: string) => number | null | undefined,
): { cents: number; pending: number } {
  let cents = 0
  let pending = 0

  for (const line of cart) {
    const price = priceOf(line.productId)
    if (price === null || price === undefined) pending += line.quantity
    else cents += price * line.quantity
  }

  return { cents, pending }
}

/**
 * S'abonne au panier d'un établissement.
 *
 * `getServerSnapshot` — le troisième argument — renvoie le même tableau vide
 * que le premier rendu client : c'est ce qui garantit que le HTML du serveur
 * et la première image du navigateur coïncident. Le contenu réel arrive avec
 * `hydrateCart`, après le montage.
 */
export function useCart(venueSlug: string): Cart {
  const subscribe = useCallback(
    (listener: () => void) => subscribeToCart(venueSlug, listener),
    [venueSlug],
  )

  const cart = useSyncExternalStore(
    subscribe,
    () => getCart(venueSlug),
    () => EMPTY,
  )

  useEffect(() => {
    hydrateCart(venueSlug)
  }, [venueSlug])

  return cart
}
