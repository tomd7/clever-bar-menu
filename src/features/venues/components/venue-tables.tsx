import { Armchair, ArrowLeft, QrCode, Settings } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import { AddButton } from '#/components/buttons/add-button'
import { CancelButton } from '#/components/buttons/cancel-button'
import { DeleteButton } from '#/components/buttons/delete-button'
import { EditButton } from '#/components/buttons/edit-button'
import { EmptyState } from '#/components/empty-state'
import { ErrorNote } from '#/components/error-note'
import { NavLink } from '#/components/nav-link'
import { SaveButton } from '#/components/buttons/save-button'
import {
  Skeleton,
  SkeletonHeader,
  SkeletonLine,
  SkeletonScreen,
} from '#/components/skeleton'
import { TextField } from '#/components/form/text-field'
import { TABLE_LABEL_MAX, nextTableNumber } from '#/features/venues/tables'
import { parseOrderSettings, tableName } from '#/lib/order-settings'
import {
  useCreateVenueTable,
  useDeleteVenueTable,
  useUpdateVenueTable,
} from '#/features/venues/mutations'
import { venueBySlugQueryOptions } from '#/features/venues/api'
import { venueTablesQueryOptions } from '#/features/venues/tables-api'

import type { FormEvent } from 'react'
import type { Venue, VenueTable } from '#/lib/supabase'

/*
  The list's columns from `lg`, shared by the header row and every table row so
  the two cannot drift: number, area, the code's id, actions.
*/
const TABLE_COLUMNS = 'lg:grid-cols-[6rem_minmax(0,1fr)_8rem_6rem] lg:gap-x-4'

/**
 * A venue's tables: `/admin/$venueSlug/tables`.
 *
 * Each table is a number and an optional area, and each one gets its own QR
 * code on the sheet of `/admin/$venueSlug/qr`. The code carries the table's
 * opaque id, never its number — which is why renumbering or relabelling here
 * leaves every printed code valid, and why the screen says so.
 *
 * The screen exists whatever the venue's mode: tables are usually entered
 * **before** switching to « Par table », so the first order does not arrive at a
 * venue with nothing to pick from. In name mode it says the tables are not used
 * yet, and where to switch.
 *
 * Like `VenueQr`, it takes the slug and runs its own query: the route file
 * carries routing only.
 */
export function VenueTables({ venueSlug }: { venueSlug: string }) {
  const venueQuery = useQuery(venueBySlugQueryOptions(venueSlug))

  if (venueQuery.isPending) return <VenueTablesSkeleton />

  if (venueQuery.isError) {
    return <ErrorNote>{venueQuery.error.message}</ErrorNote>
  }

  /* `key`: switching venues from the rail must not keep the previous drafts. */
  return <VenueTablesScreen key={venueQuery.data.id} venue={venueQuery.data} />
}

function VenueTablesScreen({ venue }: { venue: Venue }) {
  const tablesQuery = useQuery(venueTablesQueryOptions(venue.id))
  const byTable = parseOrderSettings(venue).reference === 'table'

  return (
    <div className="page-wrap px-0">
      {/* Hidden from `lg`, where the column carries the same destination. */}
      <NavLink
        to="/admin/$venueSlug"
        params={{ venueSlug: venue.slug }}
        icon={ArrowLeft}
        className="lg:hidden"
      >
        Retour à la carte
      </NavLink>

      <header className="mt-2 lg:mt-0">
        <p className="island-kicker">Tables</p>
        <h1 className="display-title mt-1 text-2xl leading-tight sm:text-3xl">
          {venue.name}
        </h1>
        <p className="mt-2 max-w-prose text-sm text-ink-soft">
          Chaque table reçoit son propre QR code : une commande passée depuis ce
          code part avec sa table. Renuméroter ou renommer une table ne change
          pas son code imprimé.
        </p>

        {byTable ? (
          <NavLink
            to="/admin/$venueSlug/qr"
            params={{ venueSlug: venue.slug }}
            icon={QrCode}
            className="mt-1 font-medium"
          >
            Imprimer les QR codes des tables
          </NavLink>
        ) : (
          /*
            Not an error: entering the tables first is the right order. It only
            says why nothing changes for customers yet.
          */
          <div className="mt-3 max-w-prose rounded-lg bg-surface-raised px-3 py-2 text-sm">
            <p>
              Vos commandes sont encore au prénom : ces tables serviront dès que
              vous choisirez « Par table » dans les réglages.
            </p>
            <NavLink
              to="/admin/$venueSlug/reglages"
              params={{ venueSlug: venue.slug }}
              icon={Settings}
              className="font-medium"
            >
              Ouvrir les réglages
            </NavLink>
          </div>
        )}
      </header>

      {tablesQuery.isPending ? (
        <TablesSkeleton />
      ) : tablesQuery.isError ? (
        <ErrorNote className="mt-6">{tablesQuery.error.message}</ErrorNote>
      ) : (
        <>
          <AddTableForm venueId={venue.id} tables={tablesQuery.data} />
          <TableList tables={tablesQuery.data} />
        </>
      )}
    </div>
  )
}

/**
 * Adds a table.
 *
 * The number proposes the next free one and the area stays filled after an
 * add, so « Terrasse » 10, 11 and 12 are three presses of the button. Mounted
 * once the list has loaded, so the first proposal is computed against it.
 */
function AddTableForm({
  venueId,
  tables,
}: {
  venueId: string
  tables: Array<VenueTable>
}) {
  const create = useCreateVenueTable()

  const [number, setNumber] = useState(() => String(nextTableNumber(tables)))
  const [label, setLabel] = useState('')

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    create.mutate(
      { venueId, number, label },
      {
        onSuccess: (added) =>
          setNumber(
            String(nextTableNumber([...tables, { number: added } as const])),
          ),
      },
    )
  }

  return (
    <section className="panel mt-6 rounded-2xl p-4 sm:p-6">
      {/*
        The number and the area side by side from the phone up — a number is
        four digits wide — and the button under them, full width, within thumb
        reach. From `lg` the three share one row.
      */}
      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-[6rem_minmax(0,1fr)] gap-3 lg:grid-cols-[7rem_minmax(0,1fr)_auto] lg:items-end"
      >
        <TextField
          label="Numéro"
          surface="page"
          required
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={4}
          autoComplete="off"
          value={number}
          onChange={(event) => setNumber(event.target.value)}
        />
        <TextField
          label={
            <>
              Zone{' '}
              <span className="font-normal text-ink-soft">(facultatif)</span>
            </>
          }
          surface="page"
          maxLength={TABLE_LABEL_MAX}
          placeholder="Terrasse"
          autoComplete="off"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
        />
        <AddButton
          type="submit"
          surface="page"
          pending={create.isPending}
          disabled={!number.trim()}
          className="col-span-2 lg:col-span-1"
        >
          Ajouter la table
        </AddButton>
      </form>

      <p className="mt-3 text-xs text-ink-soft">
        Le numéro suivant se propose tout seul et la zone reste remplie : pour
        la terrasse, appuyez autant de fois qu’elle a de tables.
      </p>

      {create.error ? <ErrorNote>{create.error.message}</ErrorNote> : null}
    </section>
  )
}

function TableList({ tables }: { tables: Array<VenueTable> }) {
  if (tables.length === 0) {
    return (
      <EmptyState icon={Armchair} title="Aucune table" className="mt-6">
        Ajoutez vos tables : chacune aura son QR code, et un client qui scanne
        le code général choisira la sienne dans cette liste.
      </EmptyState>
    )
  }

  return (
    <section aria-labelledby="venue-tables-list" className="mt-6">
      <h2 id="venue-tables-list" className="island-kicker">
        {tables.length === 1 ? '1 table' : `${tables.length} tables`}
      </h2>

      <div className="panel mt-2 rounded-2xl">
        {/*
          Column headings from `lg`, where the rows spread into columns. Hidden
          from assistive technology: each cell says what it is itself.
        */}
        <div
          aria-hidden
          className={`hidden border-b border-line-soft px-5 py-2 text-xs font-medium text-ink-soft lg:grid ${TABLE_COLUMNS}`}
        >
          <span>Numéro</span>
          <span>Zone</span>
          <span>Code du QR</span>
          <span />
        </div>

        <ul className="divide-y divide-line-soft">
          {tables.map((table) => (
            <TableRow key={table.id} table={table} />
          ))}
        </ul>
      </div>
    </section>
  )
}

/**
 * One table: its name on the phone, its columns from `lg`, and its two
 * actions. Editing replaces the row in place, like renaming a category — the
 * list keeps its height and nothing jumps.
 */
function TableRow({ table }: { table: VenueTable }) {
  const [isEditing, setIsEditing] = useState(false)
  const [number, setNumber] = useState(String(table.number))
  const [label, setLabel] = useState(table.label ?? '')

  const update = useUpdateVenueTable()
  const remove = useDeleteVenueTable()

  const name = tableName(table.number, table.label)

  if (isEditing) {
    return (
      <li className="px-4 py-3 sm:px-5">
        <form
          onSubmit={(event) => {
            event.preventDefault()
            update.mutate(
              { tableId: table.id, number, label },
              { onSuccess: () => setIsEditing(false) },
            )
          }}
          className="grid grid-cols-[6rem_minmax(0,1fr)] gap-2 lg:grid-cols-[6rem_minmax(0,1fr)_auto] lg:items-end lg:gap-3"
        >
          <TextField
            label="Numéro"
            autoFocus
            required
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            autoComplete="off"
            value={number}
            onChange={(event) => setNumber(event.target.value)}
          />
          <TextField
            label="Zone"
            maxLength={TABLE_LABEL_MAX}
            placeholder="Terrasse"
            autoComplete="off"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
          />
          <div className="col-span-2 flex gap-2 lg:col-span-1">
            <SaveButton
              size="sm"
              pending={update.isPending}
              disabled={!number.trim()}
            />
            <CancelButton
              size="sm"
              onClick={() => {
                setIsEditing(false)
                update.reset()
              }}
            />
          </div>
        </form>

        {update.error ? <ErrorNote>{update.error.message}</ErrorNote> : null}
      </li>
    )
  }

  return (
    <li
      className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-1.5 sm:px-5 ${TABLE_COLUMNS}`}
    >
      <p className="min-w-0 truncate font-medium lg:hidden">{name}</p>

      <p className="hidden font-semibold tabular-nums lg:block">
        <span className="sr-only">Table </span>
        {table.number}
      </p>
      <p className="hidden min-w-0 truncate text-sm lg:block">
        {table.label ?? (
          <span className="text-ink-soft">
            <span aria-hidden>—</span>
            <span className="sr-only">Sans zone</span>
          </span>
        )}
      </p>
      <p className="hidden lg:block">
        <span className="sr-only">Code du QR : </span>
        <code className="font-mono text-xs text-ink-soft">
          {table.public_id}
        </code>
      </p>

      <div className="flex items-center justify-end gap-1">
        <EditButton
          label={`Modifier ${name}`}
          onClick={() => {
            /* The drafts start from the row as it is now, not as it was at mount. */
            setNumber(String(table.number))
            setLabel(table.label ?? '')
            setIsEditing(true)
          }}
        />
        <DeleteButton
          label={`Supprimer ${name}`}
          question={`Supprimer ${name} ? Son QR code imprimé mènera à la carte sans table : le client choisira la sienne.`}
          pending={remove.isPending}
          onConfirm={() => remove.mutate(table.id)}
        />
      </div>

      {remove.error ? (
        <ErrorNote className="col-span-full">{remove.error.message}</ErrorNote>
      ) : null}
    </li>
  )
}

/** The add form and three rows, at their heights. */
function TablesSkeleton() {
  return (
    <>
      <div className="panel mt-6 rounded-2xl p-4 sm:p-6">
        <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-3 lg:grid-cols-[7rem_minmax(0,1fr)_8rem] lg:items-end">
          <Skeleton className="h-11 w-full lg:h-10" delay={180} />
          <Skeleton className="h-11 w-full lg:h-10" delay={210} />
          <Skeleton
            className="col-span-2 h-11 w-full lg:col-span-1 lg:h-10"
            delay={240}
          />
        </div>
      </div>
      <div className="panel mt-8 space-y-4 rounded-2xl p-4 sm:p-5">
        <SkeletonLine className="w-32" delay={280} />
        <SkeletonLine className="w-40" delay={310} />
        <SkeletonLine className="w-28" delay={340} />
      </div>
    </>
  )
}

function VenueTablesSkeleton() {
  return (
    <SkeletonScreen label="Chargement des tables…" className="page-wrap px-0">
      <Skeleton className="h-4 w-40 rounded-full lg:hidden" />
      <SkeletonHeader>
        <SkeletonLine className="mt-2 w-full max-w-prose" delay={110} />
        <SkeletonLine className="mt-1 w-64 max-w-full" delay={140} />
      </SkeletonHeader>
      <TablesSkeleton />
    </SkeletonScreen>
  )
}
