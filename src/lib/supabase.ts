import { createClient } from '@supabase/supabase-js'

import { env } from '#/env'

/**
 * Formes des tables telles que PostgREST les renvoie.
 *
 * Écrites à la main, en **snake_case** : `src/db/schema.ts` décrit les mêmes
 * tables mais expose des noms camelCase à Drizzle, alors que l'API REST parle
 * les noms SQL. Les types de Drizzle ne sont donc pas réutilisables ici.
 *
 * C'est une duplication, et donc une dérive possible avec le schéma. Le
 * remplacement prévu est `supabase gen types typescript`, qui génère ce fichier
 * depuis la base réelle — à mettre en place dès que la CLI Supabase est
 * configurée sur le projet.
 */
type VenueRow = {
  id: string
  slug: string
  name: string
  description: string | null
  owner_id: string
  currency: string
  /** La prise de commande est-elle ouverte sur la carte publique ? */
  orders_enabled: boolean
  /** Date d'archivage, ou `null` si l'établissement est actif. */
  deleted_at: string | null
  created_at: string
  updated_at: string
}

type CategoryRow = {
  id: string
  venue_id: string
  name: string
  description: string | null
  position: number
  created_at: string
  updated_at: string
}

type ProductRow = {
  id: string
  category_id: string
  name: string
  description: string | null
  /** Format servi (« 50cl », « au fût »), ou `null` : la carte n'en dit rien. */
  size: string | null
  price_cents: number | null
  image_path: string | null
  is_available: boolean
  /** Niveau restant, ou `null` si le produit n'est pas suivi en stock. */
  stock_quantity: number | null
  /** Seuil d'alerte, ou `null` : le produit n'alerte alors qu'une fois épuisé. */
  low_stock_threshold: number | null
  position: number
  created_at: string
  updated_at: string
}

/**
 * Une commande déposée depuis la carte publique.
 *
 * `access_token` **n'y figure pas**. Le back-office lit ces lignes par
 * PostgREST et n'a aucun usage du secret du client ; le sortir du type est ce
 * qui empêche de l'afficher, de le journaliser ou de le sérialiser dans un
 * cache par inadvertance. Le client, lui, ne lit jamais cette table : il passe
 * par `get_order`, qui le lui redemande.
 */
type OrderRow = {
  id: string
  venue_id: string
  customer_name: string
  note: string | null
  status: OrderStatusValue
  /** Qui a annulé, si la commande l'a été : le client ou le comptoir. */
  cancelled_by: 'guest' | 'venue' | null
  total_cents: number
  created_at: string
  updated_at: string
}

/**
 * Les états d'une commande. Recopiés depuis `src/db/schema.ts`, qui ne peut
 * pas servir de source ici : ce fichier décrit ce que PostgREST renvoie, en
 * `snake_case`, et importer le schéma Drizzle ferait entrer la persistance
 * serveur dans le bundle du navigateur.
 */
type OrderStatusValue =
  'received' | 'preparing' | 'ready' | 'collected' | 'cancelled'

type OrderItemRow = {
  id: string
  order_id: string
  /** `null` si le produit a été supprimé de la carte depuis. */
  product_id: string | null
  name: string
  /** Format recopié à l'envoi, comme le nom : la ligne est une trace. */
  size: string | null
  unit_price_cents: number | null
  quantity: number
  created_at: string
  updated_at: string
}

/**
 * `owner_id`, `id` et les dates ont une valeur par défaut en base : elles sont
 * donc facultatives à l'insertion. `owner_id` en particulier vaut
 * `auth.uid()` — inutile de le renseigner depuis le client, et la policy RLS
 * refuserait de toute façon une autre valeur.
 */
type Insert<TRow, TOptional extends keyof TRow> = Omit<TRow, TOptional> &
  Partial<Pick<TRow, TOptional>>

type Timestamps = 'id' | 'created_at' | 'updated_at'

/**
 * Une colonne nullable est facultative à l'insertion au même titre qu'une
 * colonne à valeur par défaut : Postgres y mettra `null`.
 */
type Nullable = 'description'

export type Database = {
  public: {
    Tables: {
      venues: {
        Row: VenueRow
        Insert: Insert<
          VenueRow,
          | Timestamps
          | Nullable
          | 'owner_id'
          | 'currency'
          | 'deleted_at'
          | 'orders_enabled'
        >
        Update: Partial<VenueRow>
        Relationships: []
      }
      categories: {
        Row: CategoryRow
        Insert: Insert<CategoryRow, Timestamps | Nullable | 'position'>
        Update: Partial<CategoryRow>
        Relationships: []
      }
      orders: {
        Row: OrderRow
        /*
          Pas d'`Insert` utilisable : aucune policy n'ouvre l'écriture, une
          commande naît de `place_order`. Le type reste déclaré parce que
          `supabase-js` l'exige, avec la forme que la fonction produit.
        */
        Insert: Insert<
          OrderRow,
          Timestamps | 'note' | 'status' | 'total_cents' | 'cancelled_by'
        >
        /*
          Le gérant ne change qu'une chose : où en est la commande — et, quand
          il l'annule, qu'il en est l'auteur. Le client, lui, ne passe jamais
          par la table : `cancel_order` écrit `cancelled_by` pour lui.
        */
        Update: Pick<
          Partial<OrderRow>,
          'status' | 'cancelled_by' | 'updated_at'
        >
        Relationships: []
      }
      order_items: {
        Row: OrderItemRow
        Insert: Insert<
          OrderItemRow,
          Timestamps | 'product_id' | 'size' | 'unit_price_cents'
        >
        /* Une ligne de commande ne se modifie pas : c'est une trace. */
        Update: Record<never, never>
        Relationships: []
      }
      products: {
        Row: ProductRow
        Insert: Insert<
          ProductRow,
          | Timestamps
          | Nullable
          | 'position'
          | 'is_available'
          | 'image_path'
          | 'size'
          | 'price_cents'
          | 'stock_quantity'
          | 'low_stock_threshold'
        >
        Update: Partial<ProductRow>
        Relationships: []
      }
    }
    Views: Record<never, never>
    Functions: {
      /**
       * Décompte atomique du stock (migration `0007`).
       *
       * Une fonction plutôt qu'un `update` parce que PostgREST ne sait pas
       * écrire `stock_quantity = stock_quantity - 1` : sans elle, deux
       * appareils derrière le même bar perdraient un décompte sur deux. Elle
       * renvoie le niveau restant, déjà planché à zéro.
       */
      adjust_product_stock: {
        Args: { product_id: string; delta: number }
        Returns: number
      }

      /**
       * Dépose une commande (migration `0009`). Appelable sans compte.
       *
       * `security definer` : `orders` n'a aucune policy pour `anon`, et cette
       * fonction est la seule porte. Elle relit les prix en base — le client
       * n'envoie que des identifiants et des quantités.
       */
      place_order: {
        Args: {
          venue_slug: string
          guest_name: string
          guest_note: string | null
          items: Array<{ product_id: string; quantity: number }>
        }
        Returns: { id: string; access_token: string }
      }

      /**
       * Relit une commande pour le client qui la suit.
       *
       * Renvoie `null` — et non une erreur — si le jeton ne correspond pas :
       * une erreur confirmerait que la commande existe.
       */
      get_order: {
        Args: { lookup_id: string; lookup_token: string }
        Returns: {
          id: string
          customer_name: string
          note: string | null
          status: OrderStatusValue
          total_cents: number
          created_at: string
          updated_at: string
          items: Array<{
            id: string
            name: string
            size: string | null
            unit_price_cents: number | null
            quantity: number
          }>
        } | null
      }

      /**
       * Le bar prend la commande : passage en préparation **et** décompte du
       * stock, dans la même transaction.
       *
       * `security invoker`, contrairement aux deux précédentes : c'est le RLS
       * qui vérifie que la commande appartient à l'appelant.
       */
      accept_order: {
        Args: { target_id: string }
        Returns: undefined
      }

      /**
       * Le client annule sa propre commande (migration `0011`).
       *
       * N'agit que sur une commande encore en attente : passé l'acceptation,
       * le stock est décompté et le verre est en train d'être servi. Lève un
       * message unique pour « trop tard », « mauvais jeton » et « inexistante ».
       */
      cancel_order: {
        Args: { lookup_id: string; lookup_token: string }
        Returns: undefined
      }
    }
    Enums: Record<never, never>
    CompositeTypes: Record<never, never>
  }
}

export type Venue = VenueRow
export type Category = CategoryRow
export type Product = ProductRow
export type Order = OrderRow
export type OrderItem = OrderItemRow
export type OrderStatus = OrderStatusValue

/**
 * Client Supabase du navigateur.
 *
 * Il porte la clé publiable, qui est publique par conception : ce n'est pas
 * elle qui protège les données, ce sont les policies RLS déclarées dans
 * `src/db/schema.ts`. Toute requête partant d'ici est donc exécutée avec les
 * droits de l'utilisateur connecté, jamais plus.
 *
 * Ce module est évalué **des deux côtés**. Le back-office est en `ssr: false`
 * et ne s'exécute que dans le navigateur, où `localStorage` conserve la session
 * entre deux visites ; la carte publique, elle, est rendue au serveur.
 *
 * Ce client est un singleton partagé par toutes les requêtes du serveur, ce qui
 * serait dangereux s'il portait une session : l'identité d'un visiteur pourrait
 * fuir vers le suivant. Ce n'est pas le cas — la carte publique ne lit qu'en
 * `anon`, sans jamais s'authentifier, et personne ne se connecte côté serveur.
 * Ouvrir une session serveur imposerait de créer un client par requête.
 */
export const supabase = createClient<Database>(
  env.VITE_SUPABASE_URL,
  env.VITE_SUPABASE_ANON_KEY,
)
