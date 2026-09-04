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
  price_cents: number
  image_path: string | null
  is_available: boolean
  position: number
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
          Timestamps | Nullable | 'owner_id' | 'currency'
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
      products: {
        Row: ProductRow
        Insert: Insert<
          ProductRow,
          Timestamps | Nullable | 'position' | 'is_available' | 'image_path'
        >
        Update: Partial<ProductRow>
        Relationships: []
      }
    }
    Views: Record<never, never>
    Functions: Record<never, never>
    Enums: Record<never, never>
    CompositeTypes: Record<never, never>
  }
}

export type Venue = VenueRow

/**
 * Client Supabase du navigateur.
 *
 * Il porte la clé publiable, qui est publique par conception : ce n'est pas
 * elle qui protège les données, ce sont les policies RLS déclarées dans
 * `src/db/schema.ts`. Toute requête partant d'ici est donc exécutée avec les
 * droits de l'utilisateur connecté, jamais plus.
 *
 * Les routes du back-office sont en `ssr: false`, si bien que ce module n'est
 * évalué que dans le navigateur — là où `localStorage` existe pour conserver
 * la session entre deux visites.
 */
export const supabase = createClient<Database>(
  env.VITE_SUPABASE_URL,
  env.VITE_SUPABASE_ANON_KEY,
)
