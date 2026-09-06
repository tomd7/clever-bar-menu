import { useMutation, useQueryClient } from '@tanstack/react-query'

import {
  GUEST_ORDER_QUERY_KEY,
  cancelGuestOrder,
  placeOrder,
} from '#/features/orders/public-api'
import { MENU_QUERY_KEY, VENUES_QUERY_KEY } from '#/lib/query-keys'
import {
  ORDERS_QUERY_KEY,
  acceptOrder,
  setOrderStatus,
  setOrdersEnabled,
} from '#/features/orders/api'
import { clearCart } from '#/features/orders/cart'
import { addTicket } from '#/features/orders/ticket'

import type { OrderStatus } from '#/lib/supabase'

/**
 * Toute écriture sur une commande invalide la file.
 *
 * Même mécanique que `useMenuMutation`, et même raison de viser le préfixe
 * `['orders']` plutôt que `['orders', venueSlug]` : le bouton qui appuie ne
 * connaît pas le slug, et le lui faire redescendre reconstituerait le fil que
 * le projet a coupé.
 */
function useOrderMutation<TVariables>(
  mutationFn: (variables: TVariables) => Promise<void>,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ORDERS_QUERY_KEY }),
  })
}

/**
 * Le bar accepte : la commande passe en préparation et le stock descend.
 *
 * Deux caches périment donc, pas un — c'est la seule mutation du projet dans
 * ce cas. La carte est invalidée par `MENU_QUERY_KEY`, qui vit dans
 * `lib/query-keys.ts` précisément pour que cette ligne soit écrivable sans
 * importer `features/menu`.
 */
export function useAcceptOrder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: acceptOrder,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ORDERS_QUERY_KEY })
      await queryClient.invalidateQueries({ queryKey: MENU_QUERY_KEY })
    },
  })
}

/** Fait avancer une commande déjà acceptée : prête, puis récupérée. */
export function useSetOrderStatus() {
  return useOrderMutation((input: { orderId: string; status: OrderStatus }) =>
    setOrderStatus(input.orderId, input.status),
  )
}

/**
 * Ouvre ou ferme la prise de commande.
 *
 * Invalide aussi la liste des établissements : le drapeau vit sur `venues`, et
 * la colonne de gauche lit cette liste-là. Sans quoi le bandeau «
 * commandes fermées » resterait affiché dans la barre latérale d'un
 * établissement qu'on vient d'ouvrir.
 */
export function useSetOrdersEnabled() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { venueId: string; enabled: boolean }) =>
      setOrdersEnabled(input.venueId, input.enabled),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ORDERS_QUERY_KEY })
      await queryClient.invalidateQueries({ queryKey: VENUES_QUERY_KEY })
    },
  })
}

/**
 * Le client envoie sa commande.
 *
 * L'ordre des trois effets qui suivent l'envoi n'est pas indifférent : le
 * ticket est **écrit d'abord**. Il est la seule trace qui relie ce téléphone à
 * sa commande ; le perdre entre l'insertion et le vidage du panier laisserait
 * un client avec une commande partie au bar et un écran qui n'en sait rien.
 * Le panier ne se vide qu'ensuite, et il est de toute façon reconstructible —
 * la commande, elle, ne l'est pas.
 *
 * `addTicket` **ajoute**, il ne remplace pas : une deuxième commande n'efface
 * pas la première, qui est toujours au bar.
 */
export function usePlaceOrder(venueSlug: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: {
      guestName: string
      guestNote: string | null
      items: Array<{ productId: string; quantity: number }>
    }) => placeOrder({ venueSlug, ...input }),

    onSuccess: (ticket) => {
      addTicket(venueSlug, ticket)
      clearCart(venueSlug)
      queryClient.invalidateQueries({ queryKey: GUEST_ORDER_QUERY_KEY })
    },
  })
}

/**
 * Le client annule sa commande, tant que le bar ne l'a pas prise.
 *
 * N'invalide que le suivi client : la file du bar est rafraîchie par son propre
 * sondage, et ces deux écrans ne sont jamais ouverts par la même personne.
 */
export function useCancelGuestOrder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: cancelGuestOrder,

    /*
      `onSettled` et non `onSuccess`. Un refus vient toujours du même endroit :
      le bar a pris la commande entre la dernière relève et l'appui. L'écran
      affiche donc encore « Reçue par le bar » au moment où il annonce « trop
      tard » — deux affirmations contradictoires côte à côte. Recharger même en
      cas d'échec fait apparaître l'état qui a causé le refus, et le bouton
      disparaît de lui-même.
    */
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: GUEST_ORDER_QUERY_KEY }),
  })
}
