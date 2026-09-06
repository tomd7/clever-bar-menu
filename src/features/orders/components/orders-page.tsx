import { ArrowLeft, ConciergeBell } from 'lucide-react'
import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'

import { EmptyState } from '#/components/empty-state'
import { ErrorNote } from '#/components/error-note'
import { NavLink } from '#/components/nav-link'
import { OrderCard } from '#/features/orders/components/order-card'
import {
  Skeleton,
  SkeletonHeader,
  SkeletonLine,
  SkeletonScreen,
} from '#/components/skeleton'
import { Switch } from '#/components/ui/switch'
import { isOpenOrder } from '#/features/orders/status'
import { ordersQueryOptions } from '#/features/orders/api'
import { useSetOrdersEnabled } from '#/features/orders/mutations'

/**
 * L'écran des commandes d'un établissement.
 *
 * C'est une file d'attente, pas un tableau de bord : elle se relève toutes les
 * dix secondes (voir `ordersQueryOptions`) et se lit debout, entre deux
 * services.
 *
 * Deux listes, et leur ordre est inverse l'un de l'autre — ce qui n'est pas
 * une inconséquence :
 *
 * - **En cours**, la plus ancienne en tête. C'est l'ordre dans lequel on sert :
 *   celui qui attend depuis le plus longtemps passe d'abord, et le mettre en
 *   bas de l'écran serait le meilleur moyen de l'oublier.
 * - **Historique**, la plus récente en tête. On n'y descend que pour vérifier
 *   quelque chose qui vient de se passer.
 */
export function OrdersPage({ venueSlug }: { venueSlug: string }) {
  const ordersQuery = useQuery(ordersQueryOptions(venueSlug))

  const open = (ordersQuery.data?.orders ?? []).filter((order) =>
    isOpenOrder(order.status),
  )
  const waiting = open.filter((order) => order.status === 'received').length

  /*
    Le nombre de commandes à prendre passe dans le titre de l'onglet.

    C'est le seul canal disponible : la tablette du comptoir affiche autre
    chose la moitié du temps, et un onglet en arrière-plan ne peut rien montrer
    d'autre que son titre. Seules les commandes **non encore acceptées** y
    comptent — celles qu'on prépare sont déjà entre les mains de quelqu'un.
  */
  useEffect(() => {
    const previous = document.title
    if (waiting > 0) document.title = `(${waiting}) Commandes`
    return () => {
      document.title = previous
    }
  }, [waiting])

  if (ordersQuery.isPending) return <OrdersPageSkeleton />

  if (ordersQuery.isError) {
    return (
      <div className="panel rounded-2xl p-6">
        <p role="alert" className="text-sm text-destructive">
          {ordersQuery.error.message}
        </p>
        <NavLink to="/admin" className="mt-4">
          Retour aux établissements
        </NavLink>
      </div>
    )
  }

  const { venue, orders } = ordersQuery.data
  const history = orders.filter((order) => !isOpenOrder(order.status))

  return (
    <div className="page-wrap px-0">
      {/* Masqué à partir de `lg`, où la colonne porte la même destination. */}
      <NavLink
        to="/admin/$venueSlug"
        params={{ venueSlug: venue.slug }}
        icon={ArrowLeft}
        className="lg:hidden"
      >
        Retour à la carte
      </NavLink>

      <header className="mt-2 lg:mt-0">
        <p className="island-kicker">Commandes</p>
        <h1 className="display-title mt-1 text-2xl leading-tight sm:text-3xl">
          {venue.name}
        </h1>
        <p className="mt-2 text-sm text-ink-soft">
          Les clients commandent depuis la carte et viennent retirer au
          comptoir. Accepter une commande décompte le stock des produits suivis.
        </p>
      </header>

      <OrdersToggle venueId={venue.id} enabled={venue.orders_enabled} />

      <section aria-labelledby="orders-open" className="mt-6">
        <h2 id="orders-open" className="island-kicker">
          En cours
        </h2>

        {open.length === 0 ? (
          <EmptyState
            icon={ConciergeBell}
            title="Rien à préparer"
            className="mt-2"
          >
            {venue.orders_enabled
              ? 'Les commandes des clients apparaîtront ici, la plus ancienne en tête.'
              : 'La prise de commande est fermée : la carte n’affiche aucun bouton pour commander.'}
          </EmptyState>
        ) : (
          <ul className="mt-2 space-y-3">
            {/*
              `slice().reverse()` : la requête rend les plus récentes d'abord,
              et on sert dans l'ordre d'arrivée. La copie évite de retourner le
              tableau du cache de React Query en place, ce qui ferait basculer
              l'ordre de l'historique un rendu sur deux.
            */}
            {open
              .slice()
              .reverse()
              .map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  currency={venue.currency}
                />
              ))}
          </ul>
        )}
      </section>

      {history.length > 0 ? (
        <section aria-labelledby="orders-history" className="mt-8">
          <h2 id="orders-history" className="island-kicker">
            Historique
          </h2>
          <ul className="mt-2 space-y-3">
            {history.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                currency={venue.currency}
              />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}

/**
 * L'interrupteur qui ouvre la prise de commande.
 *
 * Il vit sur cet écran-ci et non dans une page de réglages qui n'existe pas :
 * c'est ici qu'un gérant se pose la question, en regardant sa file. Fermer en
 * fin de service est un geste quotidien, pas un paramètre.
 *
 * Le drapeau ne fait pas que cacher un bouton — `place_order` le vérifie aussi
 * et refuse la commande. Une carte restée ouverte dans un onglet ne peut donc
 * pas continuer à envoyer après la fermeture.
 */
function OrdersToggle({
  venueId,
  enabled,
}: {
  venueId: string
  enabled: boolean
}) {
  const setEnabled = useSetOrdersEnabled()

  return (
    <div className="panel mt-6 rounded-2xl p-4 sm:p-5">
      <label className="flex items-center justify-between gap-4">
        <span className="min-w-0">
          <span className="block font-medium">
            {enabled ? 'Commandes ouvertes' : 'Commandes fermées'}
          </span>
          <span className="mt-0.5 block text-sm text-ink-soft">
            {enabled
              ? 'La carte affiche un bouton de commande sur chaque produit.'
              : 'La carte reste consultable, sans possibilité de commander.'}
          </span>
        </span>

        <Switch
          checked={enabled}
          disabled={setEnabled.isPending}
          onCheckedChange={(checked) =>
            setEnabled.mutate({ venueId, enabled: checked })
          }
          aria-label={
            enabled
              ? 'Fermer la prise de commande'
              : 'Ouvrir la prise de commande'
          }
        />
      </label>

      {setEnabled.error ? (
        <ErrorNote>{setEnabled.error.message}</ErrorNote>
      ) : null}
    </div>
  )
}

/**
 * L'attente de l'écran des commandes.
 *
 * Elle réserve l'interrupteur et **une seule** carte de commande. Le nombre de
 * commandes en attente est la chose que cet écran ne peut pas deviner : en
 * promettre trois ferait, la plupart du temps, disparaître deux blocs au
 * chargement — et sur un écran qu'on ouvre pour compter, c'est précisément le
 * chiffre qu'il ne faut pas suggérer.
 */
function OrdersPageSkeleton() {
  return (
    <SkeletonScreen
      label="Chargement des commandes…"
      className="page-wrap px-0"
    >
      <Skeleton className="h-4 w-40 rounded-full lg:hidden" />

      <SkeletonHeader>
        <SkeletonLine className="mt-2 w-96 max-w-full" delay={110} />
      </SkeletonHeader>

      <div className="panel mt-6 flex items-center justify-between gap-4 rounded-2xl p-4 sm:p-5">
        <div className="min-w-0 flex-1">
          <SkeletonLine className="w-44" delay={180} />
          <SkeletonLine className="mt-1 w-72 max-w-full" delay={215} />
        </div>
        <Skeleton className="h-6 w-11 shrink-0 rounded-full" delay={250} />
      </div>

      <Skeleton
        className="mt-6 h-[1lh] w-24 rounded-full text-[13px]/[1.5]"
        delay={300}
      />

      <div className="panel mt-2 rounded-2xl border border-line p-4 sm:p-5">
        <Skeleton className="h-[1lh] w-32 text-lg leading-tight" delay={340} />
        <SkeletonLine className="mt-1 w-28" delay={375} />

        <div className="mt-3 space-y-2 border-t border-line-soft pt-3">
          <SkeletonLine className="w-56 max-w-full" delay={410} />
          <SkeletonLine className="w-40 max-w-full" delay={445} />
        </div>

        <div className="mt-4 flex gap-2">
          <Skeleton className="h-11 w-32 rounded-md lg:h-9" delay={480} />
          <Skeleton className="h-11 w-28 rounded-md lg:h-9" delay={515} />
        </div>
      </div>
    </SkeletonScreen>
  )
}
