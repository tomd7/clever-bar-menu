import { defineConfig } from 'drizzle-kit'

/**
 * Configuration de `drizzle-kit` (génération et application des migrations).
 *
 * Ce fichier tourne dans Node via la CLI, hors de Vite : il lit donc
 * directement `process.env` et charge `.env` lui-même. `loadEnvFile` est natif
 * à Node 22, ce qui évite une dépendance à `dotenv`.
 */
try {
  process.loadEnvFile('.env')
} catch {
  // Pas de `.env` local : les variables viennent alors de l'environnement
  // (CI, shell). `drizzle-kit generate` n'a de toute façon pas besoin de
  // `DATABASE_URL`, il travaille uniquement à partir du schéma.
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dbCredentials: {
    /**
     * Les migrations sont du DDL et supportent mal un pooler en mode
     * transaction. `MIGRATION_DATABASE_URL` permet de les faire passer par le
     * session pooler (port 5432) sans changer la connexion applicative, qui
     * elle doit rester sur le pooler transactionnel (6543) pour le serverless.
     * Cette variable n'existe que pour la CLI : elle n'a aucun usage à
     * l'exécution, et n'a donc rien à faire dans `src/env.server.ts`.
     */
    url: process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL!,
  },
  casing: 'snake_case',

  /**
   * `anon`, `authenticated`, `service_role`… appartiennent à Supabase. Sans ce
   * réglage, drizzle-kit les voit référencés par les policies, constate qu'ils
   * ne sont pas déclarés dans le schéma, et génère des `CREATE ROLE` / `DROP
   * ROLE` sur des rôles qu'il ne doit pas toucher.
   */
  entities: {
    roles: { provider: 'supabase' },
  },
  verbose: true,
  strict: true,
})
