import { ArrowLeft, Download, Printer } from 'lucide-react'
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

import { ActionButton } from '#/components/buttons/action-button'
import { ErrorNote } from '#/components/error-note'
import { NavLink } from '#/components/nav-link'
import { isLocalOrigin, venueQrSvg } from '#/features/venues/qr'
import { publicMenuUrl } from '#/lib/public-menu-url'
import { venueBySlugQueryOptions } from '#/features/venues/api'

import type { Venue } from '#/lib/supabase'

/**
 * Feuille à imprimer : le QR code d'un établissement et son adresse.
 *
 * Le code encode l'URL publique de la carte. Un seul code pour tout
 * l'établissement, collé à chaque table — la carte y est identique, et
 * distinguer les tables n'apporterait rien tant qu'aucune fonctionnalité ne
 * lit ce numéro.
 *
 * L'écran prend le slug et fait sa requête, comme `MenuEditor` : le fichier de
 * route ne porte que du routage. `window.location.origin` est lu au rendu et
 * non stocké — `_authenticated` est en `ssr: false`, ce composant ne s'exécute
 * donc que dans le navigateur, où `window` existe toujours.
 */
export function VenueQr({ venueSlug }: { venueSlug: string }) {
  const venueQuery = useQuery(venueBySlugQueryOptions(venueSlug))

  if (venueQuery.isPending) {
    return <p className="text-sm text-ink-soft">Chargement…</p>
  }

  if (venueQuery.isError) {
    return <ErrorNote>{venueQuery.error.message}</ErrorNote>
  }

  return <QrSheet venue={venueQuery.data} origin={window.location.origin} />
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

  function download() {
    const blob = new Blob([svg], { type: 'image/svg+xml' })
    const href = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = href
    link.download = `qr-${venue.slug}.svg`
    link.click()
    URL.revokeObjectURL(href)
  }

  return (
    <div className="page-wrap px-0">
      <div className="no-print">
        {/*
          Masqué à partir de `lg` : la colonne du back-office y donne les deux
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

        {isLocalOrigin(origin) ? (
          <ErrorNote>
            Ce code pointe vers <code>{origin}</code>, une adresse qui n’existe
            que sur cet ordinateur. Imprimé, il ne mènerait nulle part. Générez
            le code depuis le site en ligne.
          </ErrorNote>
        ) : null}
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
        <ActionButton icon={Download} variant="outline" onClick={download}>
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
