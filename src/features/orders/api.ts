import { queryOptions } from '@tanstack/react-query'

import { describeError } from '#/lib/postgrest-error'
import { supabase } from '#/lib/supabase'

import type { Order, OrderItem, OrderStatus, Venue } from '#/lib/supabase'

/**
 * Côté bar : lire la file et la faire avancer.
 *
 * Le client, lui, ne passe jamais par ici — il n'a aucun droit sur ces tables
 * et tout ce qui le concerne est dans `public-api.ts`.
 */

/** Une commande et ses lignes, telles que l'écran du bar les affiche. */
export type OrderWithItems = Order & { items: Array<OrderItem> }

export type OrderBoard = {
  venue: Venue
  orders: Array<OrderWithItems>
}

/**
 * L'établissement demandé n'existe pas.
 *
 * Même distinction que `VenueNotFoundError` dans `features/menu` : la base a
 * répondu, elle a répondu « rien », et réessayer n'y changera rien. Écrite
 * deux fois plutôt qu'importée — la partager obligerait `features/orders` à
 * importer `features/menu`, ce que la règle interdit, et la descendre dans
 * `lib/` mettrait un objet de domaine dans une couche qui n'en porte pas.
 */
export class VenueNotFoundError extends Error {
  constructor() {
    super("Cet établissement n'existe pas.")
  }
}

/**
 * Combien de commandes l'écran garde en mémoire.
 *
 * Une seule requête, les plus récentes d'abord, et le partage entre « en
 * cours » et « historique » se fait à l'affichage. Deux requêtes — les
 * ouvertes sans limite, les closes limitées — seraient plus exactes et
 * doubleraient le trafic d'un écran qui se rafraîchit toutes les dix secondes.
 *
 * Ce que ce plafond coûte : au-delà de cent commandes récentes, la queue de
 * l'historique tombe. Ce qu'il ne coûte pas : une commande en cours ne peut
 * pas disparaître sans que cent autres soient passées après elle, ce qui, pour
 * une commande qu'on est censé servir dans le quart d'heure, n'arrive pas.
 */
const RECENT_ORDERS_LIMIT = 100

/**
 * Toutes les commandes récentes d'un établissement, avec leurs lignes.
 *
 * Trois requêtes plutôt qu'un `select` imbriqué, pour la même raison que
 * `fetchMenu` : PostgREST sait embarquer les relations, mais leur typage
 * demande des métadonnées que notre `Database` écrit à la main ne porte pas.
 */
export async function fetchOrders(venueSlug: string): Promise<OrderBoard> {
  const venueResult = await supabase
    .from('venues')
    .select('*')
    .eq('slug', venueSlug)
    .maybeSingle()

  if (venueResult.error) throw new Error(describeError(venueResult.error))
  if (!venueResult.data) throw new VenueNotFoundError()

  const venue = venueResult.data

  const ordersResult = await supabase
    .from('orders')
    .select('*')
    .eq('venue_id', venue.id)
    .order('created_at', { ascending: false })
    .limit(RECENT_ORDERS_LIMIT)

  if (ordersResult.error) throw new Error(describeError(ordersResult.error))

  const orders = ordersResult.data
  if (orders.length === 0) return { venue, orders: [] }

  const itemsResult = await supabase
    .from('order_items')
    .select('*')
    .in(
      'order_id',
      orders.map((order) => order.id),
    )
    .order('created_at', { ascending: true })

  if (itemsResult.error) throw new Error(describeError(itemsResult.error))

  const byOrder = new Map<string, Array<OrderItem>>()
  for (const item of itemsResult.data) {
    const bucket = byOrder.get(item.order_id)
    if (bucket) bucket.push(item)
    else byOrder.set(item.order_id, [item])
  }

  return {
    venue,
    orders: orders.map((order) => ({
      ...order,
      items: byOrder.get(order.id) ?? [],
    })),
  }
}

export const ORDERS_QUERY_KEY = ['orders'] as const

/**
 * Combien de temps entre deux relèves de la file.
 *
 * Dix secondes : assez court pour qu'un client ne s'étonne pas d'attendre,
 * assez long pour qu'un service de trois heures ne fasse pas mille appels.
 * C'est un rythme, pas une garantie — la commande apparaît quand elle
 * apparaît, et le bar le sait.
 */
const POLL_INTERVAL_MS = 10_000

export function ordersQueryOptions(venueSlug: string) {
  return queryOptions({
    queryKey: [...ORDERS_QUERY_KEY, venueSlug],
    queryFn: () => fetchOrders(venueSlug),

    /*
      Le rafraîchissement s'arrête quand l'onglet passe derrière : personne ne
      lit une file qu'il ne regarde pas, et le retour au premier plan
      redéclenche une relève immédiate. C'est le défaut de React Query, et il
      est bon ici — le laisser tourner en arrière-plan ne ferait que consommer
      la batterie de la tablette du comptoir.
    */
    refetchInterval: POLL_INTERVAL_MS,

    /*
      Même raisonnement que `menuQueryOptions` : un slug introuvable est une
      réponse définitive, et une erreur qui n'a jamais fini de réessayer n'est
      jamais affichée.
    */
    retry: (failureCount, error) =>
      !(error instanceof VenueNotFoundError) && failureCount < 3,
  })
}

/**
 * Exécute une écriture et traduit son échec. Jumeau de celui de
 * `features/menu/api.ts` — le partager voudrait dire faire descendre dans
 * `lib/` un helper d'une ligne dont les deux copies ne divergeront pas.
 */
async function write(
  query: PromiseLike<{ error: { code?: string; message: string } | null }>,
): Promise<void> {
  const { error } = await query
  if (error) throw new Error(describeError(error))
}

/**
 * Le bar prend la commande : passage en préparation **et** décompte du stock.
 *
 * Passe par `accept_order` (migration `0009`) et non par un `update` : les
 * deux effets doivent tomber ensemble, et le décompte de dix lignes de
 * commande ferait autrement dix allers-retours dont certains pourraient
 * échouer au milieu. La fonction est `security invoker` — c'est le RLS qui
 * vérifie que la commande est bien celle de l'appelant.
 */
export async function acceptOrder(orderId: string): Promise<void> {
  const { error } = await supabase.rpc('accept_order', { target_id: orderId })
  if (error) throw new Error(describeError(error))
}

/**
 * Fait avancer une commande déjà acceptée, ou l'annule.
 *
 * Un `update` ordinaire suffit : contrairement à l'acceptation, ces passages
 * ne touchent à rien d'autre qu'à la ligne elle-même.
 *
 * **Annuler ne recrédite pas le stock.** Une commande annulée après
 * acceptation a souvent déjà été servie à moitié, et remonter les niveaux
 * inventerait des bouteilles que personne n'a. Le geste reste au gérant, sur
 * l'écran Stock, qui est fait pour ça.
 */
export async function setOrderStatus(
  orderId: string,
  status: OrderStatus,
): Promise<void> {
  await write(
    supabase
      .from('orders')
      .update({
        status,
        /*
          Le comptoir signe ses annulations, comme `cancel_order` signe celles
          du client. Sans cela une ligne disparaîtrait de la file sans que
          personne sache qui l'a retirée. `null` sur les autres passages :
          repasser une commande en préparation après l'avoir annulée doit
          effacer la signature, sinon l'historique garderait une annulation qui
          n'a plus eu lieu.
        */
        cancelled_by: status === 'cancelled' ? 'venue' : null,
        /*
          No `updated_at` here. It used to be sent from the browser's clock,
          which drifts from the database's; the `orders_set_updated_at` trigger
          (migration 0018) now stamps every real change with the server's
          `now()`, and a value sent from here would only be overwritten.
        */
      })
      .eq('id', orderId),
  )
}

/**
 * Ouvre ou ferme la prise de commande d'un établissement.
 *
 * Le drapeau est lu deux fois : ici pour l'affichage, et dans `place_order`
 * qui refuse une commande sur un établissement fermé. Cacher le bouton n'a
 * jamais fermé une API.
 */
export async function setOrdersEnabled(
  venueId: string,
  enabled: boolean,
): Promise<void> {
  await write(
    supabase
      .from('venues')
      .update({ orders_enabled: enabled })
      .eq('id', venueId),
  )
}
