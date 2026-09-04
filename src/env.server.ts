import '@tanstack/react-start/server-only'

import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

/**
 * Variables d'environnement côté serveur.
 *
 * Séparé de `src/env.ts` parce que les deux côtés ne lisent pas la même source :
 * le client lit `import.meta.env`, qui n'expose que les variables préfixées
 * `VITE_`. Une variable serveur déclarée là-bas vaut donc toujours `undefined`.
 *
 * Exposé comme une fonction et non comme un objet : lire `process.env` au
 * chargement du module est faux sur deux axes. Sur les runtimes edge
 * l'environnement est injecté par requête, donc un accès au scope module
 * s'évalue avant qu'il existe ; et une valeur figée à l'import peut se
 * retrouver inlinée dans un bundle. La validation a donc lieu au premier appel
 * — un `DATABASE_URL` manquant fait échouer la première requête, pas le
 * démarrage du processus.
 */
const create = () =>
  createEnv({
    server: {
      /**
       * Chaîne de connexion Postgres (Supabase). Utiliser le **pooler en mode
       * transaction** (port 6543) et non la connexion directe (5432) : chaque
       * requête serverless ouvre sa propre connexion, et Postgres les épuise
       * bien avant que le trafic ne devienne intéressant.
       */
      DATABASE_URL: z.url(),
    },

    runtimeEnv: process.env,

    emptyStringAsUndefined: true,
  })

let cached: ReturnType<typeof create> | undefined

export const serverEnv = () => (cached ??= create())
