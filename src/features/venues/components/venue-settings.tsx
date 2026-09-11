import { ArrowLeft } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useRef, useState } from 'react'

import { CancelButton } from '#/components/buttons/cancel-button'
import { ErrorNote } from '#/components/error-note'
import { ImageField, useObjectUrl } from '#/components/form/image-field'
import { MenuAddress } from '#/components/back-office/menu-address'
import { MenuThemeField } from '#/features/venues/components/menu-theme-field'
import { NavLink } from '#/components/nav-link'
import { SaveButton } from '#/components/buttons/save-button'
import { Switch } from '#/components/ui/switch'
import { TextAreaField } from '#/components/form/textarea-field'
import { TextField } from '#/components/form/text-field'
import { VenueLogo } from '#/components/venue-logo'
import { cn } from '#/lib/utils.ts'
import {
  Skeleton,
  SkeletonAddress,
  SkeletonHeader,
  SkeletonLine,
  SkeletonScreen,
} from '#/components/skeleton'
import { guessLogoPlate } from '#/features/venues/logo'
import { parseMenuTheme } from '#/lib/menu-theme'
import { useUpdateVenue } from '#/features/venues/mutations'
import { venueBySlugQueryOptions } from '#/features/venues/api'
import { venueImageUrl } from '#/lib/venue-images'

import type { MenuTheme } from '#/lib/menu-theme'
import type { Venue } from '#/lib/supabase'

/**
 * Réglages d'un établissement : son nom, sa description, son logo, le thème de
 * sa carte.
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

  /*
    The logo takes three pieces of state, where a product's photo takes two:
    `logoFile` is picked but not uploaded, `logoPath` is what the row holds (or
    `null` once removed), `logoPlate` is the plate. Nothing is uploaded before
    « Enregistrer » — a manager who cancels leaves no file behind.
  */
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPath, setLogoPath] = useState<string | null>(venue.logo_path)
  const [logoPlate, setLogoPlate] = useState(venue.logo_plate)

  /*
    The file whose plate is being guessed. The guess is asynchronous, and
    picking a second logo before the first one resolves would otherwise let the
    stale answer land last.
  */
  const guessedFile = useRef<File | null>(null)

  const pickedLogoUrl = useObjectUrl(logoFile)
  const logoUrl = pickedLogoUrl ?? (logoPath ? venueImageUrl(logoPath) : null)
  const hasLogo = logoFile !== null || logoPath !== null

  const isDirty =
    name !== venue.name ||
    description !== (venue.description ?? '') ||
    theme !== venue.theme ||
    logoFile !== null ||
    logoPath !== venue.logo_path ||
    (hasLogo && logoPlate !== venue.logo_plate)

  function pickLogo(file: File) {
    guessedFile.current = file
    setLogoFile(file)
    void guessLogoPlate(file).then((plate) => {
      if (guessedFile.current === file) setLogoPlate(plate)
    })
  }

  function removeLogo() {
    guessedFile.current = null
    setLogoFile(null)
    setLogoPath(null)
  }

  function reset() {
    setName(venue.name)
    setDescription(venue.description ?? '')
    setTheme(parseMenuTheme(venue.theme))
    guessedFile.current = null
    setLogoFile(null)
    setLogoPath(venue.logo_path)
    setLogoPlate(venue.logo_plate)
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
          update.mutate(
            {
              venueId: venue.id,
              name,
              description,
              theme,
              logoFile,
              logoPath,
              logoPlate,
              previousLogoPath: venue.logo_path,
            },
            {
              /*
                The picked file has become a stored path: the draft takes it, so
                it matches the row again. Otherwise the form would stay dirty
                after a successful save, and a second click would upload the
                same logo twice.
              */
              onSuccess: (saved) => {
                guessedFile.current = null
                setLogoFile(null)
                setLogoPath(saved.logoPath)
              },
            },
          )
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

            {/*
              The logo belongs to the identity, not to the theme: it is the bar's
              own mark, and it stays when the board changes colour. Its effect is
              shown in the preview next door, on both boards.
            */}
            <ImageField
              label={
                <>
                  Logo{' '}
                  <span className="font-normal text-ink-soft">
                    (facultatif)
                  </span>
                </>
              }
              addLabel="Ajouter un logo"
              hint="PNG ou WebP à fond transparent de préférence, JPEG accepté. L’image est réduite dans le navigateur avant l’envoi."
              fit="contain"
              previewUrl={logoUrl}
              onSelect={pickLogo}
              onRemove={removeLogo}
            />

            {/*
              The switch only exists while there is a logo to lay on the plate.
              Its value is guessed from the file when it is picked — the manager
              should rarely touch it, and needs it the day the guess is wrong.

              A native `<label>` around the switch: Radix renders a `<button>`,
              which is labelable, so the text names it and a tap on the text
              toggles it — no `id` to wire.
            */}
            {hasLogo ? (
              <label className="flex min-h-11 cursor-pointer items-start gap-3 select-none">
                <Switch
                  checked={logoPlate}
                  onCheckedChange={setLogoPlate}
                  className="mt-0.5"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">
                    Pastille claire derrière le logo
                  </span>
                  <span className="mt-0.5 block text-xs text-ink-soft">
                    Pour un logo foncé, qui disparaîtrait sur le bandeau. Réglée
                    d’après l’image : vérifiez l’aperçu.
                  </span>
                </span>
              </label>
            ) : null}
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

            Et il le montre **dans les deux températures**. Le mode sombre suit
            le téléphone, sans interrupteur : un gérant qui règle sa carte à midi
            choisit donc aussi, sans le savoir, ce que lira un client à 23h —
            l'heure où une carte de bar est le plus consultée. Aller vérifier à
            une table n'est pas un flux.
          */}
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <ThemePreview
              theme={theme}
              mode="light"
              name={name || venue.name}
              logoUrl={logoUrl}
              logoPlate={logoPlate}
            />
            <ThemePreview
              theme={theme}
              mode="dark"
              name={name || venue.name}
              logoUrl={logoUrl}
              logoPlate={logoPlate}
            />
          </div>
        </section>
      </form>
    </div>
  )
}

/**
 * La carte telle qu'un client la verra, dans une température donnée.
 *
 * `mode` pose `light` ou `dark` sur l'enveloppe, et ces deux classes déclarent
 * la palette maison entière (voir `styles/theme.css`) : c'est ce qui permet à un
 * aperçu de jour d'exister au milieu d'un back-office passé en nuit, ce qu'une
 * page ne sait pas faire autrement — `.dark` vit sur `<html>` et surplombe tout.
 * Le fond de l'enveloppe est donc le vrai fond de page du client, et non celui
 * du gérant, sans quoi l'aperçu mentirait sur la seule chose qu'il promet.
 *
 * Le thème, lui, va sur l'élément intérieur : `styles/menu-theme.css` cible
 * `.light [data-menu-theme]`, un descendant.
 */
function ThemePreview({
  theme,
  mode,
  name,
  logoUrl,
  logoPlate,
}: {
  theme: MenuTheme
  mode: 'light' | 'dark'
  name: string
  logoUrl: string | null
  logoPlate: boolean
}) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-line bg-ground p-2',
        mode,
      )}
    >
      <div
        data-menu-theme={theme}
        className="rounded-lg bg-board px-3 py-4 text-on-board"
      >
        {/*
          The same component the carte renders, at preview scale — so the plate
          the manager judges here is the one a customer will see.
        */}
        {logoUrl ? (
          <VenueLogo
            src={logoUrl}
            plate={logoPlate}
            size="preview"
            className="mb-2"
          />
        ) : null}
        <p className="text-[0.6875rem] font-semibold text-bottle-chalk">
          La carte
        </p>
        <p className="display-title mt-0.5 truncate text-base leading-tight">
          {name}
        </p>
        <span className="mt-2 inline-flex rounded-full bg-bottle px-2 py-0.5 text-[0.6875rem] font-medium text-on-bottle">
          Bières pression
        </span>
      </div>

      {/*
        Une ligne de carte sous le bandeau : c'est là que vit l'autre moitié du
        thème — l'accent de texte, qui bascule d'une température à l'autre alors
        que le bandeau, lui, est figé.
      */}
      <div data-menu-theme={theme} className="px-3 pt-3 pb-1">
        <p className="flex items-baseline justify-between gap-2 text-xs">
          <span className="truncate font-semibold text-ink">Jupiler</span>
          <span className="shrink-0 font-semibold text-ink tabular-nums">
            2,50 €
          </span>
        </p>
        <p className="mt-1 text-[0.6875rem] font-semibold text-bottle-deep">
          {mode === 'light' ? 'Le jour' : 'Le soir'}
        </p>
      </div>
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
          <Skeleton className="mt-4 h-16 w-48" delay={280} />
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
