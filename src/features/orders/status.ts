/**
 * Le vocabulaire d'une commande : ses états, leurs mots, leur enchaînement.
 *
 * Regroupé ici parce que trois écrans le lisent — la file du bar, l'historique
 * et le suivi du client — et qu'un état ajouté ailleurs qu'ici serait
 * forcément oublié dans l'un des trois.
 */

import type { OrderStatus } from '#/lib/supabase'

export type { OrderStatus }

/**
 * Les états dans lesquels une commande demande encore quelque chose à
 * quelqu'un. Le reste — récupérée, annulée — est de l'historique.
 */
const OPEN_STATUSES: ReadonlyArray<OrderStatus> = [
  'received',
  'preparing',
  'ready',
]

export function isOpenOrder(status: OrderStatus): boolean {
  return OPEN_STATUSES.includes(status)
}

/**
 * Ce que le bar lit. Court, à la troisième personne : c'est une file, chaque
 * ligne y est un objet posé sur le comptoir.
 */
export const BAR_STATUS_LABEL: Record<OrderStatus, string> = {
  received: 'Nouvelle',
  preparing: 'En préparation',
  ready: 'Prête',
  collected: 'Récupérée',
  cancelled: 'Annulée',
}

/**
 * Ce que le client lit, et ce n'est pas la même chose.
 *
 * « Prête » côté bar est une case cochée ; côté client c'est une convocation,
 * et le mot doit le dire — c'est le seul état de toute la chaîne qui demande
 * au client de se lever.
 */
export const GUEST_STATUS_LABEL: Record<OrderStatus, string> = {
  received: 'Reçue par le bar',
  preparing: 'En préparation',
  ready: 'Prête — venez la chercher',
  collected: 'Récupérée',
  cancelled: 'Annulée',
}

/**
 * La phrase qui accompagne l'état sur l'écran du client.
 *
 * Un état seul laisse la question suivante sans réponse : « reçue », et
 * ensuite ? Chacune dit ce qui va se passer, ou ce qu'il faut faire.
 */
export const GUEST_STATUS_HINT: Record<OrderStatus, string> = {
  received: 'Le bar l’a sous les yeux. Gardez cette page ouverte.',
  preparing: 'C’est en cours de préparation.',
  ready: 'Présentez-vous au comptoir en donnant votre prénom.',
  collected: 'Bonne dégustation.',
  cancelled: 'Le bar n’a pas pu la servir. Rapprochez-vous du comptoir.',
}

/**
 * L'état suivant dans la marche normale du service, ou `null` s'il n'y en a
 * pas.
 *
 * `received` est absent volontairement : accepter une commande n'est pas un
 * changement d'état ordinaire, c'est aussi le décompte du stock, et cela passe
 * par `accept_order`. Le faire tomber dans le même bouton que les autres
 * rendrait la différence invisible le jour où quelqu'un ajoutera un état.
 */
export function nextOrderStatus(status: OrderStatus): OrderStatus | null {
  if (status === 'preparing') return 'ready'
  if (status === 'ready') return 'collected'
  return null
}

/** Le libellé du bouton qui fait avancer la commande, côté bar. */
export const ADVANCE_LABEL: Partial<Record<OrderStatus, string>> = {
  preparing: 'Prête',
  ready: 'Récupérée',
}

/**
 * Laquelle de plusieurs commandes la barre doit annoncer.
 *
 * Un client peut en avoir deux en vol ; le bandeau du bas n'a la place que
 * d'un état. C'est la plus avancée qui gagne — « Prête » d'abord, parce que
 * c'est la seule qui demande de se lever, et une commande terminée en dernier,
 * parce qu'elle ne demande plus rien.
 */
const STATUS_URGENCY: Record<OrderStatus, number> = {
  ready: 4,
  preparing: 3,
  received: 2,
  cancelled: 1,
  collected: 0,
}

export function mostUrgentStatus(
  statuses: ReadonlyArray<OrderStatus>,
): OrderStatus | undefined {
  return statuses.reduce<OrderStatus | undefined>(
    (best, status) =>
      best === undefined || STATUS_URGENCY[status] > STATUS_URGENCY[best]
        ? status
        : best,
    undefined,
  )
}
