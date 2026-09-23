import { ArrowLeft, PackageOpen, ScanBarcode } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'

import { ActionButton } from '#/components/buttons/action-button'
import { EmptyState } from '#/components/empty-state'
import { NavLink } from '#/components/nav-link'
import {
  Skeleton,
  SkeletonHeader,
  SkeletonLine,
  SkeletonScreen,
} from '#/components/skeleton'
import { StockRow, stockRowId } from '#/features/menu/components/stock-row'
import { isWatched, needsRestock, stockStateOf } from '#/features/menu/stock'
import { menuQueryOptions } from '#/features/menu/api'

/**
 * Page « Stock » d'un établissement.
 *
 * Écrite pour être tenue debout derrière un comptoir, pas pour être consultée :
 * les cibles font 44px, le compteur d'une ligne est atteignable au pouce, et
 * rien n'y demande de valider un formulaire.
 *
 * Elle lit `menuQueryOptions`, la requête de l'éditeur, plutôt que la sienne. Le
 * stock n'est pas une autre collection : c'est la même carte, regardée par la
 * colonne des quantités. Une seconde requête ferait deux caches à invalider, et
 * un « −1 » corrigé ici n'apparaîtrait pas sur la carte ouverte dans l'onglet
 * d'à côté.
 *
 * Deux ensembles, et l'ordre entre eux est délibéré :
 *
 * - Un **bandeau d'alerte** en tête, qui ne contient que des raccourcis. Il dit
 *   quoi traiter, il ne le traite pas — les compteurs restent dans la liste,
 *   à un seul endroit.
 * - La **liste des produits surveillés**, dans l'ordre de la carte, catégorie
 *   par catégorie.
 *   Cet ordre-là ne bouge jamais : trier par urgence ferait remonter une ligne
 *   au moment même où le doigt appuie sur son « −1 », et le deuxième appui
 *   tomberait sur le produit d'à côté. La liste est ce qu'on parcourt en
 *   longeant le bar, elle suit donc l'ordre du bar.
 */
export function StockPage({ venueSlug }: { venueSlug: string }) {
  const menuQuery = useQuery(menuQueryOptions(venueSlug))

  if (menuQuery.isPending) {
    return <StockPageSkeleton />
  }

  if (menuQuery.isError) {
    return (
      <div className="panel rounded-2xl p-6">
        <p role="alert" className="text-sm text-destructive">
          {menuQuery.error.message}
        </p>
        <NavLink to="/admin" className="mt-4">
          Retour aux établissements
        </NavLink>
      </div>
    )
  }

  const { venue, categories } = menuQuery.data

  /*
    Deux écarts d'emblée, et une exception. Sans stock renseigné — un café, une
    pression au fût — il n'y a rien à décompter, et ces produits sont la
    majorité d'une carte de bar : trente lignes inertes à traverser pour
    atteindre les six qui comptent. Sans seuil d'alerte, la ligne ne pourrait
    jamais rien signaler, et cette page se parcourt justement pour savoir quoi
    réapprovisionner. L'exception est la rupture : à zéro, le produit ne se
    commande plus, et c'est ici qu'il se répare — `isWatched` le garde
    donc, seuil ou pas. Le pied de page compte le reste et renvoie à la carte,
    seul endroit où ces deux champs se règlent.
  */
  const watchedCategories = categories
    .map((category) => ({
      ...category,
      products: category.products.filter(isWatched),
    }))
    .filter((category) => category.products.length > 0)

  const watchedProducts = watchedCategories.flatMap(
    (category) => category.products,
  )
  const alerts = watchedProducts.filter(needsRestock)

  const unwatchedCount =
    categories.reduce(
      (total, category) => total + category.products.length,
      0,
    ) - watchedProducts.length

  return (
    <div className="page-wrap px-0">
      {/* Masqué à partir de `lg`, où la colonne porte la même destination. En
          dessous, la colonne n'existe pas et ce lien est la seule sortie. */}
      <NavLink
        to="/admin/$venueSlug"
        params={{ venueSlug: venue.slug }}
        icon={ArrowLeft}
        className="lg:hidden"
      >
        Retour à la carte
      </NavLink>

      <header className="mt-2 lg:mt-0">
        <p className="island-kicker">Stock</p>
        <h1 className="display-title mt-1 text-2xl leading-tight sm:text-3xl">
          {venue.name}
        </h1>
        <p className="mt-2 text-sm text-ink-soft">
          Un produit épuisé reste sur la carte des clients sans pouvoir être
          commandé, et redevient disponible dès qu'il est réapprovisionné.
        </p>

        {/*
          L'entrée du scanner est ici et nulle part ailleurs — pas dans la
          colonne du back-office, qui n'existe qu'à partir de `lg`, c'est-à-dire
          sur la machine sans caméra utilisable. Un lien permanent vers un écran
          qui ne marche pas là où le lien se voit serait pire que pas de lien.
        */}
        <ActionButton
          icon={ScanBarcode}
          variant="outline"
          className="mt-4"
          asChild
        >
          <Link
            to="/admin/$venueSlug/stock/scan"
            params={{ venueSlug: venue.slug }}
          >
            Scanner un code-barres
          </Link>
        </ActionButton>
      </header>

      {alerts.length > 0 ? (
        <section
          aria-label="Produits à réapprovisionner"
          className="panel mt-6 rounded-2xl p-4 sm:p-5"
        >
          <p className="island-kicker">À réapprovisionner</p>
          <p className="mt-1 text-sm text-ink-soft">{describeAlerts(alerts)}</p>

          {/*
            Des raccourcis, pas des contrôles : le compteur d'un produit
            n'existe qu'une fois, dans la liste. Le dupliquer ici aurait donné
            deux « −1 » pour la même bouteille, et un bandeau dont les lignes
            disparaissent sous le doigt à mesure qu'on les traite.

            `rail-fade` reprend le rail de la carte client : le masque au bord
            droit dit que la rangée continue, là où une barre de défilement ne
            ferait que salir la bande.
          */}
          <ul className="scrollbar-none rail-fade mt-3 flex gap-2 overflow-x-auto">
            {alerts.map((product) => (
              <li key={product.id}>
                <a
                  href={`#${stockRowId(product.id)}`}
                  className={
                    stockStateOf(product) === 'out'
                      ? 'flex min-h-11 items-center gap-2 rounded-full border border-destructive/30 bg-destructive/10 px-4 text-sm font-medium whitespace-nowrap text-destructive no-underline active:scale-[0.97]'
                      : 'flex min-h-11 items-center gap-2 rounded-full border border-line bg-surface-raised px-4 text-sm font-medium whitespace-nowrap text-ink-soft no-underline hover:text-ink active:scale-[0.97]'
                  }
                >
                  {product.name}
                  <span className="tabular-nums opacity-70">
                    {product.stock_quantity}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {watchedCategories.length === 0 ? (
        <EmptyState
          icon={PackageOpen}
          title="Aucun stock suivi"
          className="mt-6"
        >
          Renseignez un stock restant et un seuil d'alerte sur la fiche d'un
          produit, depuis la carte, et il apparaîtra ici. Les produits sans
          stock fini — un café, une pression au fût — n'ont rien à y faire.
        </EmptyState>
      ) : (
        <div className="mt-6 space-y-4">
          {watchedCategories.map((category) => (
            <section key={category.id} className="panel rounded-2xl p-4 sm:p-5">
              <h2 className="display-title text-lg leading-tight">
                {category.name}
              </h2>

              <ul className="mt-3 divide-y divide-line border-t border-line">
                {category.products.map((product) => (
                  <StockRow key={product.id} product={product} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {unwatchedCount > 0 ? (
        <p className="mt-4 text-sm text-ink-soft">
          {unwatchedCount === 1
            ? '1 produit sans stock suivi ou sans seuil d’alerte.'
            : `${unwatchedCount} produits sans stock suivi ou sans seuil d’alerte.`}{' '}
          <NavLink to="/admin/$venueSlug" params={{ venueSlug: venue.slug }}>
            Réglez-les depuis la carte
          </NavLink>
        </p>
      ) : null}
    </div>
  )
}

/**
 * Résume les alertes en une phrase.
 *
 * Une phrase et non deux compteurs côte à côte : « 2 épuisés, 3 bientôt » se lit
 * d'un coup d'œil, là où deux pastilles chiffrées demandent d'abord de
 * comprendre leur légende.
 */
function describeAlerts(
  alerts: Array<{ stock_quantity: number; low_stock_threshold: number | null }>,
): string {
  const out = alerts.filter((product) => stockStateOf(product) === 'out').length
  const low = alerts.length - out

  const parts: Array<string> = []
  if (out > 0)
    parts.push(out === 1 ? '1 produit épuisé' : `${out} produits épuisés`)
  if (low > 0) parts.push(low === 1 ? '1 stock bas' : `${low} stocks bas`)

  return `${parts.join(', ')}.`
}

/**
 * L'attente de l'écran de stock.
 *
 * Elle réserve **la bande d'alerte**, alors que rien ne dit encore qu'il y en
 * aura une. C'est le seul endroit de l'application où l'ossature promet un bloc
 * qui peut ne pas venir, et c'est délibéré : une carte sans rupture est la
 * bonne nouvelle, la disparition de la bande au chargement se lit comme un
 * soulagement. L'inverse — une bande qui pousse la liste vers le bas juste
 * après que le pouce s'est posé — décalerait un compteur au moment de l'appui.
 *
 * Les lignes gardent le compteur au bord droit, à ses 44px : c'est la cible que
 * la main vise avant même d'avoir lu le nom du produit.
 */
function StockPageSkeleton() {
  return (
    <SkeletonScreen label="Chargement du stock…" className="page-wrap px-0">
      {/* Propre au téléphone, comme le vrai lien de retour. */}
      <Skeleton className="h-4 w-40 rounded-full lg:hidden" />

      <SkeletonHeader>
        <SkeletonLine className="mt-2 w-80 max-w-full" delay={110} />
      </SkeletonHeader>

      <section className="panel mt-6 rounded-2xl p-4 sm:p-5">
        <Skeleton
          className="h-[1lh] w-32 rounded-full text-[13px]/[1.5]"
          delay={180}
        />
        <SkeletonLine className="mt-1 w-52 max-w-full" delay={215} />

        {/* Les raccourcis, en pastilles de 44px sur une rangée qui défile. */}
        <div className="mt-3 flex gap-2 overflow-hidden">
          {['w-28', 'w-36', 'w-24'].map((width, chip) => (
            <Skeleton
              key={width}
              className={`h-11 shrink-0 rounded-full ${width}`}
              delay={250 + chip * 45}
            />
          ))}
        </div>
      </section>

      <div className="mt-6 space-y-4">
        {[3, 2].map((products, section) => (
          <section key={section} className="panel rounded-2xl p-4 sm:p-5">
            <Skeleton
              className="h-[1lh] w-36 max-w-full text-lg leading-tight"
              delay={380 + section * 120}
            />

            <div className="mt-3 divide-y divide-line border-t border-line">
              {Array.from({ length: products }, (_, row) => (
                <div key={row} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <Skeleton
                      className="h-[1lh] w-40 max-w-full rounded-full"
                      delay={440 + section * 120 + row * 55}
                    />
                    {/* La pastille de `StockBadge`, qui donne sa hauteur à la
                        ligne autant que le compteur d'en face. */}
                    <Skeleton
                      className="mt-1 h-5 w-24 rounded-full"
                      delay={470 + section * 120 + row * 55}
                    />
                  </div>
                  {/*
                    Le compteur d'un seul tenant, et non ses trois parties :
                    « c'est l'encadré qui fait l'objet », dit `StockStepper`
                    en donnant au champ le fond du groupe. Trois barres
                    séparées dessineraient ici un objet que l'écran n'a pas.
                  */}
                  <Skeleton
                    className="h-11 w-36 shrink-0 rounded-lg"
                    delay={470 + section * 120 + row * 55}
                  />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </SkeletonScreen>
  )
}
