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

    /**
     * Une seule connexion par instance.
     *
     * `postgres` en ouvre dix par défaut, ce qui est le bon réglage pour un
     * serveur long — une instance sert alors plusieurs requêtes de front. En
     * serverless c'est l'inverse : chaque instance traite **une** requête à la
     * fois, et les neuf autres connexions ne servent qu'à occuper des places
     * dans le pooler, que toutes les instances chaudes se partagent. Le
     * plafond se manifeste par des « remaining connection slots are reserved »
     * intermittents sous charge, c'est-à-dire au pire moment.
     *
     * Le réglage n'avait aucun effet tant que rien n'appelait `db()` à
     * l'exécution ; le catalogue de boissons est ce qui l'a rendu réel.
     */
    max: 1,

    /**
     * Une connexion inutilisée est refermée au bout de vingt secondes plutôt
     * que gardée : une instance serverless gelée entre deux requêtes tient
     * sinon une place que personne n'occupe.
     */
    idle_timeout: 20,
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
