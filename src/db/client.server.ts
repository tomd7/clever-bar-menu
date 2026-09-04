import '@tanstack/react-start/server-only'

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import * as schema from './schema'

import { serverEnv } from '#/env.server'

/**
 * Client Drizzle, créé au premier accès et réutilisé ensuite.
 *
 * Une fonction plutôt qu'un `export const db = drizzle(...)` : la connexion a
 * besoin de `DATABASE_URL`, et l'environnement ne peut pas être lu au
 * chargement du module (voir `src/env.server.ts`). Le cache de module suffit à
 * ce que chaque instance serverless n'ouvre son pool qu'une fois.
 *
 * Ce fichier ne doit jamais être importé depuis un composant ou un `loader` de
 * route : les `loader` sont isomorphes et tournent aussi dans le navigateur.
 * Tout accès aux données passe par un `createServerFn`. Le suffixe `.server.ts`
 * fait respecter cette règle à la construction plutôt qu'à l'exécution.
 */
const create = () => {
  const client = postgres(serverEnv().DATABASE_URL, {
    /**
     * Le pooler Supabase est en mode transaction : deux requêtes successives ne
     * tombent pas forcément sur la même session Postgres, alors qu'une
     * instruction préparée y est attachée. Sans ce réglage, les requêtes
     * échouent de façon intermittente sous charge.
     */
    prepare: false,
  })

  return drizzle(client, {
    schema,
    /**
     * Doit rester identique au `casing` de `drizzle.config.ts`. Les colonnes
     * sont toutes nommées explicitement dans le schéma, mais si l'une ne
     * l'était pas, une divergence entre les deux ferait générer le DDL en
     * `snake_case` et interroger la base en `camelCase`.
     */
    casing: 'snake_case',
  })
}

let cached: ReturnType<typeof create> | undefined

export const db = () => (cached ??= create())
