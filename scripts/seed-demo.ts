/**
 * Refills the public demonstration venue with fictional data.
 *
 * The demo account (`demo@cbm.be` → `/m/chez-lambert`) is shared, public and
 * announced in the README as resettable without notice. This script is what
 * performs that reset: it wipes the demo venue's menu and orders, then writes a
 * complete fictional café back — a menu with prices, sizes and descriptions,
 * tracked stock with low levels and one shortage, real-shaped barcodes, and a
 * queue of orders sitting in front of an older history.
 *
 * Run with `npm run db:seed:demo`.
 *
 * **It connects as the database owner and therefore bypasses RLS.** That is the
 * point rather than an oversight: the script holds no Supabase session, and
 * `orders` carries no `insert` policy at all — not even for the manager, since
 * an order is born from a customer. Writing this history is only possible from
 * below the policies. The counterpart is that the script can delete anything,
 * which is why it refuses to run against a venue that is not the demo one (see
 * `resolveDemoVenue`).
 */

import { eq, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

// Relative paths, not the `#/` alias the application uses: that alias is
// resolved by Vite and by `tsconfig.json`, and Node rejects `#/…` outright as
// an internal imports specifier. This file is run by `node` alone.
import * as schema from '../src/db/schema.ts'
import { normalizeBarcode } from '../src/features/menu/barcode.ts'

import type { OrderStatus } from '../src/db/schema.ts'

/**
 * The venue this script is allowed to touch, and the account that must own it.
 *
 * Both are checked before the first delete. A slug alone would be one typo away
 * from emptying a real bar's menu, and the owner is what makes the check say
 * "this is the demo" rather than "this is a venue called like the demo".
 */
const DEMO_SLUG = 'chez-lambert'
const DEMO_EMAIL = 'demo@cbm.be'

/** Same step as `positionFor` in `features/menu/api.ts` — room to insert between two rows. */
const POSITION_STEP = 100

type ProductSeed = {
  name: string
  size?: string
  description?: string
  /** Omitted means `null` — « no price displayed », which is not the same as `0`. */
  priceCents?: number
  /** Printed EAN, in the form found on the bottle. Normalized to a GTIN-14 on write. */
  barcode?: string
  stock?: number
  lowStockThreshold?: number
  /** A shortage decided by hand, independent of any counter. */
  unavailable?: boolean
}

type CategorySeed = {
  name: string
  products: Array<ProductSeed>
}

/**
 * The menu of Chez Lambert — a Belgian corner café.
 *
 * Written to give every screen of the product something to show, so a few rows
 * are here for a behaviour rather than for the drink: the two Jupiler formats
 * (a size that distinguishes two lines of the same name), the daily special and
 * the sommelier's suggestion (`priceCents` absent — a priceless line the menu
 * renders and `place_order` accepts), the pierced Kriek keg (`unavailable`
 * without any stock), the Rochefort at zero (a shortage the counter reads off
 * the stock screen) and the Orval, Lupulus Triple and iced tea below their
 * threshold.
 */
const MENU: Array<CategorySeed> = [
  {
    name: 'Bières pression',
    products: [
      { name: 'Jupiler', size: '25cl', priceCents: 260 },
      { name: 'Jupiler', size: '50cl', priceCents: 480 },
      { name: 'Leffe blonde', size: '25cl', priceCents: 380 },
      {
        name: 'Vedett Extra White',
        size: '25cl',
        priceCents: 390,
        description: "Blanche fruitée, servie avec sa rondelle d'orange.",
      },
      {
        name: 'Kriek Belle-Vue',
        size: '25cl',
        priceCents: 390,
        description: 'Fût percé, de retour en fin de semaine.',
        unavailable: true,
      },
    ],
  },
  {
    name: 'Bières bouteille',
    products: [
      {
        name: 'Duvel',
        size: '33cl',
        priceCents: 520,
        description: 'Blonde forte, 8,5 % — servie dans son verre tulipe.',
        barcode: '5411681001005',
        stock: 18,
        lowStockThreshold: 6,
      },
      {
        name: 'Chimay Bleue',
        size: '33cl',
        priceCents: 540,
        barcode: '5410691002002',
        stock: 12,
        lowStockThreshold: 6,
      },
      {
        name: 'Orval',
        size: '33cl',
        priceCents: 530,
        description: 'Trappiste sèche et houblonnée, refermentée en bouteille.',
        barcode: '5410869003008',
        stock: 2,
        lowStockThreshold: 6,
      },
      {
        name: 'Rochefort 8',
        size: '33cl',
        priceCents: 580,
        barcode: '5410694004003',
        stock: 0,
        lowStockThreshold: 4,
      },
      {
        name: 'Tripel Karmeliet',
        size: '33cl',
        priceCents: 550,
        barcode: '5410475005007',
        stock: 9,
        lowStockThreshold: 6,
      },
      {
        name: 'Westmalle Double',
        size: '33cl',
        priceCents: 500,
        barcode: '5410697006004',
        stock: 24,
        lowStockThreshold: 8,
      },
      {
        name: 'Lupulus Fructus',
        size: '33cl',
        priceCents: 350,
        barcode: '5411078007009',
        stock: 10,
        lowStockThreshold: 6,
      },
      {
        name: 'Lupulus Triple',
        size: '33cl',
        priceCents: 350,
        barcode: '5411078008006',
        stock: 3,
        lowStockThreshold: 6,
      },
    ],
  },
  {
    name: 'Vins et bulles',
    products: [
      { name: 'Chardonnay', size: 'au verre', priceCents: 500 },
      { name: 'Côtes-du-Rhône', size: 'au verre', priceCents: 520 },
      { name: 'Crémant de Loire', size: 'à la flûte', priceCents: 650 },
      { name: 'Pichet de blanc', size: '50cl', priceCents: 1400 },
      {
        name: 'Suggestion du sommelier',
        description: "Le flacon du moment, annoncé à l'ardoise.",
      },
    ],
  },
  {
    name: 'Softs',
    products: [
      {
        name: 'Coca-Cola',
        size: '25cl',
        priceCents: 280,
        barcode: '5449000000996',
        stock: 36,
        lowStockThreshold: 12,
      },
      {
        name: 'Coca-Cola Zéro',
        size: '25cl',
        priceCents: 280,
        barcode: '5449000131805',
        stock: 24,
        lowStockThreshold: 12,
      },
      {
        name: 'Limonade artisanale',
        size: '25cl',
        priceCents: 300,
        description: 'Brassée à Namur, peu sucrée.',
        barcode: '5410479011004',
        stock: 8,
        lowStockThreshold: 6,
      },
      {
        name: 'Ice tea pêche',
        size: '25cl',
        priceCents: 300,
        barcode: '5449000136701',
        stock: 5,
        lowStockThreshold: 12,
      },
      {
        name: 'Spa Reine',
        size: '50cl',
        priceCents: 300,
        barcode: '5410013109006',
        stock: 30,
        lowStockThreshold: 12,
      },
      {
        name: 'Spa Barisart',
        size: '50cl',
        priceCents: 300,
        barcode: '5410013110002',
        stock: 20,
        lowStockThreshold: 12,
      },
      {
        name: 'Tönissteiner cerise',
        size: '25cl',
        priceCents: 320,
        barcode: '5410002012003',
        stock: 14,
        lowStockThreshold: 6,
      },
      { name: "Jus d'orange pressé", size: '25cl', priceCents: 380 },
    ],
  },
  {
    name: 'Boissons chaudes',
    products: [
      { name: 'Café', priceCents: 240 },
      { name: 'Café allongé', priceCents: 240 },
      { name: 'Cappuccino', priceCents: 340 },
      { name: 'Café latte', priceCents: 360 },
      {
        name: 'Thé',
        priceCents: 300,
        description: 'Menthe fraîche, earl grey ou verveine.',
      },
      { name: 'Chocolat chaud', priceCents: 380 },
      {
        name: 'Irish coffee',
        priceCents: 850,
        description: 'Whisky irlandais, café serré, crème fouettée.',
      },
    ],
  },
  {
    name: 'Apéritifs et cocktails',
    products: [
      {
        name: 'Spritz Aperol',
        priceCents: 800,
        description: "Aperol, prosecco, eau pétillante, tranche d'orange.",
      },
      {
        name: 'Gin tonic maison',
        priceCents: 900,
        description: 'Gin belge, tonic Fever-Tree, zeste de pamplemousse.',
      },
      { name: 'Picon bière', priceCents: 550 },
      { name: 'Porto rouge', size: '6cl', priceCents: 450 },
      {
        name: 'Negroni',
        priceCents: 900,
        description: 'Gin, campari, vermouth rouge — servi sur glace.',
      },
      {
        name: 'Moscow mule',
        priceCents: 900,
        description: 'Vodka, ginger beer, citron vert.',
      },
      {
        name: 'Virgin mojito',
        priceCents: 650,
        description: 'Sans alcool : citron vert, menthe, sucre de canne.',
      },
    ],
  },
  {
    name: 'À grignoter',
    products: [
      {
        name: 'Planche mixte',
        priceCents: 1600,
        description:
          "Fromages d'abbaye, charcuterie ardennaise, pickles et pain gris. Pour deux.",
      },
      {
        name: 'Croquettes aux crevettes grises',
        priceCents: 1250,
        description: 'Deux pièces, persil frit et citron.',
      },
      { name: 'Bitterballen', priceCents: 750, description: 'Six pièces.' },
      { name: 'Cheese-croquettes', priceCents: 900 },
      { name: 'Chips artisanales', priceCents: 300 },
      {
        name: 'Plat du jour',
        description: "Annoncé à l'ardoise, servi jusqu'à 14 h.",
      },
    ],
  },
]

type OrderLineSeed = {
  /** Product name, plus its size when the name alone names two rows. */
  product: string
  size?: string
  quantity: number
}

type OrderSeed = {
  customerName: string
  status: OrderStatus
  note?: string
  cancelledBy?: 'guest' | 'venue'
  /** How long ago the order was placed. The queue is minutes old, the history days. */
  minutesAgo: number
  lines: Array<OrderLineSeed>
}

/**
 * The counter's queue, and the history under it.
 *
 * The first four are what `/admin/$venueSlug/commandes` shows as being in
 * progress; the rest are closed and spread over the last few days, so the
 * history has a shape rather than a single line. Both cancellation signatures
 * are represented — `guest` (the customer changed their mind before the bar
 * took the order) and `venue` (the counter cancelled, here on a shortage) —
 * because the screen tells them apart and each explains a different absence.
 *
 * Nadia's order carries the daily special, which has no price: her total counts
 * the mojito alone, exactly as `place_order` computes it.
 */
const ORDERS: Array<OrderSeed> = [
  {
    customerName: 'Camille',
    status: 'received',
    minutesAgo: 4,
    lines: [
      { product: 'Jupiler', size: '25cl', quantity: 2 },
      { product: 'Chips artisanales', quantity: 1 },
    ],
  },
  {
    customerName: 'Youssef',
    status: 'received',
    note: 'Sans glace, merci.',
    minutesAgo: 9,
    lines: [{ product: 'Gin tonic maison', quantity: 2 }],
  },
  {
    customerName: 'Lise',
    status: 'preparing',
    minutesAgo: 17,
    lines: [
      { product: 'Duvel', quantity: 1 },
      { product: 'Orval', quantity: 1 },
      { product: 'Planche mixte', quantity: 1 },
    ],
  },
  {
    customerName: 'Marek',
    status: 'ready',
    minutesAgo: 26,
    lines: [
      { product: 'Café', quantity: 2 },
      { product: 'Cappuccino', quantity: 1 },
    ],
  },
  {
    customerName: 'Manon',
    status: 'cancelled',
    cancelledBy: 'guest',
    minutesAgo: 55,
    lines: [{ product: 'Moscow mule', quantity: 1 }],
  },
  {
    customerName: 'Fatima',
    status: 'collected',
    minutesAgo: 95,
    lines: [
      { product: 'Spritz Aperol', quantity: 2 },
      { product: 'Bitterballen', quantity: 1 },
    ],
  },
  {
    customerName: 'Jonas',
    status: 'collected',
    minutesAgo: 140,
    lines: [{ product: 'Jupiler', size: '50cl', quantity: 3 }],
  },
  {
    customerName: 'Aïcha',
    status: 'collected',
    minutesAgo: 190,
    lines: [
      { product: 'Coca-Cola', quantity: 1 },
      { product: 'Ice tea pêche', quantity: 1 },
    ],
  },
  {
    customerName: 'Bruno',
    status: 'collected',
    note: 'Je passe au comptoir dans dix minutes.',
    minutesAgo: 1_500,
    lines: [
      { product: 'Chimay Bleue', quantity: 2 },
      { product: 'Croquettes aux crevettes grises', quantity: 1 },
    ],
  },
  {
    customerName: 'Elena',
    status: 'collected',
    minutesAgo: 1_620,
    lines: [{ product: 'Chardonnay', quantity: 2 }],
  },
  {
    customerName: 'Kevin',
    status: 'cancelled',
    cancelledBy: 'venue',
    minutesAgo: 2_600,
    lines: [{ product: 'Rochefort 8', quantity: 2 }],
  },
  {
    customerName: 'Samuel',
    status: 'collected',
    minutesAgo: 2_900,
    lines: [
      { product: 'Westmalle Double', quantity: 1 },
      { product: 'Tripel Karmeliet', quantity: 1 },
      { product: 'Chips artisanales', quantity: 2 },
    ],
  },
  {
    customerName: 'Nadia',
    status: 'collected',
    minutesAgo: 4_320,
    lines: [
      { product: 'Virgin mojito', quantity: 1 },
      { product: 'Plat du jour', quantity: 1 },
    ],
  },
  {
    customerName: 'Théo',
    status: 'collected',
    minutesAgo: 5_760,
    lines: [
      { product: 'Picon bière', quantity: 2 },
      { product: 'Cheese-croquettes', quantity: 1 },
    ],
  },
]

const VENUE_DESCRIPTION =
  'Café de quartier, comptoir en zinc et terrasse au soleil du matin. Bières belges, planches à partager et le plat du jour à l’ardoise.'

/**
 * How long the bar took, per status.
 *
 * `received` has not been touched yet, so its `updated_at` is its `created_at`;
 * the others carry the minutes that passed before the counter moved them on.
 */
const MINUTES_TO_SETTLE: Record<OrderStatus, number> = {
  received: 0,
  preparing: 3,
  ready: 6,
  collected: 12,
  cancelled: 8,
}

/**
 * How an order line names the product it points at.
 *
 * The name alone, most of the time — a menu that repeats a name is the
 * exception, not the rule. When it does (« Jupiler » in 25cl and in 50cl), the
 * line states the format too, and it has to: that is precisely the ambiguity
 * `order_items.size` exists to settle on the counter's ticket.
 */
function findProduct<TProduct extends { name: string; size: string | null }>(
  products: Array<TProduct>,
  line: OrderLineSeed,
): TProduct {
  const matches = products.filter(
    (product) =>
      product.name === line.product &&
      (line.size === undefined || product.size === line.size),
  )

  if (matches.length === 0) {
    throw new Error(`« ${line.product} » n’est pas dans la carte.`)
  }

  if (matches.length > 1) {
    throw new Error(
      `« ${line.product} » désigne ${matches.length} produits de la carte. Précisez le format.`,
    )
  }

  return matches[0]
}

/**
 * The database client, built here rather than imported.
 *
 * `src/db/client.server.ts` pulls `@tanstack/react-start/server-only` and
 * `serverEnv()`, both meant for the request runtime; a CLI reads `.env` itself,
 * the way `drizzle.config.ts` does.
 */
function connect() {
  try {
    process.loadEnvFile('.env')
  } catch {
    // No local `.env`: the variables then come from the environment (CI, shell).
  }

  const url = process.env.DATABASE_URL

  if (!url) {
    throw new Error(
      'DATABASE_URL est absent. Renseignez-le dans `.env` ou dans l’environnement.',
    )
  }

  // `prepare: false` — the Supabase pooler runs in transaction mode, where a
  // prepared statement is not guaranteed to find its session again.
  const client = postgres(url, { prepare: false })

  return {
    client,
    db: drizzle(client, { schema, casing: 'snake_case' }),
  }
}

type Db = ReturnType<typeof connect>['db']

/**
 * Finds the demo venue, and refuses anything else.
 *
 * The script deletes before it inserts, so this is the guard that stands
 * between a mistyped slug and a real bar's menu. The venue must exist under the
 * expected slug **and** belong to the demo account — the second half is what
 * makes the check mean « this is the demonstration venue » rather than « this
 * is a venue with that name ».
 */
async function resolveDemoVenue(db: Db) {
  const owners = await db.execute<{ id: string }>(
    sql`select id from auth.users where email = ${DEMO_EMAIL} limit 1`,
  )
  const ownerId = owners.at(0)?.id

  if (!ownerId) {
    throw new Error(
      `Aucun compte ${DEMO_EMAIL} dans cette base. Ce script ne vise que le compte de démonstration.`,
    )
  }

  const venue = await db.query.venues.findFirst({
    where: eq(schema.venues.slug, DEMO_SLUG),
  })

  if (!venue) {
    throw new Error(
      `Aucun établissement « ${DEMO_SLUG} » dans cette base. Créez-le depuis le back-office avant de lancer le seed.`,
    )
  }

  if (venue.ownerId !== ownerId) {
    throw new Error(
      `L’établissement « ${DEMO_SLUG} » n’appartient pas à ${DEMO_EMAIL}. Rien n’a été supprimé.`,
    )
  }

  return venue
}

async function seed(db: Db, venueId: string) {
  return db.transaction(async (tx) => {
    // `order_items` and `products` follow their parent by cascade.
    await tx.delete(schema.orders).where(eq(schema.orders.venueId, venueId))
    await tx
      .delete(schema.categories)
      .where(eq(schema.categories.venueId, venueId))

    await tx
      .update(schema.venues)
      .set({
        description: VENUE_DESCRIPTION,
        ordersEnabled: true,
        deletedAt: null,
      })
      .where(eq(schema.venues.id, venueId))

    const insertedCategories = await tx
      .insert(schema.categories)
      .values(
        MENU.map((category, index) => ({
          venueId,
          name: category.name,
          position: index * POSITION_STEP,
        })),
      )
      .returning({ id: schema.categories.id, name: schema.categories.name })

    const categoryIdByName = new Map(
      insertedCategories.map((category) => [category.name, category.id]),
    )

    const insertedProducts = await tx
      .insert(schema.products)
      .values(
        MENU.flatMap((category) =>
          category.products.map((product, index) => ({
            categoryId: categoryIdByName.get(category.name)!,
            name: product.name,
            description: product.description ?? null,
            size: product.size ?? null,
            // Every code goes through the same door as the scanner and the
            // manual field: a wrong check digit fails here, before any write.
            barcode: product.barcode ? normalizeBarcode(product.barcode) : null,
            priceCents: product.priceCents ?? null,
            stockQuantity: product.stock ?? null,
            lowStockThreshold: product.lowStockThreshold ?? null,
            isAvailable: !product.unavailable,
            position: index * POSITION_STEP,
          })),
        ),
      )
      .returning({
        id: schema.products.id,
        name: schema.products.name,
        size: schema.products.size,
        priceCents: schema.products.priceCents,
      })

    const now = Date.now()
    let insertedLines = 0

    for (const order of ORDERS) {
      const createdAt = new Date(now - order.minutesAgo * 60_000)
      const updatedAt = new Date(
        createdAt.getTime() + MINUTES_TO_SETTLE[order.status] * 60_000,
      )

      const lines = order.lines.map((line) => {
        try {
          return { line, product: findProduct(insertedProducts, line) }
        } catch (error) {
          throw new Error(
            `Commande de ${order.customerName} : ${error instanceof Error ? error.message : String(error)}`,
          )
        }
      })

      // The total counts the priced lines alone — a daily special is settled at
      // the counter, exactly as `place_order` leaves it out.
      const totalCents = lines.reduce(
        (total, { line, product }) =>
          total + (product.priceCents ?? 0) * line.quantity,
        0,
      )

      const [insertedOrder] = await tx
        .insert(schema.orders)
        .values({
          venueId,
          customerName: order.customerName,
          note: order.note ?? null,
          status: order.status,
          cancelledBy: order.cancelledBy ?? null,
          totalCents,
          createdAt,
          updatedAt,
        })
        .returning({ id: schema.orders.id })

      // Names, sizes and unit prices are copied, never read back through the
      // product: a line is a trace of what was ordered that evening.
      await tx.insert(schema.orderItems).values(
        lines.map(({ line, product }) => ({
          orderId: insertedOrder.id,
          productId: product.id,
          name: product.name,
          size: product.size,
          unitPriceCents: product.priceCents,
          quantity: line.quantity,
          createdAt,
          updatedAt: createdAt,
        })),
      )

      insertedLines += lines.length
    }

    return {
      categories: insertedCategories.length,
      products: insertedProducts.length,
      orders: ORDERS.length,
      lines: insertedLines,
    }
  })
}

const { client, db } = connect()

try {
  const venue = await resolveDemoVenue(db)
  const counts = await seed(db, venue.id)

  console.log(
    `Compte de démonstration rempli — ${venue.name} (/m/${venue.slug})`,
  )
  console.log(
    `  ${counts.categories} catégories, ${counts.products} produits, ${counts.orders} commandes (${counts.lines} lignes)`,
  )
} catch (error) {
  console.error(
    `Seed interrompu : ${error instanceof Error ? error.message : String(error)}`,
  )
  process.exitCode = 1
} finally {
  await client.end()
}
