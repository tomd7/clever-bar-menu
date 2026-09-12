import { Armchair, ArrowLeft, Download, Printer } from 'lucide-react'
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

import { ActionButton } from '#/components/buttons/action-button'
import { EmptyState } from '#/components/empty-state'
import { ErrorNote } from '#/components/error-note'
import { NavLink } from '#/components/nav-link'
import {
  Skeleton,
  SkeletonHeader,
  SkeletonLine,
  SkeletonScreen,
} from '#/components/skeleton'
import { isLocalOrigin, venueQrSvg } from '#/features/venues/qr'
import { parseOrderSettings, tableName } from '#/lib/order-settings'
import { publicMenuUrl } from '#/lib/public-menu-url'
import { venueBySlugQueryOptions } from '#/features/venues/api'
import { venueTablesQueryOptions } from '#/features/venues/tables-api'

import type { Venue } from '#/lib/supabase'

/**
 * Feuille à imprimer : les QR codes d'un établissement.
 *
 * **Two sheets, chosen by the venue's order reference.**
 *
 * - **By name** — the default — it is one code for the whole venue, stuck on
 *   every table: the menu is identical everywhere, and ordering calls the
 *   customer by first name, so a table would be inert.
 * - **By table**, it prints **one code per table**, the table's number and area
 *   under each. Each code carries the table's opaque public id
 *   (`/m/<slug>?table=<id>`, written by `lib/public-menu-url.ts`), never its
 *   number: renumbering a table keeps its code valid, and deleting one makes
 *   its code fall back to the picker on the customer menu. The venue-wide code
 *   keeps working in that mode too — it opens the picker — and stays
 *   downloadable from here, for a counter or a window.
 *
 * L'écran prend le slug et fait sa requête, comme `MenuEditor` : le fichier de
 * route ne porte que du routage. `window.location.origin` est lu au rendu et
 * non stocké — `_authenticated` est en `ssr: false`, ce composant ne s'exécute
 * donc que dans le navigateur, où `window` existe toujours.
 */
export function VenueQr({ venueSlug }: { venueSlug: string }) {
  const venueQuery = useQuery(venueBySlugQueryOptions(venueSlug))

  if (venueQuery.isPending) {
    return <VenueQrSkeleton />
  }

  if (venueQuery.isError) {
    return <ErrorNote>{venueQuery.error.message}</ErrorNote>
  }

  const venue = venueQuery.data
  const origin = window.location.origin

  return parseOrderSettings(venue).reference === 'table' ? (
    <TableQrSheet venue={venue} origin={origin} />
  ) : (
    <QrSheet venue={venue} origin={origin} />
  )
}

/**
 * Hands an SVG to the browser as a file. The code is already in memory; a
 * `Blob` URL saves a round trip and is revoked as soon as the click is issued.
 */
function downloadSvg(svg: string, fileName: string) {
  const blob = new Blob([svg], { type: 'image/svg+xml' })
  const href = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = href
  link.download = fileName
  link.click()
  URL.revokeObjectURL(href)
}

/** The warning under a header when the codes would encode `localhost`. */
function LocalOriginWarning({ origin }: { origin: string }) {
  if (!isLocalOrigin(origin)) return null

  return (
    <ErrorNote>
      Ce code pointe vers <code>{origin}</code>, une adresse qui n’existe que
      sur cet ordinateur. Imprimé, il ne mènerait nulle part. Générez le code
      depuis le site en ligne.
    </ErrorNote>
  )
}

/**
 * La feuille elle-même, une fois l'établissement connu.
 *
 * Séparée pour que les hooks de rendu — `useMemo` sur l'encodage — ne soient
 * pas appelés derrière les retours anticipés de chargement et d'erreur.
 */
function QrSheet({ venue, origin }: { venue: Venue; origin: string }) {
  const url = publicMenuUrl(origin, venue.slug)

  /*
    L'encodage n'est refait que si l'URL change. Il est rapide, mais il produit
    une chaîne de plusieurs kilo-octets réinjectée dans le DOM : la mémoriser
    évite de reconstruire tout le SVG à chaque rendu du composant.
  */
  const svg = useMemo(() => venueQrSvg(url), [url])

  return (
    <div className="page-wrap px-0">
      <div className="no-print">
        {/*
          Masqué à partir de `lg` : la colonne du back-office y donne les
          sections de l'établissement. En dessous, elle n'existe pas et ce lien
          reste la seule sortie.
        */}
        <NavLink
          to="/admin/$venueSlug"
          params={{ venueSlug: venue.slug }}
          icon={ArrowLeft}
          className="lg:hidden"
        >
          Retour à la carte
        </NavLink>

        <header className="mt-2 lg:mt-0">
          <p className="island-kicker">QR code</p>
          <h1 className="display-title mt-1 text-2xl leading-tight sm:text-3xl">
            {venue.name}
          </h1>
          <p className="mt-2 max-w-prose text-sm text-ink-soft">
            Imprimez ce code et posez-le sur les tables. Vos clients le scannent
            et lisent la carte, sans compte ni application.
          </p>
        </header>

        <LocalOriginWarning origin={origin} />
      </div>

      {/*
        La feuille elle-même. Fond blanc explicite et non la surface du thème :
        c'est ce carré qui part à l'imprimante, et un lecteur de QR s'appuie sur
        le contraste entre les modules et leur fond.
      */}
      <section className="print-sheet mt-6 rounded-2xl border border-line bg-white p-6 text-center sm:p-10">
        <p className="display-title text-xl text-black">{venue.name}</p>
        <p className="mt-1 text-sm text-neutral-600">
          Scannez pour consulter la carte
        </p>

        <div
          className="mx-auto mt-6 w-full max-w-64 [&>svg]:h-auto [&>svg]:w-full"
          /*
            `renderSVG` ne produit que des tracés géométriques : l'URL est
            encodée dans la disposition des modules, jamais écrite en texte
            dans le balisage. Rien de saisi par un gérant n'atterrit ici.
          */
          dangerouslySetInnerHTML={{ __html: svg }}
        />

        <p className="mt-6 font-mono text-xs break-all text-neutral-600">
          {url}
        </p>
      </section>

      <div className="no-print mt-4 flex flex-wrap gap-2">
        <ActionButton icon={Printer} onClick={() => window.print()}>
          Imprimer
        </ActionButton>
        <ActionButton
          icon={Download}
          variant="outline"
          onClick={() => downloadSvg(svg, `qr-${venue.slug}.svg`)}
        >
          Télécharger le SVG
        </ActionButton>
      </div>

      <p className="no-print mt-3 max-w-prose text-xs text-ink-soft">
        Le SVG est un fichier vectoriel : il reste net à n’importe quelle
        taille, d’un sous-bock à une affiche.
      </p>
    </div>
  )
}

/**
 * One code per table, on a grid made to be printed and cut out.
 *
 * On screen the grid follows the width — two cards on a phone, four on a
 * desktop; on paper `venue-qr.css` fixes it at three a row, turns the card
 * borders into cutting lines and keeps a card from splitting across pages.
 *
 * Every card repeats the venue's name: a code cut out and stuck on a table has
 * lost the sheet it came from.
 */
function TableQrSheet({ venue, origin }: { venue: Venue; origin: string }) {
  const tablesQuery = useQuery(venueTablesQueryOptions(venue.id))
  const tables = tablesQuery.data

  /* The venue-wide code, still valid in table mode: it opens the picker. */
  const venueSvg = useMemo(
    () => venueQrSvg(publicMenuUrl(origin, venue.slug)),
    [origin, venue.slug],
  )

  /*
    Every code encoded once per list, not once per render: forty tables are
    forty SVG strings of several kilobytes each.
  */
  const cards = useMemo(
    () =>
      (tables ?? []).map((table) => ({
        table,
        svg: venueQrSvg(publicMenuUrl(origin, venue.slug, table.public_id)),
      })),
    [tables, origin, venue.slug],
  )

  return (
    <div className="page-wrap px-0">
      <div className="no-print">
        <NavLink
          to="/admin/$venueSlug"
          params={{ venueSlug: venue.slug }}
          icon={ArrowLeft}
          className="lg:hidden"
        >
          Retour à la carte
        </NavLink>

        <header className="mt-2 lg:mt-0">
          <p className="island-kicker">QR codes des tables</p>
          <h1 className="display-title mt-1 text-2xl leading-tight sm:text-3xl">
            {venue.name}
          </h1>
          <p className="mt-2 max-w-prose text-sm text-ink-soft">
            Un code par table : imprimez la feuille, découpez, posez chaque code
            sur sa table. La commande d’un client part avec la table dont il a
            scanné le code — renuméroter une table ne change pas son code.
          </p>
          <NavLink
            to="/admin/$venueSlug/tables"
            params={{ venueSlug: venue.slug }}
            icon={Armchair}
            className="mt-1 font-medium"
          >
            Gérer les tables
          </NavLink>
        </header>

        <LocalOriginWarning origin={origin} />
      </div>

      {tablesQuery.isPending ? (
        <div className="mt-6 grid grid-cols-2 gap-3 rounded-2xl border border-line bg-white p-3 sm:grid-cols-3 sm:p-6 lg:grid-cols-4">
          {[0, 1, 2].map((index) => (
            <Skeleton
              key={index}
              className="aspect-[3/4] w-full rounded-xl bg-neutral-200"
              delay={200 + index * 40}
            />
          ))}
        </div>
      ) : tablesQuery.isError ? (
        <ErrorNote className="mt-6">{tablesQuery.error.message}</ErrorNote>
      ) : cards.length === 0 ? (
        <EmptyState
          icon={Armchair}
          title="Aucune table"
          className="no-print mt-6"
        >
          Ajoutez vos tables pour imprimer leurs codes. En attendant, le code
          général mène à la carte, et le client y choisit sa table.
        </EmptyState>
      ) : (
        <section
          aria-label="QR codes des tables"
          className="print-sheet qr-grid mt-6 grid grid-cols-2 gap-3 rounded-2xl border border-line bg-white p-3 sm:grid-cols-3 sm:p-6 lg:grid-cols-4"
        >
          {cards.map(({ table, svg }) => (
            <article
              key={table.id}
              className="qr-card flex min-w-0 flex-col items-center rounded-xl border border-neutral-200 p-3 text-center"
            >
              <p className="w-full truncate text-[0.6875rem] text-neutral-600">
                {venue.name}
              </p>
              <div
                className="mt-2 w-full [&>svg]:h-auto [&>svg]:w-full"
                /* Geometry only, as on the single sheet: nothing typed lands here. */
                dangerouslySetInnerHTML={{ __html: svg }}
              />
              <p className="display-title mt-2 w-full text-lg leading-tight wrap-break-word text-black">
                {tableName(table.number, table.label)}
              </p>
              <p className="mt-0.5 text-[0.6875rem] text-neutral-600">
                Scannez pour consulter la carte
              </p>
            </article>
          ))}
        </section>
      )}

      <div className="no-print mt-4 flex flex-wrap gap-2">
        <ActionButton
          icon={Printer}
          onClick={() => window.print()}
          disabled={cards.length === 0}
        >
          Imprimer
        </ActionButton>
        <ActionButton
          icon={Download}
          variant="outline"
          onClick={() => downloadSvg(venueSvg, `qr-${venue.slug}.svg`)}
        >
          Code général (SVG)
        </ActionButton>
      </div>

      <p className="no-print mt-3 max-w-prose text-xs text-ink-soft">
        Le code général mène à la carte sans table : le client choisit la sienne
        avant d’envoyer. Utile au comptoir ou en vitrine.
      </p>
    </div>
  )
}

/**
 * L'attente de la feuille à imprimer.
 *
 * La feuille reste blanche pendant le chargement, comme après : c'est le carré
 * qui part à l'imprimante, et le voir se poser d'emblée dit ce qu'on est venu
 * chercher. Ses barres passent donc au gris neutre plutôt qu'à la surface du
 * thème — sur un fond blanc en mode sombre, la teinte d'encre de `bg-skeleton`
 * serait une tache d'ardoise sur du papier.
 *
 * Le carré du code garde son `aspect-square` et sa largeur maximale : c'est le
 * plus grand bloc de l'écran, et le laisser se déplier après coup ferait
 * descendre l'adresse et les deux boutons d'un tiers de page.
 */
function VenueQrSkeleton() {
  return (
    <SkeletonScreen label="Chargement du QR code…" className="page-wrap px-0">
      <Skeleton className="h-4 w-40 rounded-full lg:hidden" />

      {/* Deux lignes : la phrase d'explication tient sur deux à `max-w-prose`. */}
      <SkeletonHeader>
        <SkeletonLine className="mt-2 w-full max-w-prose" delay={110} />
        <SkeletonLine className="mt-1 w-64 max-w-full" delay={140} />
      </SkeletonHeader>

      <section className="mt-6 rounded-2xl border border-line bg-white p-6 text-center sm:p-10">
        <Skeleton
          className="mx-auto h-6 w-48 max-w-full bg-neutral-200"
          delay={200}
        />
        <Skeleton
          className="mx-auto mt-2 h-3.5 w-56 max-w-full rounded-full bg-neutral-200"
          delay={240}
        />

        <Skeleton
          className="mx-auto mt-6 aspect-square w-full max-w-64 rounded-lg bg-neutral-200"
          delay={280}
        />

        <Skeleton
          className="mx-auto mt-6 h-3 w-64 max-w-full rounded-full bg-neutral-200"
          delay={340}
        />
      </section>

      {/* « Imprimer » et « Télécharger le SVG », à leur hauteur de doigt. */}
      <div className="mt-4 flex flex-wrap gap-2">
        <Skeleton className="h-11 w-32" delay={400} />
        <Skeleton className="h-11 w-44" delay={430} />
      </div>
    </SkeletonScreen>
  )
}
