/**
 * Le vocabulaire d'une commande : ses états, leurs mots, leur enchaînement.
 *
 * Regroupé ici parce que trois écrans le lisent — la file du bar, l'historique
 * et le suivi du client — et qu'un état ajouté ailleurs qu'ici serait
 * forcément oublié dans l'un des trois.
 *
 * **The words depend on how the order is served** (`ServiceMode`, copied onto
 * the order when it was placed). An order collected at the counter is
 * « Prête — venez la chercher », then « Récupérée »; one brought to the table
 * is « Prête — on vous l'apporte », then « Servie ». Nobody collected it, and
 * telling a seated customer to come and fetch it would get them up for
 * nothing. The service is read from the order, not from the venue: a venue
 * that switches mid-evening leaves the orders already placed served the way
 * their customers were told.
 */

import type { OrderStatus } from '#/lib/supabase'
import type { ServiceMode } from '#/lib/order-settings'

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
const BAR_STATUS_LABEL: Record<OrderStatus, string> = {
  received: 'Nouvelle',
  preparing: 'En préparation',
  ready: 'Prête',
  collected: 'Récupérée',
  cancelled: 'Annulée',
}

export function barStatusLabel(
  status: OrderStatus,
  service: ServiceMode,
): string {
  if (status === 'collected' && service === 'table') return 'Servie'
  return BAR_STATUS_LABEL[status]
}

/**
 * Ce que le client lit, et ce n'est pas la même chose.
 *
 * « Prête » côté bar est une case cochée ; côté client c'est une convocation,
 * et le mot doit le dire — c'est le seul état de toute la chaîne qui demande
 * au client de se lever. Unless the order comes to them: then « Prête » is a
 * promise, and it says so.
 */
const GUEST_STATUS_LABEL: Record<ServiceMode, Record<OrderStatus, string>> = {
  counter: {
    received: 'Reçue par le bar',
    preparing: 'En préparation',
    ready: 'Prête — venez la chercher',
    collected: 'Récupérée',
    cancelled: 'Annulée',
  },
  table: {
    received: 'Reçue par le bar',
    preparing: 'En préparation',
    ready: 'Prête — on vous l’apporte',
    collected: 'Servie',
    cancelled: 'Annulée',
  },
}

export function guestStatusLabel(
  status: OrderStatus,
  service: ServiceMode,
): string {
  return GUEST_STATUS_LABEL[service][status]
}

/**
 * La phrase qui accompagne l'état sur l'écran du client.
 *
 * Un état seul laisse la question suivante sans réponse : « reçue », et
 * ensuite ? Chacune dit ce qui va se passer, ou ce qu'il faut faire.
 *
 * At the counter, what the customer gives is what the order is called by: a
 * first name, or the table number when the venue calls tables.
 */
export function guestStatusHint(
  status: OrderStatus,
  order: { serviceMode: ServiceMode; byTable: boolean },
): string {
  switch (status) {
    case 'received':
      return 'Le bar l’a sous les yeux. Gardez cette page ouverte.'
    case 'preparing':
      return 'C’est en cours de préparation.'
    case 'ready':
      if (order.serviceMode === 'table') return 'Elle arrive à votre table.'
      return order.byTable
        ? 'Présentez-vous au comptoir en donnant votre numéro de table.'
        : 'Présentez-vous au comptoir en donnant votre prénom.'
    case 'collected':
      return 'Bonne dégustation.'
    case 'cancelled':
      return order.serviceMode === 'table'
        ? 'Le bar n’a pas pu la servir. Demandez au personnel en salle.'
        : 'Le bar n’a pas pu la servir. Rapprochez-vous du comptoir.'
  }
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

/**
 * Le libellé du bouton qui fait avancer la commande, côté bar — `undefined`
 * where `nextOrderStatus` has nothing to offer.
 */
export function advanceLabel(
  status: OrderStatus,
  service: ServiceMode,
): string | undefined {
  if (status === 'preparing') return 'Prête'
  if (status === 'ready') return service === 'table' ? 'Servie' : 'Récupérée'
  return undefined
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
