import { useQuery } from '@tanstack/react-query'

import { isOpenOrder } from '#/features/orders/status'
import { ordersQueryOptions } from '#/features/orders/api'

/**
 * Le nombre de commandes en cours d'un établissement, tel que la colonne du
 * back-office le porte à côté de « Commandes ».
 *
 * Ce composant vit dans `features/orders` et non dans `features/venues`, qui
 * dessine pourtant la colonne : compter des commandes est une affaire de ce
 * domaine-ci, et les deux features n'ont pas le droit de s'importer. C'est
 * donc `_authenticated.tsx` qui l'assemble, dans le créneau `ordersBadge` de
 * `VenueNav` — le même montage que `productAction` sur la carte client.
 *
 * « En cours » a ici le sens exact qu'il a sur l'écran des commandes : reçue,
 * en préparation ou prête (`isOpenOrder`). Un chiffre qui ne correspondrait
 * pas au nombre de cartes lues sous le titre « En cours » ferait douter des
 * deux.
 *
 * `select` sur `ordersQueryOptions` plutôt qu'une requête à part : c'est le
 * cache de l'écran des commandes — aucune requête supplémentaire quand on s'y
 * trouve — et la pastille ne se redessine que si le nombre bouge, pas à
 * chaque relève. La contrepartie assumée : depuis les autres écrans du
 * back-office, cette file se relève toutes les dix secondes. C'est exactement
 * ce qu'on demande à un compteur posé dans une colonne permanente — savoir
 * qu'une commande est arrivée pendant qu'on modifiait un prix.
 *
 * Rien n'est annoncé à voix haute : pas d'`aria-live`. La colonne est là toute
 * la journée, et une annonce à chaque relève couperait la parole au gérant en
 * train de saisir. Le canal d'alerte existe déjà et il est ailleurs — le titre
 * de l'onglet, sur l'écran des commandes.
 */
export function OpenOrdersCount({ venueSlug }: { venueSlug: string }) {
  const { data: count } = useQuery({
    ...ordersQueryOptions(venueSlug),
    select: (board) =>
      board.orders.filter((order) => isOpenOrder(order.status)).length,
  })

  /*
    Rien à zéro, et pas une pastille grise à la place : une file vide n'a rien
    à signaler, et un « 0 » permanent finirait par ne plus être lu du tout —
    c'est précisément ce qui fait rater le « 1 ».
  */
  if (!count) return null

  return (
    <>
      <span className="orders-count" aria-hidden="true">
        {count}
      </span>
      {/*
        Le chiffre seul se lit « Commandes 3 » à la synthèse vocale, ce qui ne
        veut rien dire. La pastille est donc masquée et la phrase écrite à
        côté.
      */}
      <span className="sr-only">, {count} en cours</span>
    </>
  )
}
