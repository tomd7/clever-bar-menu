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
 * The themes a public menu can wear.
 *
 * Constrained text rather than a `pgEnum`, for the reason that already governs
 * `ORDER_STATUSES`: adding a theme must stay a constraint to rewrite, not a
 * type migration `drizzle-kit` cannot produce on its own.
 *
 * `'ardoise'` is the house theme, the one `src/styles/theme.css` paints on
 * `:root`. It is stored like any other and is **not** represented by `null`: it
 * is a theme that carries a name, not the absence of one. The distinction has
 * its counterpart elsewhere in this schema — `products.price_cents` *is*
 * nullable, because "no price shown" is not a price.
 *
 * The same whitelist is written in three places, and they move together: here,
 * in the `venues_theme_allowed` constraint below, and in the blocks of
 * `src/styles/menu-theme.css`. `src/lib/menu-theme.ts` carries the note, and is
 * the copy the browser reads — importing this file into the bundle would drag
 * the server-side persistence in with it.
 */
export const VENUE_THEMES = [
  'ardoise',
  'pelouse',
  'rubis',
  'prune',
  'indigo',
] as const

export type VenueTheme = (typeof VENUE_THEMES)[number]

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
     * La prise de commande est-elle ouverte sur la carte publique ?
     *
     * `false` par défaut, et ce défaut n'est pas une prudence de principe :
     * l'inverse ferait apparaître un bouton « Commander » sur la carte de tous
     * les établissements existants à la minute où la migration passe, sans que
     * personne au bar ne soit prévenu qu'il faut désormais surveiller un écran.
     * L'ouverture est une décision de gérant, elle se prend depuis l'écran des
     * commandes.
     */
    ordersEnabled: boolean('orders_enabled').notNull().default(false),

    /**
     * The public menu's theme — see `VENUE_THEMES`.
     *
     * `not null default 'ardoise'`: existing rows take the house theme, which
     * is exactly what they were already showing before the column existed.
     */
    theme: text('theme').notNull().default('ardoise'),

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

    /**
     * The theme belongs to the catalogue.
     *
     * Same relationship `products_barcode_format` has to `normalizeBarcode`:
     * the constraint restates the shape the client already guarantees. What it
     * catches is the row written from outside the application — a `curl` on
     * PostgREST, a hand fix in Drizzle Studio — not the manager, whom
     * `updateVenue` answers in French before writing anything.
     */
    check(
      'venues_theme_allowed',
      sql`${table.theme} in ('ardoise', 'pelouse', 'rubis', 'prune', 'indigo')`,
    ),

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
     * Serving format — « 25cl », « 50cl », « au fût », « pichet ».
     *
     * Free text, and nullable, which is the resting state: most lines of a bar
     * menu are served one way only, and repeating « 1 verre » on thirty of them
     * would turn an information into noise.
     *
     * A closed enumeration was rejected. A bar's formats are its own — a
     * « demi », a « pichet 50cl », a 4cl measure — and a list would have to be
     * redeployed the day one is missing. The form offers the usual ones as
     * chips (`features/menu/size.ts`); it does not restrict what can be typed.
     *
     * It qualifies the product, it does not price it: two formats of the same
     * beer are two products, exactly as a printed menu lists them. Carrying
     * several formats on one line would mean a table of its own, a cart that
     * points at a format rather than at a product, and a rewritten
     * `place_order` — for a menu that reads the same either way.
     */
    size: text('size'),

    /**
     * Manufacturer's barcode, as a **zero-padded 14-digit GTIN**, or `null`.
     *
     * `null` is the resting state and stays the majority: a coffee, a draught
     * beer and a house cocktail carry no barcode, and nothing on this menu
     * needs one. The column exists for the products that are counted in
     * bottles, so that a delivery can be put away by scanning rather than by
     * hunting for a row.
     *
     * The padded form is not a whim. A UPC-A and its EAN-13 spelling differ by
     * a leading zero while naming the same bottle; stored as read, that bottle
     * pairs twice and neither pairing resolves afterwards. Everything writing
     * this column goes through `normalizeBarcode` in `features/menu/barcode.ts`
     * — the check below only restates the shape that function guarantees, the
     * way `products_stock_quantity_non_negative` restates `parseOptionalStock`.
     *
     * Uniqueness is a trigger, not an index — see `products_barcode_unique`
     * in migration `0015`, and the note on the check below.
     */
    barcode: text('barcode'),

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
    /*
      La forme canonique d'un code-barres, et rien de plus : quatorze chiffres,
      ce que produit `normalizeBarcode`. La clé de contrôle, elle, reste côté
      client — une expression régulière ne sait pas la calculer, et la refaire
      en SQL dupliquerait la règle à l'endroit le moins lisible.

      L'**unicité** n'est pas ici, et pas par choix : elle doit valoir par
      établissement, or `products` ne porte pas `venue_id` — il faut passer par
      `categories`. Une expression d'index doit être `IMMUTABLE`, et toute
      fonction qui remonte la catégorie vers l'établissement est `STABLE` au
      mieux : Postgres refuse l'index. Un unique global, lui, interdirait à deux
      bars du même déploiement de vendre la même bière. D'où le trigger de la
      migration `0015`, qui dit ce qu'un index ne peut pas dire.
    */
    check(
      'products_barcode_format',
      sql`${table.barcode} is null or ${table.barcode} ~ '^[0-9]{14}$'`,
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

/**
 * Les états d'une commande, dans l'ordre où elle les traverse.
 *
 * Du texte contraint plutôt qu'un `pgEnum` : ajouter un état à une énumération
 * Postgres est une migration de type, que `drizzle-kit` ne sait pas produire
 * seul, alors qu'ici c'est une contrainte à réécrire. Le vocabulaire d'un
 * service est exactement le genre de chose qui bouge une fois le produit en
 * salle.
 *
 * `preparing` est le pivot : c'est là que le bar prend la commande à son
 * compte, et donc là que le stock est décompté. `ready` est celui qui compte
 * pour le client — c'est lui qui le fait venir au comptoir.
 */
export const ORDER_STATUSES = [
  'received',
  'preparing',
  'ready',
  'collected',
  'cancelled',
] as const

export type OrderStatus = (typeof ORDER_STATUSES)[number]

/**
 * Commande passée depuis la carte publique, à retirer au comptoir.
 *
 * Elle n'est **jamais écrite ni lue directement** par le client : il est
 * `anon`, et aucune policy ne lui ouvre cette table. Tout passe par deux
 * fonctions `security definer` (migration `0009`) — `place_order` pour
 * déposer, `get_order` pour suivre. C'est le contraire du choix fait pour
 * `adjust_product_stock`, et pour la raison inverse : là il fallait que le RLS
 * s'applique à un compte identifié, ici il faut une porte étroite pour
 * quelqu'un qui n'a aucun droit et ne doit pas en recevoir.
 */
export const orders = pgTable(
  'orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    venueId: uuid('venue_id')
      .notNull()
      .references(() => venues.id, { onDelete: 'cascade' }),

    /**
     * Le prénom donné au comptoir. C'est la référence de la commande : un
     * numéro d'ordre demanderait un compteur par établissement, et un prénom
     * s'appelle à voix haute, ce qu'un numéro fait mal.
     */
    customerName: text('customer_name').notNull(),

    /** Mot du client : « sans glace », « à emporter ». Facultatif. */
    note: text('note'),

    status: text('status').notNull().default('received'),

    /**
     * Qui a annulé, quand la commande l'a été. `null` sinon.
     *
     * Sans cette colonne, une commande disparaîtrait de la file du bar sans que
     * personne sache pourquoi — un barman qui voit s'effacer une ligne qu'il
     * n'a pas touchée suppose une fausse manœuvre d'un collègue, et va
     * demander. C'est le prix de laisser le client annuler.
     *
     * `guest` : le client, depuis la carte, et seulement tant que le bar ne
     * l'a pas prise en charge. `venue` : le comptoir, à n'importe quel moment.
     */
    cancelledBy: text('cancelled_by'),

    /**
     * Total figé à l'envoi, en centimes.
     *
     * Recalculé par `place_order` à partir des prix en base, jamais repris du
     * navigateur — un total transmis par le client est un total négociable.
     * Figé parce qu'une carte se retarife : l'historique doit dire ce qui a été
     * dû ce soir-là, pas ce que coûterait la même commande aujourd'hui.
     *
     * Ne compte que les lignes qui portaient un prix. Les autres — un plat du
     * jour, une suggestion — s'ajustent au comptoir, et `place_order` ne les
     * refuse pas : la carte les affiche déjà sans prix.
     */
    totalCents: integer('total_cents').notNull().default(0),

    /**
     * Le secret qui permet au client de relire sa commande.
     *
     * Sans lui, suivre une commande par son seul identifiant laisserait lire
     * celle du voisin en changeant un chiffre. Il est gardé dans le
     * `localStorage` du téléphone et n'apparaît dans aucune URL.
     */
    accessToken: uuid('access_token').notNull().defaultRandom(),

    ...timestamps,
  },
  (table) => [
    /*
      L'écran du bar lit toujours « les commandes de cet établissement, les
      plus récentes d'abord ». L'index suit cette lecture-là.
    */
    index('orders_venue_id_created_at_idx').on(table.venueId, table.createdAt),

    check(
      'orders_status_valid',
      sql`${table.status} in ('received', 'preparing', 'ready', 'collected', 'cancelled')`,
    ),
    check('orders_total_cents_non_negative', sql`${table.totalCents} >= 0`),
    check(
      'orders_cancelled_by_valid',
      sql`${table.cancelledBy} is null or ${table.cancelledBy} in ('guest', 'venue')`,
    ),

    /*
      Aucune policy pour `anon` : le client passe par les fonctions, jamais par
      la table. Le gérant, lui, lit et fait avancer les siennes.

      Pas d'`insert` non plus, même pour lui : une commande naît d'un client.
      Et pas de `delete` — un historique qui s'efface d'un clic n'est pas un
      historique. Une purge viendra avec la rétention, si elle est demandée.
    */
    pgPolicy('orders_owner_read', {
      for: 'select',
      to: authenticatedRole,
      using: sql`exists (
        select 1 from ${venues}
        where ${venues.id} = ${table.venueId}
          and ${venues.ownerId} = ${authUid}
      )`,
    }),
    pgPolicy('orders_owner_update', {
      for: 'update',
      to: authenticatedRole,
      using: sql`exists (
        select 1 from ${venues}
        where ${venues.id} = ${table.venueId}
          and ${venues.ownerId} = ${authUid}
      )`,
      withCheck: sql`exists (
        select 1 from ${venues}
        where ${venues.id} = ${table.venueId}
          and ${venues.ownerId} = ${authUid}
      )`,
    }),
  ],
)

/**
 * Une ligne de commande.
 *
 * Tout y est **recopié** du produit au moment de l'envoi — nom et prix
 * unitaire. Une commande est une trace, pas une vue : le produit sera renommé,
 * retarifé, retiré de la carte, et l'addition d'hier doit continuer de dire ce
 * qu'elle disait. C'est aussi pourquoi `productId` peut devenir `null`.
 */
export const orderItems = pgTable(
  'order_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),

    /**
     * Le produit d'origine, s'il existe encore. `set null` et non `cascade` :
     * supprimer un produit de la carte ne doit pas amputer les commandes
     * passées. Le lien sert au décompte du stock, le nom recopié à l'affichage.
     */
    productId: uuid('product_id').references(() => products.id, {
      onDelete: 'set null',
    }),

    /** Nom du produit au moment de la commande. */
    name: text('name').notNull(),

    /**
     * Serving format at the time of the order, copied like the name. `null`
     * when the product carried none.
     *
     * Copied rather than read back through `productId`, for the same reason as
     * the name: the line is a trace. But the reason it is copied *at all* is
     * the counter — « Blonde » twice on a ticket, once in 25cl and once in
     * 50cl, is a ticket that has to be guessed at. The format is half of what
     * identifies a line as soon as the menu carries one.
     */
    size: text('size'),

    /** Prix unitaire figé, ou `null` si le produit était sans prix affiché. */
    unitPriceCents: integer('unit_price_cents'),

    quantity: smallint('quantity').notNull(),

    ...timestamps,
  },
  (table) => [
    index('order_items_order_id_idx').on(table.orderId),

    check('order_items_quantity_positive', sql`${table.quantity} > 0`),
    check(
      'order_items_unit_price_cents_non_negative',
      sql`${table.unitPriceCents} is null or ${table.unitPriceCents} >= 0`,
    ),

    /*
      Les lignes suivent leur commande : mêmes droits, retrouvés par
      sous-requête. Elles ne sont jamais modifiées après l'envoi, d'où la seule
      policy de lecture.
    */
    pgPolicy('order_items_owner_read', {
      for: 'select',
      to: authenticatedRole,
      using: sql`exists (
        select 1 from ${orders}
        join ${venues} on ${venues.id} = ${orders.venueId}
        where ${orders.id} = ${table.orderId}
          and ${venues.ownerId} = ${authUid}
      )`,
    }),
  ],
)

export const venuesRelations = relations(venues, ({ many }) => ({
  categories: many(categories),
  orders: many(orders),
}))

export const ordersRelations = relations(orders, ({ one, many }) => ({
  venue: one(venues, {
    fields: [orders.venueId],
    references: [venues.id],
  }),
  items: many(orderItems),
}))

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
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
export type Order = typeof orders.$inferSelect
export type NewOrder = typeof orders.$inferInsert
export type OrderItem = typeof orderItems.$inferSelect
export type NewOrderItem = typeof orderItems.$inferInsert
