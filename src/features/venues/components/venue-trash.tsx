import { RotateCcw, Trash2 } from 'lucide-react'

import { ActionButton } from '#/components/buttons/action-button'
import { ErrorNote } from '#/components/error-note'
import { useRestoreVenue } from '#/features/venues/mutations'

import type { Venue } from '#/lib/supabase'

/**
 * Les établissements supprimés, et le moyen de les remettre en service.
 *
 * La suppression est logique : la ligne reste en base avec sa carte, ses
 * photos et son slug. Cette section est ce qui rend ce choix visible — sans
 * elle, le gérant n'aurait aucune raison de croire que « supprimer » est
 * réversible, et l'archivage ne serait qu'une suppression déguisée.
 *
 * Aucun lien vers la carte : composer le menu d'un établissement hors service
 * n'a pas de sens. Il faut d'abord le restaurer.
 */
export function VenueTrash({ venues }: { venues: Array<Venue> }) {
  const restore = useRestoreVenue()

  if (venues.length === 0) return null

  return (
    <section className="mt-10">
      <h2 className="island-kicker flex items-center gap-2">
        <Trash2 className="size-3.5" />
        Corbeille
      </h2>
      <p className="mt-1 max-w-prose text-sm text-ink-soft">
        Leur carte publique ne répond plus. Tout est conservé : restaurer un
        établissement le remet en service tel qu'il était.
      </p>

      <ul className="mt-4 divide-y divide-line border-t border-line">
        {venues.map((venue) => (
          <li
            key={venue.id}
            className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3"
          >
            <div className="min-w-0 flex-1">
              <p className="font-medium text-ink-soft">{venue.name}</p>
              <p className="mt-0.5 text-xs text-ink-soft">
                <code>/m/{venue.slug}</code>
              </p>
            </div>

            <ActionButton
              icon={RotateCcw}
              variant="outline"
              disabled={restore.isPending}
              onClick={() => restore.mutate(venue.id)}
            >
              Restaurer
            </ActionButton>
          </li>
        ))}
      </ul>

      {restore.error ? <ErrorNote>{restore.error.message}</ErrorNote> : null}
    </section>
  )
}
