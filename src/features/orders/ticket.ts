/**
 * Les tickets : de quoi retrouver les commandes qu'on a envoyées.
 *
 * Un identifiant et un secret par commande, gardés dans le navigateur du
 * client. C'est tout ce qui relie un téléphone à ses commandes — il n'y a pas
 * de compte, et il ne doit pas y en avoir : on scanne un QR code, on commande,
 * on va chercher.
 *
 * **Une liste, et non un ticket unique.** La première version n'en gardait
 * qu'un : envoyer une deuxième commande écrasait la première, qui disparaissait
 * de l'écran du client alors qu'elle était bien au bar. Or commander une
 * deuxième tournée pendant que la première arrive est le geste ordinaire d'un
 * comptoir — c'est même ce que la barre à deux lignes rend possible.
 *
 * **Le jeton ne passe par aucune URL.** Ni chemin, ni paramètre de recherche,
 * ni fragment. Une adresse se copie, s'envoie, se retrouve dans un historique
 * partagé et dans les journaux du serveur ; un secret qui vit dedans n'en est
 * plus un. Il ne circule qu'en corps de requête, vers `get_order`.
 *
 * Même magasin de module et mêmes raisons que `cart.ts` — dont celle-ci, qui
 * décide de tout : la page est rendue au serveur, donc rien ne peut lire
 * `localStorage` pendant le rendu sans casser l'hydratation.
 */

import { useCallback, useEffect, useSyncExternalStore } from 'react'

/** Ce que `place_order` a rendu, et ce qui permet de relire une commande. */
export type OrderTicket = {
  id: string
  accessToken: string
}

/**
 * Combien de commandes un téléphone garde en mémoire.
 *
 * Un plafond, pas une limite de service : rien n'empêche d'en envoyer une
 * onzième, c'est la plus ancienne qui sort de la liste. Il est là pour qu'un
 * `localStorage` ne grossisse pas indéfiniment sur un téléphone qui revient au
 * même bar toutes les semaines.
 */
const MAX_TICKETS = 10

/** Référence stable pour la liste vide — voir `cart.ts`. */
const EMPTY: ReadonlyArray<OrderTicket> = []

const tickets = new Map<string, ReadonlyArray<OrderTicket>>()
const listeners = new Map<string, Set<() => void>>()

function storageKey(venueSlug: string): string {
  return `clever-bar-menu:order:${venueSlug}`
}

export function getTickets(venueSlug: string): ReadonlyArray<OrderTicket> {
  return tickets.get(venueSlug) ?? EMPTY
}

export function subscribeToTickets(
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

function commit(venueSlug: string, next: ReadonlyArray<OrderTicket>): void {
  tickets.set(venueSlug, next)

  try {
    if (next.length === 0) {
      localStorage.removeItem(storageKey(venueSlug))
    } else {
      localStorage.setItem(storageKey(venueSlug), JSON.stringify(next))
    }
  } catch {
    /*
      Sans stockage, le suivi ne survit pas à un rechargement de page — mais la
      commande, elle, est bien partie. Échouer ici ferait croire le contraire.
    */
  }

  for (const listener of listeners.get(venueSlug) ?? []) listener()
}

/** À appeler après le montage, jamais pendant le rendu. */
export function hydrateTickets(venueSlug: string): void {
  if (tickets.has(venueSlug)) return

  let stored: ReadonlyArray<OrderTicket> = EMPTY
  try {
    const raw = localStorage.getItem(storageKey(venueSlug))
    stored = raw ? sanitize(JSON.parse(raw)) : EMPTY
  } catch {
    stored = EMPTY
  }

  tickets.set(venueSlug, stored)
  for (const listener of listeners.get(venueSlug) ?? []) listener()
}

/**
 * Lit ce qui sort du stockage, sans rien croire sur parole.
 *
 * Accepte **les deux formes** : la liste actuelle, et l'objet unique qu'écrivait
 * la version précédente. Sans cette tolérance, tout client ayant une commande en
 * cours au moment d'une mise en ligne la verrait disparaître de son écran — la
 * commande serait au bar, et son téléphone n'en saurait plus rien.
 */
function sanitize(value: unknown): ReadonlyArray<OrderTicket> {
  const entries = Array.isArray(value) ? value : [value]

  const parsed: Array<OrderTicket> = []
  for (const entry of entries) {
    if (typeof entry !== 'object' || entry === null) continue
    const { id, accessToken } = entry as Partial<OrderTicket>
    if (typeof id !== 'string' || !id) continue
    if (typeof accessToken !== 'string' || !accessToken) continue
    if (parsed.some((ticket) => ticket.id === id)) continue
    parsed.push({ id, accessToken })
  }

  return parsed.slice(-MAX_TICKETS)
}

/**
 * Ajoute une commande à la liste. Le plus récent est en dernier — c'est l'ordre
 * dans lequel elles ont été passées, et celui dans lequel le bar les servira.
 */
export function addTicket(venueSlug: string, ticket: OrderTicket): void {
  const existing = getTickets(venueSlug)
  if (existing.some((entry) => entry.id === ticket.id)) return

  commit(venueSlug, [...existing, ticket].slice(-MAX_TICKETS))
}

/**
 * Oublie les commandes indiquées.
 *
 * Le geste du client qui repart avec ses consommations. Les commandes, elles,
 * restent en base : c'est l'historique du bar, il ne dépend pas d'un
 * `localStorage` étranger.
 */
export function forgetTickets(
  venueSlug: string,
  orderIds: ReadonlyArray<string>,
): void {
  const removed = new Set(orderIds)
  commit(
    venueSlug,
    getTickets(venueSlug).filter((ticket) => !removed.has(ticket.id)),
  )
}

/**
 * S'abonne aux tickets d'un établissement.
 *
 * `getServerSnapshot` — le troisième argument — renvoie la même liste vide que
 * le premier rendu client : c'est ce qui garantit que le HTML du serveur et la
 * première image du navigateur coïncident. Le contenu réel arrive avec
 * `hydrateTickets`, après le montage.
 */
export function useTickets(venueSlug: string): ReadonlyArray<OrderTicket> {
  const subscribe = useCallback(
    (listener: () => void) => subscribeToTickets(venueSlug, listener),
    [venueSlug],
  )

  const list = useSyncExternalStore(
    subscribe,
    () => getTickets(venueSlug),
    () => EMPTY,
  )

  useEffect(() => {
    hydrateTickets(venueSlug)
  }, [venueSlug])

  return list
}
