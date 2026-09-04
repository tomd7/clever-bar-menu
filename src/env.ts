import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

/**
 * Variables d'environnement côté client.
 *
 * Uniquement des valeurs publiques : tout ce qui est déclaré ici finit dans le
 * bundle navigateur. Les secrets et la configuration serveur vivent dans
 * `src/env.server.ts`.
 */
export const env = createEnv({
  /**
   * The prefix that client-side variables must have. This is enforced both at
   * a type-level and at runtime.
   */
  clientPrefix: 'VITE_',

  client: {
    VITE_APP_TITLE: z.string().min(1).optional(),

    /** URL du projet Supabase hébergé (`https://<ref>.supabase.co`). */
    VITE_SUPABASE_URL: z.url(),

    /**
     * Clé publiable Supabase (`sb_publishable_…`, qui remplace l'ancienne clé
     * JWT `anon`). Publique par conception : elle est faite pour être servie au
     * navigateur, et c'est le RLS — pas le secret de la clé — qui protège les
     * données. D'où les policies déclarées dans `src/db/schema.ts` : sans
     * elles, Supabase expose le schéma `public` via PostgREST en lecture *et*
     * en écriture à quiconque lit le bundle.
     *
     * Ne jamais mettre ici la clé secrète (`sb_secret_…`) : le préfixe `VITE_`
     * la ferait entrer dans le bundle navigateur.
     */
    VITE_SUPABASE_ANON_KEY: z.string().min(1),
  },

  /**
   * What object holds the environment variables at runtime. Côté client c'est
   * `import.meta.env`, qui n'expose que les variables préfixées `VITE_`.
   */
  runtimeEnv: import.meta.env,

  /**
   * By default, this library will feed the environment variables directly to
   * the Zod validator.
   *
   * This means that if you have an empty string for a value that is supposed
   * to be a number (e.g. `PORT=` in a ".env" file), Zod will incorrectly flag
   * it as a type mismatch violation. Additionally, if you have an empty string
   * for a value that is supposed to be a string with a default value (e.g.
   * `DOMAIN=` in an ".env" file), the default value will never be applied.
   *
   * In order to solve these issues, we recommend that all new projects
   * explicitly specify this option as true.
   */
  emptyStringAsUndefined: true,
})
