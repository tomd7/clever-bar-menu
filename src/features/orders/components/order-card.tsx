import { Ban, Check } from 'lucide-react'

import { ActionButton } from '#/components/buttons/action-button'
import {
  ADVANCE_LABEL,
  BAR_STATUS_LABEL,
  nextOrderStatus,
} from '#/features/orders/status'
import { DeleteButton } from '#/components/buttons/delete-button'
import { ErrorNote } from '#/components/error-note'
import { formatPrice } from '#/lib/money'
import { useAcceptOrder, useSetOrderStatus } from '#/features/orders/mutations'

import type { OrderWithItems } from '#/features/orders/api'

/**
 * Une commande sur l'écran du bar.
 *
 * Elle se lit dans l'ordre où on la traite : le prénom d'abord — c'est lui
 * qu'on appellera — puis ce qu'il faut préparer, puis le geste qui fait
 * avancer. Le total vient en dernier : il ne sert qu'au moment de l'encaisser,
 * qui n'est pas ce moment-ci.
 */
export function OrderCard({
  order,
  currency,
}: {
  order: OrderWithItems
  currency: string
}) {
  const accept = useAcceptOrder()
  const advance = useSetOrderStatus()

  const error = accept.error ?? advance.error
  const isPending = accept.isPending || advance.isPending
  const next = nextOrderStatus(order.status)
  const isNew = order.status === 'received'

  return (
    <li
      /*
        Une commande qui arrive apparaît : elle n'était pas là dix secondes
        plus tôt, et surgir sans transition se lit comme un défaut d'affichage.
        Court — 200 ms — parce que ce n'est pas un spectacle, c'est un signal.
      */
      className="panel rise-in rounded-2xl border border-line p-4 duration-200 sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="display-title text-lg leading-tight">
            {order.customer_name}
          </p>
          <p className="mt-0.5 text-xs text-ink-soft">
            <StatusChip status={order.status} /> ·{' '}
            {formatTime(order.created_at)}
          </p>
        </div>

        <p className="shrink-0 font-semibold tabular-nums">
          {formatPrice(order.total_cents, currency)}
        </p>
      </div>

      <ul className="mt-3 space-y-1 border-t border-line-soft pt-3">
        {order.items.map((item) => (
          <li key={item.id} className="flex gap-3 text-sm">
            {/*
              La quantité est en tête, en chiffres tabulaires : c'est la
              colonne que l'œil descend en préparant, et elle doit s'aligner
              d'une ligne à l'autre.
            */}
            <span className="w-6 shrink-0 font-semibold tabular-nums">
              {item.quantity}
            </span>
            <span className="min-w-0 flex-1">{item.name}</span>
          </li>
        ))}
      </ul>

      {order.note ? (
        <p className="mt-3 rounded-lg bg-surface-raised px-3 py-2 text-sm">
          « {order.note} »
        </p>
      ) : null}

      {/*
        Rien à faire sur une commande close : elle est là pour être relue, pas
        reprise. Un bouton grisé dirait qu'il existe un chemin.
      */}
      {isNew || next ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {isNew ? (
            <ActionButton
              icon={Check}
              onClick={() => accept.mutate(order.id)}
              disabled={isPending}
            >
              {accept.isPending ? 'Acceptation…' : 'Accepter'}
            </ActionButton>
          ) : null}

          {next ? (
            <ActionButton
              icon={Check}
              onClick={() =>
                advance.mutate({ orderId: order.id, status: next })
              }
              disabled={isPending}
            >
              {ADVANCE_LABEL[order.status]}
            </ActionButton>
          ) : null}

          {/*
            Annuler passe par la confirmation en deux temps du projet : il y a
            un client au bout, et un doigt qui glisse sur une tablette de
            comptoir ne doit pas effacer sa commande. `icon` et `confirmLabel`
            existent pour que le geste s'y nomme correctement — ce n'est pas
            une corbeille.
          */}
          <DeleteButton
            labelled
            icon={Ban}
            label="Annuler"
            confirmLabel="Annuler la commande"
            question={`Annuler la commande de ${order.customer_name} ? Le stock déjà décompté n’est pas remis.`}
            pending={isPending}
            onConfirm={() =>
              advance.mutate({ orderId: order.id, status: 'cancelled' })
            }
          />
        </div>
      ) : null}

      {error ? <ErrorNote>{error.message}</ErrorNote> : null}
    </li>
  )
}

/**
 * L'état, en pastille.
 *
 * Seule « Nouvelle » est teintée : c'est le seul état qui réclame un geste
 * immédiat. Colorer les quatre autres ferait un écran bariolé où plus rien ne
 * ressort — le même raisonnement que pour `StockBadge`, qui ne teinte que
 * l'épuisement.
 */
function StatusChip({ status }: { status: OrderWithItems['status'] }) {
  return (
    <span
      className={
        status === 'received'
          ? 'font-semibold text-bottle-deep'
          : 'text-ink-soft'
      }
    >
      {BAR_STATUS_LABEL[status]}
    </span>
  )
}

/**
 * L'heure d'arrivée, pas la durée d'attente.
 *
 * « 21:04 » se compare d'un coup d'œil à la pendule du bar et ne périme
 * jamais ; « il y a 3 minutes » obligerait à faire battre un compteur dans une
 * page déjà rafraîchie toutes les dix secondes, et serait faux entre deux
 * relèves.
 */
function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}
