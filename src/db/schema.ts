import {
  boolean,
  check,
  index,
  integer,
  pgPolicy,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { relations, sql } from 'drizzle-orm'
import { anonRole, authUid, authenticatedRole } from 'drizzle-orm/supabase'

/**
 * Lecture publique — la carte est faite pour être lue par n'importe qui, sans
 * compte : c'est tout l'intérêt du QR code sur la table.
 *
 * Déclarer une policy suffit à ce que Drizzle active `ROW LEVEL SECURITY` sur
 * la table. C'est indispensable, et pas seulement une bonne pratique : Supabase
 * expose automatiquement le schéma `public` via PostgREST et accorde des droits
 * aux rôles `anon` et `authenticated`. Une table sans RLS y est donc lisible
 * **et modifiable** par quiconque possède la clé publiable, laquelle est par
 * conception présente dans le bundle navigateur.
 *
 * Aucune policy d'écriture n'est déclarée : les écritures sont donc impossibles
 * avec la clé publiable. Le back-office écrira via Drizzle, qui se connecte en
 * propriétaire de la base et n'est pas soumis au RLS.
 */
const publicRead = (name: string) =>
  pgPolicy(name, {
    for: 'select',
    to: [anonRole, authenticatedRole],
    using: sql`true`,
  })

/**
 * Écriture réservée au propriétaire de l'établissement.
 *
 * `owns` est l'expression qui rattache la ligne à son propriétaire. Elle est
 * passée à la fois en `using` (quelles lignes existantes sont visées par un
 * UPDATE/DELETE) et en `withCheck` (à quoi doit ressembler la ligne après un
 * INSERT/UPDATE) : sans le second, on pourrait céder sa propre ligne à
 * quelqu'un d'autre en modifiant `owner_id`.
 *
 * `authUid` s'écrit déjà `(select auth.uid())`, et cet enrobage compte :
 * Postgres met alors le résultat en cache pour toute la requête (InitPlan) au
 * lieu de le réévaluer ligne à ligne. C'est la différence entre un scan correct
 * et un scan quadratique sur une carte un peu fournie.
 */
const ownerWrite = (name: string, owns: ReturnType<typeof sql>) => [
  pgPolicy(`${name}_owner_insert`, {
    for: 'insert',
    to: authenticatedRole,
    withCheck: owns,
  }),
  pgPolicy(`${name}_owner_update`, {
    for: 'update',
    to: authenticatedRole,
    using: owns,
    withCheck: owns,
  }),
  pgPolicy(`${name}_owner_delete`, {
    for: 'delete',
    to: authenticatedRole,
    using: owns,
  }),
]

/**
 * Colonnes de dates communes à toutes les tables.
 *
 * `updatedAt` est tenu à jour côté application (`$onUpdate`) plutôt que par un
 * trigger Postgres : la logique reste visible dans ce fichier et suit les
 * migrations, au prix d'être contournable par un `UPDATE` écrit à la main.
 */
const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}

/**
 * Établissement — un bar ou un café. Racine de tout le cloisonnement
 * multi-établissements : catégories et produits n'existent qu'à travers lui.
 */
export const venues = pgTable(
  'venues',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    /**
     * Identifiant public, celui qui apparaît dans l'URL encodée par le QR code
     * (`/m/le-comptoir`). Séparé de l'`id` pour que l'URL reste lisible et
     * qu'un renommage n'expose pas la clé primaire.
     */
    slug: text('slug').notNull(),

    name: text('name').notNull(),
    description: text('description'),

    /**
     * Propriétaire de l'établissement, en pratique un `auth.users.id` Supabase.
     * Volontairement sans clé étrangère : le schéma `auth` appartient à
     * Supabase et n'est pas géré par ces migrations — une FK vers lui rendrait
     * `drizzle-kit` propriétaire d'une table qu'il ne décrit pas.
     */
    ownerId: uuid('owner_id')
      .notNull()
      /**
       * `auth.uid()` nu, sans le `(select ...)` qui enrobe `authUid` : Postgres
       * refuse toute sous-requête dans une expression `DEFAULT`
       * (`0A000: cannot use subquery in DEFAULT expression`). L'enrobage n'a
       * de sens que dans les policies, où il fait mettre le résultat en cache
       * pour la requête entière.
       */
      .default(sql`auth.uid()`),

    /** Code ISO 4217, appliqué à tous les prix de l'établissement. */
    currency: text('currency').notNull().default('EUR'),

    /**
     * Archivage — suppression logique.
     *
     * Une date plutôt qu'un booléen : elle répond à « archivé ? » comme à
     * « depuis quand ? », ce qu'un drapeau ne sait pas faire. `null` signifie
     * actif.
     *
     * La ligne reste en base avec sa carte, ses photos et son slug. C'est ce
     * qui rend la restauration possible, et c'est aussi pourquoi le slug reste
     * réservé : `venues_slug_unique` ne connaît pas l'archivage, donc un
     * établissement archivé continue d'occuper son adresse. Une contrainte
     * partielle libérerait le slug, mais ferait échouer une restauration
     * lorsque le nom a été repris entre-temps — un échec bien plus déroutant.
     */
    deletedAt: timestamp('deleted_at', { withTimezone: true }),

    ...timestamps,
  },
  (table) => [
    uniqueIndex('venues_slug_unique').on(table.slug),
    index('venues_owner_id_idx').on(table.ownerId),

    /**
     * Lecture publique : les établissements actifs seulement.
     *
     * Le filtre est dans la policy et non dans les requêtes : la carte publique
     * d'un établissement archivé doit disparaître même si un appel oublie la
     * condition, et c'est Postgres qui doit le garantir.
     */
    pgPolicy('venues_public_read', {
      for: 'select',
      to: [anonRole, authenticatedRole],
      using: sql`${table.deletedAt} is null`,
    }),

    /**
     * Un propriétaire lit les siens, archivés compris.
     *
     * Sans cette seconde policy permissive, archiver un établissement le
     * rendrait invisible à son propre gérant — donc impossible à restaurer, et
     * les policies d'écriture des catégories, qui vérifient l'établissement par
     * sous-requête, cesseraient de le trouver.
     */
    pgPolicy('venues_owner_read', {
      for: 'select',
      to: authenticatedRole,
      using: sql`${authUid} = ${table.ownerId}`,
    }),

    ...ownerWrite('venues', sql`${authUid} = ${table.ownerId}`),
  ],
)

/**
 * Catégorie de la carte (« Bières pression », « Cocktails »…).
 */
export const categories = pgTable(
  'categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    venueId: uuid('venue_id')
      .notNull()
      .references(() => venues.id, { onDelete: 'cascade' }),

    name: text('name').notNull(),
    description: text('description'),

    /**
     * Ordre d'affichage dans la carte. Pas de contrainte d'unicité : un
     * réordonnancement échangerait deux positions et violerait la contrainte
     * en cours de transaction. L'ordre est départagé par `name` en cas d'égalité.
     */
    position: smallint('position').notNull().default(0),

    ...timestamps,
  },
  (table) => [
    index('categories_venue_id_position_idx').on(table.venueId, table.position),
    publicRead('categories_public_read'),
    ...ownerWrite(
      'categories',
      sql`exists (
        select 1 from ${venues}
        where ${venues.id} = ${table.venueId}
          and ${venues.ownerId} = ${authUid}
      )`,
    ),
  ],
)

/**
 * Produit d'une catégorie.
 */
export const products = pgTable(
  'products',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),

    name: text('name').notNull(),
    description: text('description'),

    /**
     * Prix dans la plus petite unité de la devise (2450 = 24,50 €).
     * Un entier plutôt qu'un flottant : aucun arrondi ne peut se glisser dans
     * un total. La devise vit sur l'établissement, pas ici.
     *
     * Nullable : tout ne se tarife pas à l'avance — un plat du jour, une
     * suggestion à l'ardoise, un produit dont le prix dépend de l'arrivage.
     * `null` signifie « pas de prix affiché », ce qui est distinct de `0`, qui
     * reste un prix valide pour un article offert.
     */
    priceCents: integer('price_cents'),

    /**
     * Chemin de la photo dans le bucket Supabase Storage, pas une URL complète :
     * l'URL dépend du projet et de la politique d'accès, et changerait à chaque
     * migration d'environnement.
     */
    imagePath: text('image_path'),

    /**
     * Rupture décidée à la main : masque le produit sur la carte publique.
     *
     * Distinct de l'épuisement du stock, qui se déduit de `stockQuantity`. Un
     * gérant retire un produit pour des raisons qu'aucun compteur ne connaît —
     * la machine est en panne, le fournisseur a changé, la recette ne suit
     * plus. Écraser ce drapeau à chaque fois qu'un stock retombe à zéro ferait
     * réapparaître, à la livraison suivante, un produit que personne n'avait
     * demandé à remettre.
     */
    isAvailable: boolean('is_available').notNull().default(true),

    /**
     * Niveau de stock restant, ou `null` si le produit n'est pas suivi.
     *
     * `null` est l'état par défaut, et c'est le bon : la plupart des lignes
     * d'une carte de bar n'ont pas de stock fini à l'échelle d'un service — un
     * café, une pression au fût, un plat du jour. Le suivi s'active produit par
     * produit, sur ceux qui se comptent en bouteilles.
     *
     * `0` signifie « épuisé » et n'est donc pas la même chose que `null` : le
     * premier masque le produit de la carte publique, le second ne dit rien.
     */
    stockQuantity: integer('stock_quantity'),

    /**
     * Niveau à partir duquel le stock est signalé comme bas.
     *
     * `null` = pas de seuil : le produit n'alerte qu'une fois épuisé. Le seuil
     * n'a de sens que sur un produit suivi ; sur les autres il est ignoré
     * plutôt qu'interdit, ce qui éviterait au formulaire d'imposer un ordre de
     * saisie pour une contrainte que personne ne peut violer par accident.
     */
    lowStockThreshold: integer('low_stock_threshold'),

    position: smallint('position').notNull().default(0),

    ...timestamps,
  },
  (table) => [
    index('products_category_id_position_idx').on(
      table.categoryId,
      table.position,
    ),

    /*
      Un stock négatif n'est pas une valeur basse, c'est une incohérence : il
      ne pourrait venir que d'un décompte concurrent mal ordonné. La fonction
      `adjust_product_stock` (migration 0007) plancher déjà à zéro ; ces
      contraintes sont le garde-fou de tout ce qui l'écrirait autrement, y
      compris un appel direct à PostgREST.
    */
    check(
      'products_stock_quantity_non_negative',
      sql`${table.stockQuantity} is null or ${table.stockQuantity} >= 0`,
    ),
    check(
      'products_low_stock_threshold_non_negative',
      sql`${table.lowStockThreshold} is null or ${table.lowStockThreshold} >= 0`,
    ),
    /**
     * Volontairement sans filtre sur `is_available` ni sur `stock_quantity` :
     * masquer une rupture est une décision d'affichage, elle est prise dans la
     * requête de la carte. La mettre ici casserait la lecture du back-office,
     * qui passe par la même clé publiable, et de façon difficile à diagnostiquer
     * — un produit épuisé disparaîtrait de l'écran qui sert justement à le
     * réapprovisionner.
     */
    publicRead('products_public_read'),
    ...ownerWrite(
      'products',
      sql`exists (
        select 1 from ${categories}
        join ${venues} on ${venues.id} = ${categories.venueId}
        where ${categories.id} = ${table.categoryId}
          and ${venues.ownerId} = ${authUid}
      )`,
    ),
  ],
)

export const venuesRelations = relations(venues, ({ many }) => ({
  categories: many(categories),
}))

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  venue: one(venues, {
    fields: [categories.venueId],
    references: [venues.id],
  }),
  products: many(products),
}))

export const productsRelations = relations(products, ({ one }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
}))

export type Venue = typeof venues.$inferSelect
export type NewVenue = typeof venues.$inferInsert
export type Category = typeof categories.$inferSelect
export type NewCategory = typeof categories.$inferInsert
export type Product = typeof products.$inferSelect
export type NewProduct = typeof products.$inferInsert
