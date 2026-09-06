import { queryOptions } from '@tanstack/react-query'

import { describeError } from '#/lib/postgrest-error'
import { isOpenOrder } from '#/features/orders/status'
import { supabase } from '#/lib/supabase'

import type { OrderStatus } from '#/lib/supabase'
import type { OrderTicket } from '#/features/orders/ticket'

/**
 * Côté client : déposer une commande, puis la suivre.
 *
 * Séparé de `api.ts` comme `public-api.ts` l'est de `api.ts` dans
 * `features/menu`, et pour une raison plus forte encore : ces deux appels
 * s'exécutent **sans compte**, et ils sont les seuls que `anon` puisse faire
 * sur les commandes. Tout le reste de ce domaine lui est fermé — `orders` et
 * `order_items` n'ont aucune policy pour lui.
 */

/** Une commande telle que son client la relit. */
export type GuestOrder = {
  id: string
  customerName: string
  note: string | null
  status: OrderStatus
  totalCents: number
  createdAt: string
  updatedAt: string
  items: Array<{
    id: string
    name: string
    unitPriceCents: number | null
    quantity: number
  }>
}

/**
 * La commande suivie n'existe plus, ou le jeton ne correspond pas.
 *
 * Les deux cas sont volontairement confondus, ici comme dans la fonction SQL :
 * distinguer « elle n'existe pas » de « ce n'est pas la vôtre » dirait à qui
 * essaie des identifiants au hasard lesquels valent la peine d'insister.
 */
export class OrderNotFoundError extends Error {
  constructor() {
    super("Cette commande n'est plus suivie.")
  }
}

/**
 * Dépose une commande.
 *
 * Ne transmet que des identifiants de produits et des quantités. Ni les prix,
 * ni les noms, ni le total : `place_order` les relit en base. Un total envoyé
 * par le navigateur est un total négociable, et cette fonction est ouverte à
 * qui possède la clé publiable — c'est-à-dire à tout le monde.
 */
export async function placeOrder(input: {
  venueSlug: string
  guestName: string
  guestNote: string | null
  items: Array<{ productId: string; quantity: number }>
}): Promise<OrderTicket> {
  const { data, error } = await supabase.rpc('place_order', {
    venue_slug: input.venueSlug,
    guest_name: input.guestName,
    guest_note: input.guestNote,
    items: input.items.map((line) => ({
      product_id: line.productId,
      quantity: line.quantity,
    })),
  })

  if (error) throw new Error(describeError(error))

  /*
    Pas de garde sur `data` : `place_order` renvoie son objet ou lève. Un
    `if (!data)` serait du code mort, et le typage le dit — mieux vaut s'en
    remettre à la fonction SQL, qui est le seul endroit où la règle est vraie.
  */
  return { id: data.id, accessToken: data.access_token }
}

/**
 * Relit une commande à partir de son ticket.
 *
 * Le jeton part dans le corps de l'appel, jamais dans l'URL — c'est la moitié
 * de ce qui protège la commande, l'autre étant que `orders` est fermée à
 * `anon`.
 */
export async function fetchOrder(ticket: OrderTicket): Promise<GuestOrder> {
  const { data, error } = await supabase.rpc('get_order', {
    lookup_id: ticket.id,
    lookup_token: ticket.accessToken,
  })

  if (error) throw new Error(describeError(error))
  if (!data) throw new OrderNotFoundError()

  return {
    id: data.id,
    customerName: data.customer_name,
    note: data.note,
    status: data.status,
    totalCents: data.total_cents,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    items: data.items.map((item) => ({
      id: item.id,
      name: item.name,
      unitPriceCents: item.unit_price_cents,
      quantity: item.quantity,
    })),
  }
}

/**
 * Le client annule sa commande.
 *
 * Le jeton repart par le même chemin que pour la lecture : en corps de requête,
 * jamais dans une URL. La fenêtre — avant acceptation seulement — est vérifiée
 * **en SQL** et pas seulement à l'affichage ; masquer un bouton n'a jamais fermé
 * une API, et ici l'écran peut avoir quinze secondes de retard sur le comptoir.
 */
export async function cancelGuestOrder(ticket: OrderTicket): Promise<void> {
  const { error } = await supabase.rpc('cancel_order', {
    lookup_id: ticket.id,
    lookup_token: ticket.accessToken,
  })

  if (error) throw new Error(describeError(error))
}

export const GUEST_ORDER_QUERY_KEY = ['guest-order'] as const

/**
 * Le suivi côté client, relevé toutes les quinze secondes.
 *
 * Plus lâche que la file du bar, et volontairement : ce téléphone attend une
 * seule commande, il est sur des données mobiles, et quinze secondes de retard
 * sur un « c'est prêt » ne se remarquent pas dans une salle où il faut de
 * toute façon se lever.
 *
 * Le sondage **s'arrête** dès que la commande est close. Une commande
 * récupérée ne bougera plus ; continuer à la relever tiendrait la page éveillée
 * pour rien.
 */
const GUEST_POLL_INTERVAL_MS = 15_000

/**
 * Une requête par commande suivie.
 *
 * Les appelants passent par `useQueries` sur la liste des tickets : un client
 * peut en avoir plusieurs en vol, et chacune a son propre rythme de relève —
 * celle qui vient d'être récupérée cesse d'être sondée pendant que la suivante
 * continue.
 */
export function guestOrderQueryOptions(ticket: OrderTicket) {
  return queryOptions({
    queryKey: [...GUEST_ORDER_QUERY_KEY, ticket.id],
    queryFn: () => fetchOrder(ticket),

    refetchInterval: (query) => {
      const order = query.state.data
      if (!order) return false
      return isOpenOrder(order.status) ? GUEST_POLL_INTERVAL_MS : false
    },

    /*
      Une commande introuvable est définitive : le ticket est périmé, ou il a
      été bricolé. Réessayer trois fois ne ferait que retarder l'écran qui
      propose de repartir d'un panier vide.
    */
    retry: (failureCount, error) =>
      !(error instanceof OrderNotFoundError) && failureCount < 3,
  })
}
