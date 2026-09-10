import { ArrowLeft } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import { CancelButton } from '#/components/buttons/cancel-button'
import { ErrorNote } from '#/components/error-note'
import { MenuAddress } from '#/components/back-office/menu-address'
import { MenuThemeField } from '#/features/venues/components/menu-theme-field'
import { NavLink } from '#/components/nav-link'
import { SaveButton } from '#/components/buttons/save-button'
import { TextAreaField } from '#/components/form/textarea-field'
import { TextField } from '#/components/form/text-field'
import {
  Skeleton,
  SkeletonAddress,
  SkeletonHeader,
  SkeletonLine,
  SkeletonScreen,
} from '#/components/skeleton'
import { parseMenuTheme } from '#/lib/menu-theme'
import { useUpdateVenue } from '#/features/venues/mutations'
import { venueBySlugQueryOptions } from '#/features/venues/api'

import type { MenuTheme } from '#/lib/menu-theme'
import type { Venue } from '#/lib/supabase'

/**
 * Réglages d'un établissement : son nom, sa description, le thème de sa carte.
 *
 * L'écran qui manquait — rien ne permettait de rectifier un nom mal saisi, et
 * la description qui s'affiche sous le titre de la carte publique n'était
 * atteignable que par le script de seed.
 *
 * Comme `VenueQr` et `MenuEditor`, il prend le slug et fait sa requête : le
 * fichier de route ne porte que du routage. C'est d'ailleurs la même requête
 * que celle du QR code, donc passer de l'un à l'autre ne coûte rien.
 */
export function VenueSettings({ venueSlug }: { venueSlug: string }) {
  const venueQuery = useQuery(venueBySlugQueryOptions(venueSlug))

  if (venueQuery.isPending) {
    return <VenueSettingsSkeleton />
  }

  if (venueQuery.isError) {
    return <ErrorNote>{venueQuery.error.message}</ErrorNote>
  }

  /*
    `key` : sans elle, passer d'un établissement à l'autre depuis la colonne
    rendrait le même composant avec de nouvelles props, et les brouillons
    resteraient sur le bar précédent — à un clic d'être enregistrés sur
    celui-ci. La clé le remonte à neuf, avec ses états initialisés du bon
    établissement.
  */
  return <VenueSettingsForm key={venueQuery.data.id} venue={venueQuery.data} />
}

/**
 * Le formulaire, une fois l'établissement connu.
 *
 * Séparé pour que ses `useState` ne soient pas appelés derrière les retours
 * anticipés de chargement et d'erreur — le même découpage que `VenueQr` et
 * `QrSheet`.
 */
function VenueSettingsForm({ venue }: { venue: Venue }) {
  const update = useUpdateVenue()

  const [name, setName] = useState(venue.name)
  const [description, setDescription] = useState(venue.description ?? '')
  const [theme, setTheme] = useState<MenuTheme>(parseMenuTheme(venue.theme))

  const isDirty =
    name !== venue.name ||
    description !== (venue.description ?? '') ||
    theme !== venue.theme

  function reset() {
    setName(venue.name)
    setDescription(venue.description ?? '')
    setTheme(parseMenuTheme(venue.theme))
    update.reset()
  }

  return (
    <div className="page-wrap px-0">
      {/*
        Masqué à partir de `lg` : la colonne du back-office y donne les sections
        de l'établissement. En dessous, elle n'existe pas et ce lien reste la
        seule sortie — même règle que sur l'écran du QR code.
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
        <p className="island-kicker">Réglages</p>
        <h1 className="display-title mt-1 text-2xl leading-tight sm:text-3xl">
          {venue.name}
        </h1>
        <MenuAddress slug={venue.slug} className="mt-1" />

        <p className="mt-2 max-w-prose text-sm text-ink-soft">
          L’adresse publique ne change pas : c’est elle qu’encodent les QR codes
          déjà posés sur vos tables.
        </p>
      </header>

      <form
        onSubmit={(event) => {
          event.preventDefault()
          update.mutate({
            venueId: venue.id,
            name,
            description,
            theme,
          })
        }}
        /*
          Une colonne au téléphone, deux à partir de `lg`. L'ordre du DOM est
          déjà l'ordre de lecture — identité, thème, actions —, si bien que la
          grille ne fait que replacer, jamais réordonner.
        */
        className="mt-6 space-y-4 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:items-start lg:gap-6 lg:space-y-0"
      >
        <section className="panel rounded-2xl p-4 sm:p-6">
          <h2 className="text-sm font-semibold">Identité</h2>

          {/*
            Le nom et la description sont empilés, y compris au bureau : une
            zone de texte veut de la largeur, pas un voisin de colonne.
          */}
          <div className="mt-4 space-y-4">
            <TextField
              label="Nom de l’établissement"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={80}
              required
              autoComplete="off"
            />

            <TextAreaField
              label="Description"
              hint="Une phrase, affichée sous le nom sur la carte publique."
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={280}
              rows={3}
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <SaveButton pending={update.isPending} disabled={!isDirty} />
            {isDirty ? (
              <CancelButton onClick={reset} disabled={update.isPending} />
            ) : null}

            {/*
              La confirmation disparaît dès la première frappe suivante : elle
              répond de ce qui est en base, et le formulaire ne le dit plus dès
              qu'il a changé. `role="status"` la fait lire sans voler le focus.
            */}
            {update.isSuccess && !isDirty ? (
              <p
                role="status"
                className="animate-in fade-in-0 text-sm text-bottle-deep duration-200 ease-out"
              >
                Réglages enregistrés.
              </p>
            ) : null}
          </div>

          {update.isError ? (
            <ErrorNote>{update.error.message}</ErrorNote>
          ) : null}
        </section>

        <section className="panel rounded-2xl p-4 sm:p-6">
          <MenuThemeField value={theme} onChange={setTheme} />

          {/*
            L'aperçu suit le **brouillon**, pas la ligne enregistrée : choisir
            un thème sans le voir reviendrait à choisir un habillage de mémoire.
            Il rejoue le bandeau de la carte, qui est ce que le thème repeint.
          */}
          <div
            data-menu-theme={theme}
            className="mt-4 overflow-hidden rounded-xl bg-board px-4 py-5 text-on-board"
          >
            <p className="text-[0.8125rem] font-semibold text-bottle-chalk">
              La carte
            </p>
            <p className="display-title mt-1 text-xl leading-tight">
              {name || venue.name}
            </p>
            <span className="mt-3 inline-flex rounded-full bg-bottle px-3 py-1 text-xs font-medium text-on-bottle">
              Bières pression
            </span>
          </div>
        </section>
      </form>
    </div>
  )
}

/**
 * L'attente des réglages.
 *
 * Elle pose les deux panneaux à leur place et à leur largeur : c'est une page
 * de formulaire, et voir la colonne de droite arriver après coup déplacerait
 * tout ce que le gérant est en train de lire.
 */
function VenueSettingsSkeleton() {
  return (
    <SkeletonScreen label="Chargement des réglages…" className="page-wrap px-0">
      <Skeleton className="h-4 w-40 rounded-full lg:hidden" />

      <SkeletonHeader>
        <SkeletonAddress delay={110} />
        <SkeletonLine className="mt-2 w-full max-w-prose" delay={140} />
      </SkeletonHeader>

      <div className="mt-6 space-y-4 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:items-start lg:gap-6 lg:space-y-0">
        <div className="panel rounded-2xl p-4 sm:p-6">
          <Skeleton className="h-4 w-20 rounded-full" delay={180} />
          <Skeleton className="mt-4 h-11 w-full" delay={220} />
          <Skeleton className="mt-4 h-20 w-full" delay={260} />
          <Skeleton className="mt-4 h-11 w-36" delay={300} />
        </div>

        <div className="panel rounded-2xl p-4 sm:p-6">
          <Skeleton className="h-4 w-32 rounded-full" delay={200} />
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Skeleton className="h-14 w-full" delay={240} />
            <Skeleton className="h-14 w-full" delay={280} />
          </div>
          <Skeleton className="mt-4 h-28 w-full" delay={320} />
        </div>
      </div>
    </SkeletonScreen>
  )
}
