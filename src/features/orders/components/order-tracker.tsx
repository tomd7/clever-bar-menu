import { Tabs } from 'radix-ui'
import { useQueries } from '@tanstack/react-query'
import { useState } from 'react'

import { ActionButton } from '#/components/buttons/action-button'
import { BottomSheet } from '#/features/orders/components/bottom-sheet'
import {
  GUEST_STATUS_HINT,
  GUEST_STATUS_LABEL,
  isOpenOrder,
} from '#/features/orders/status'
import { formatPrice } from '#/lib/money'
import { forgetTickets } from '#/features/orders/ticket'
import { guestOrderQueryOptions } from '#/features/orders/public-api'

import type { GuestOrder } from '#/features/orders/public-api'
import type { OrderTicket } from '#/features/orders/ticket'
import type { ReactNode } from 'react'
import type { UseQueryResult } from '@tanstack/react-query'

/** Une commande suivie : son ticket, et l'état de sa relève. */
type OrderEntry = {
  ticket: OrderTicket
  query: UseQueryResult<GuestOrder, Error>
}

/**
 * Les commandes du client, une fois envoyées.
 *
 * Elles vivent dans la même feuille que le panier qu'elles complètent — même
 * bord, même geste pour l'ouvrir. Pas de nouvelle page, et surtout pas de
 * nouvelle URL : le jeton qui autorise cette lecture ne doit apparaître nulle
 * part où une adresse se copie.
 *
 * **Deux onglets, et le partage n'est pas cosmétique.** « En cours » ne contient
 * que ce qu'on attend encore ; une commande récupérée n'a plus rien à y faire,
 * et la laisser dans la même liste obligeait à relire les états pour trouver
 * celle qui compte. L'historique reste à un geste, parce qu'on y revient pour
 * vérifier ce qu'on a pris.
 *
 * Le partage ne se voit qu'à partir du moment où il y a quelque chose à ranger :
 * une première commande en cours s'affiche seule, sans barre d'onglets à lire.
 *
 * Les requêtes sont relevées ici comme dans la barre — mêmes clés, donc même
 * cache et aucun appel en double.
 */
export function OrderTracker({
  open,
  onOpenChange,
  venueSlug,
  tickets,
  currency,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  venueSlug: string
  tickets: ReadonlyArray<OrderTicket>
  currency: string
}) {
  const orderQueries = useQueries({
    queries: tickets.map((ticket) => guestOrderQueryOptions(ticket)),
  })

  /*
    La plus récente en tête : c'est celle dont on vient de se préoccuper, et
    celle qu'on rouvre l'écran pour vérifier. Le stockage, lui, garde l'ordre
    d'envoi — celui dans lequel le bar sert.
  */
  const entries = tickets
    .map((ticket, index) => ({ ticket, query: orderQueries[index] }))
    .reverse()

  /*
    Une commande introuvable est rangée dans l'historique : son ticket est
    périmé ou bricolé, il n'y a plus rien à attendre, et la laisser en cours
    ferait compter une commande qui n'arrivera jamais.
  */
  const isSettled = ({ query }: OrderEntry) =>
    query.isError ||
    (query.data !== undefined && !isOpenOrder(query.data.status))

  const settled = entries.filter(isSettled)
  const pending = entries.filter((entry) => !isSettled(entry))

  /*
    `null` signifie « laisse l'écran choisir ». L'onglet par défaut ne peut pas
    être figé au montage : la feuille est montée bien avant que les commandes
    ne soient chargées, et à cet instant tout est encore vide. Tant que le
    client n'a pas choisi, l'écran ouvre là où il y a quelque chose à voir.
  */
  const [chosenTab, setChosenTab] = useState<'pending' | 'history' | null>(null)
  const tab = chosenTab ?? (pending.length > 0 ? 'pending' : 'history')

  const hasTabs = settled.length > 0 && pending.length > 0

  return (
    <BottomSheet
      open={open}
      onOpenChange={(next) => {
        /*
          Le choix d'onglet ne survit pas à la fermeture : à la réouverture, la
          feuille doit reprendre là où il y a quelque chose à voir, et non là où
          le client était passé une fois.
        */
        if (!next) setChosenTab(null)
        onOpenChange(next)
      }}
      title={tickets.length === 1 ? 'Votre commande' : 'Vos commandes'}
      description={
        /* Une seule commande : la consigne tient en sous-titre. Plusieurs, il
           n'y a pas de consigne unique à donner. */
        tickets.length === 1 && orderQueries[0]?.data
          ? GUEST_STATUS_HINT[orderQueries[0].data.status]
          : undefined
      }
    >
      {hasTabs ? (
        <Tabs.Root
          value={tab}
          onValueChange={(value) =>
            setChosenTab(value === 'history' ? 'history' : 'pending')
          }
        >
          {/*
            Radix porte le clavier : flèches entre les onglets, `aria-selected`
            et `aria-controls` câblés. Le dessin reprend les pastilles du rail
            de la carte — c'est le vocabulaire de cette page côté client.
          */}
          <Tabs.List className="flex gap-2" aria-label="Vos commandes">
            <TabChip value="pending" count={pending.length}>
              En cours
            </TabChip>
            <TabChip value="history" count={settled.length}>
              Historique
            </TabChip>
          </Tabs.List>

          <Tabs.Content value="pending" className="mt-4 outline-none">
            <OrderList entries={pending} currency={currency} />
          </Tabs.Content>

          <Tabs.Content value="history" className="mt-4 outline-none">
            <OrderList entries={settled} currency={currency} />
            <ClearHistory
              venueSlug={venueSlug}
              ids={settled.map(({ ticket }) => ticket.id)}
            />
          </Tabs.Content>
        </Tabs.Root>
      ) : (
        <>
          <OrderList entries={entries} currency={currency} />
          {settled.length > 0 ? (
            <ClearHistory
              venueSlug={venueSlug}
              ids={settled.map(({ ticket }) => ticket.id)}
              onCleared={() => onOpenChange(false)}
            />
          ) : null}
        </>
      )}
    </BottomSheet>
  )
}

/**
 * Une pastille d'onglet.
 *
 * Le compte est toujours affiché, sur les deux : c'est un contrôle segmenté, et
 * un seul des deux côtés chiffré se lit comme une alerte plutôt que comme un
 * partage.
 */
function TabChip({
  value,
  count,
  children,
}: {
  value: string
  count: number
  children: ReactNode
}) {
  return (
    <Tabs.Trigger
      value={value}
      className="flex min-h-11 items-center gap-2 rounded-full border border-transparent bg-surface-raised px-4 text-sm font-medium whitespace-nowrap text-ink-soft transition-transform duration-150 ease-(--ease-out) outline-none active:scale-[0.97] data-[state=active]:border-bottle data-[state=active]:bg-bottle data-[state=active]:font-semibold data-[state=active]:text-on-bottle"
    >
      {children}
      <span className="tabular-nums opacity-70">{count}</span>
    </Tabs.Trigger>
  )
}

function OrderList({
  entries,
  currency,
}: {
  entries: Array<OrderEntry>
  currency: string
}) {
  if (entries.length === 0) {
    /*
      L'onglet vide reste affiché plutôt que de basculer le client ailleurs :
      la dernière commande vient de passer à « récupérée » sous ses yeux, et
      changer d'onglet sous son doigt à ce moment-là lui ferait perdre le fil.
    */
    return (
      <p className="py-6 text-center text-sm text-ink-soft">
        Aucune commande en cours.
      </p>
    )
  }

  return (
    <ul className="divide-y divide-line">
      {entries.map(({ ticket, query }) => (
        <li key={ticket.id} className="py-4 first:pt-0 last:pb-0">
          {query.isPending ? (
            <p className="text-sm text-ink-soft">Chargement…</p>
          ) : query.isError ? (
            <p role="alert" className="text-sm text-destructive">
              {query.error.message}
            </p>
          ) : (
            <OrderBlock order={query.data} currency={currency} />
          )}
        </li>
      ))}
    </ul>
  )
}

/** Le geste qui range l'historique. */
function ClearHistory({
  venueSlug,
  ids,
  onCleared,
}: {
  venueSlug: string
  ids: Array<string>
  onCleared?: () => void
}) {
  return (
    <ActionButton
      surface="page"
      className="mt-5 w-full"
      onClick={() => {
        forgetTickets(venueSlug, ids)
        onCleared?.()
      }}
    >
      {ids.length === 1 ? 'Retirer cette commande' : 'Effacer l’historique'}
    </ActionButton>
  )
}

function OrderBlock({
  order,
  currency,
}: {
  order: GuestOrder
  currency: string
}) {
  return (
    <>
      {/*
        L'état d'abord, en gros, avant le détail : c'est la seule chose que le
        client vient chercher en rouvrant cette feuille. L'addition, il l'a déjà
        validée.
      */}
      <p className="display-title text-xl leading-tight">
        {GUEST_STATUS_LABEL[order.status]}
      </p>
      {/*
        Le prénom, et non la consigne — celle-ci est en sous-titre de la feuille.
        Deux commandes dans le même état afficheraient sinon deux fois le même
        chapô mot pour mot, là où ce qui les distingue est justement le nom sous
        lequel chacune sera appelée.
      */}
      <p className="mt-1 text-sm text-ink-soft">
        Au nom de {order.customerName}.
      </p>

      <ul className="mt-3 divide-y divide-line-soft border-y border-line-soft">
        {order.items.map((item) => (
          <li key={item.id} className="flex items-baseline gap-3 py-2.5">
            <span className="w-6 shrink-0 font-semibold tabular-nums">
              {item.quantity}
            </span>
            <span className="min-w-0 flex-1">{item.name}</span>
            <span className="shrink-0 text-sm text-ink-soft tabular-nums">
              {item.unitPriceCents === null
                ? 'au comptoir'
                : formatPrice(item.unitPriceCents * item.quantity, currency)}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex items-baseline justify-between gap-4">
        <span className="font-semibold">Total</span>
        <span className="display-title text-lg tabular-nums">
          {formatPrice(order.totalCents, currency)}
        </span>
      </div>

      {order.note ? (
        <p className="mt-3 rounded-lg bg-surface-raised px-3 py-2 text-sm text-ink-soft">
          « {order.note} »
        </p>
      ) : null}
    </>
  )
}
