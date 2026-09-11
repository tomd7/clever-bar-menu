import { ArrowLeft, Check } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'

import { CancelButton } from '#/components/buttons/cancel-button'
import { ErrorNote } from '#/components/error-note'
import { ImageField, useObjectUrl } from '#/components/form/image-field'
import { MenuAddress } from '#/components/back-office/menu-address'
import { MenuFontField } from '#/features/venues/components/menu-font-field'
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
import { MENU_FONT_ROLES, menuFace, parseMenuFonts } from '#/lib/menu-fonts'
import { useUpdateVenue } from '#/features/venues/mutations'
import { venueBySlugQueryOptions } from '#/features/venues/api'
import { venueImageUrl } from '#/lib/venue-images'

import type { MenuFonts } from '#/lib/menu-fonts'
import type { MenuTheme } from '#/lib/menu-theme'
import type { Venue } from '#/lib/supabase'

/**
 * How long « Réglages enregistrés. » stands in the save bar before the bar
 * leaves. Long enough to be read, short enough that the bar doesn't keep
 * covering the bottom of the form once there is nothing left to do.
 */
const SAVED_NOTICE_MS = 2500

/*
  The screen's grid, shared with its skeleton so the two can't drift apart.

  One column on the phone. From `lg`, the controls on the left and the preview
  on the right. The preview column is narrower at `lg`, where the two boards
  stack, because at 1024px a 24rem column would leave the form barely 250px.
  At `xl` it takes 24rem and the boards sit side by side: at 22rem each board
  was 116px inside, and « Chez Lambert » already ended in an ellipsis.

  `grid-cols-1` on the phone is not a restatement of the default. Without it
  the single column is an implicit `auto` track, sized to its content's
  max-content width: the font rails' unwrapped chips widened it past the
  screen, and each preview board came out 426px wide in a 390px viewport.
  `grid-cols-1` is `minmax(0, 1fr)`, which lets the rails scroll instead.
*/
const SETTINGS_GRID =
  'grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,18rem)] lg:gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]'

/*
  The preview's cell: the right column, over the three control panels. It
  spans their rows and sits at the top of them (`self-start`) — stretched to
  the rows' height, a sticky box has nowhere to stick.
*/
const PREVIEW_CELL =
  'lg:sticky lg:top-10 lg:col-start-2 lg:row-span-3 lg:row-start-1 lg:self-start'

/**
 * Réglages d'un établissement : son nom, sa description, son logo, le thème et
 * les polices de sa carte.
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

  /* The row's faces, parsed: what the draft starts from and is compared to. */
  const savedFonts = parseMenuFonts(venue)
  const [fonts, setFonts] = useState<MenuFonts>(savedFonts)

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
    MENU_FONT_ROLES.some((role) => fonts[role.id] !== savedFonts[role.id]) ||
    logoFile !== null ||
    logoPath !== venue.logo_path ||
    (hasLogo && logoPlate !== venue.logo_plate)

  /*
    The confirmation answers for what is in the database, so it only stands
    while the form still matches it — the next keystroke takes it away. It also
    leaves on its own after a moment, taking the bar with it: `reset()` clears
    `isSuccess`, and React Query stays the one holding that state. A keystroke,
    a new submit or an unmount tears the timer down with the state that
    started it, so a late `reset()` can't wipe a save still in flight.
  */
  const showSaved = update.isSuccess && !isDirty
  const resetUpdate = update.reset

  useEffect(() => {
    if (!showSaved) return
    const timer = setTimeout(resetUpdate, SAVED_NOTICE_MS)
    return () => clearTimeout(timer)
  }, [showSaved, resetUpdate])

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
    setFonts(savedFonts)
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
              fonts,
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
          The DOM order is the phone's reading order — identity, theme, preview,
          fonts, save bar — and the grid only moves the preview from `lg`. That
          reordering is safe because the preview holds no control: the tab
          order, which follows the DOM, never jumps across the screen.
        */
        className={cn('mt-6', SETTINGS_GRID)}
      >
        <section className="panel rounded-2xl p-4 sm:p-6 lg:col-start-1 lg:row-start-1">
          <h2 className="text-sm font-semibold">Identité</h2>
          <p className="mt-1 text-xs text-ink-soft">
            Ce que vos clients lisent en haut de votre carte.
          </p>

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
              shown in the preview, on both boards.
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
        </section>

        <section className="panel rounded-2xl p-4 sm:p-6 lg:col-start-1 lg:row-start-2">
          <MenuThemeField value={theme} onChange={setTheme} />
        </section>

        {/*
          L'aperçu suit le **brouillon**, pas la ligne enregistrée : choisir
          un thème sans le voir reviendrait à choisir un habillage de mémoire.

          Et il le montre **dans les deux températures**. Le mode sombre suit
          le téléphone, sans interrupteur : un gérant qui règle sa carte à midi
          choisit donc aussi, sans le savoir, ce que lira un client à 23h —
          l'heure où une carte de bar est le plus consultée. Aller vérifier à
          une table n'est pas un flux.

          From `lg` it stays on screen while the form scrolls: the swatches, the
          font rails and the logo all sit in the left column, and a preview
          scrolled out of view answered none of them. On the phone it sits
          between the theme and the fonts, the two panels it answers most.
        */}
        <section
          className={cn('panel rounded-2xl p-4 sm:p-6 lg:p-4', PREVIEW_CELL)}
        >
          <h2 className="text-sm font-semibold">Aperçu</h2>
          <p className="mt-1 text-xs text-ink-soft">
            Votre carte telle que vos clients la verront, le jour et le soir.
          </p>

          {/*
            Side by side on the phone, where a stacked pair would push the fonts
            a whole screen further down; stacked in the narrow `lg` column; side
            by side again once `xl` widens it.
          */}
          <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-1 xl:grid-cols-2">
            <ThemePreview
              theme={theme}
              fonts={fonts}
              mode="light"
              name={name || venue.name}
              logoUrl={logoUrl}
              logoPlate={logoPlate}
            />
            <ThemePreview
              theme={theme}
              fonts={fonts}
              mode="dark"
              name={name || venue.name}
              logoUrl={logoUrl}
              logoPlate={logoPlate}
            />
          </div>
        </section>

        <section className="panel rounded-2xl p-4 sm:p-6 lg:col-start-1 lg:row-start-3">
          <MenuFontField value={fonts} onChange={setFonts} />
        </section>

        {/*
          The save bar. One « Enregistrer » writes all five panels, so it belongs
          to none of them: filed under « Identité » it looked like that panel's
          button, and a manager picking a typeface had to scroll back up — or,
          on the desktop, across — to find it.

          `sticky`, not `fixed`: it rides the bottom of the viewport while the
          form scrolls and comes to rest at the form's end, so it never covers
          the last rail. The box stays in the flow while hidden for the same
          reason — the space it keeps is what the last panel scrolls clear of.

          Hidden while there is nothing to save. It rises 8px as it fades in
          (200ms) and leaves faster (150ms): state indication, seen once per
          editing session. `visibility` takes it out of the tab order and the
          accessibility tree, and flips only at the end of the exit, after the
          fade. Reduced motion is covered by `motion.css`.
        */}
        <div
          data-visible={isDirty || showSaved}
          className="sticky bottom-[max(1rem,env(safe-area-inset-bottom))] z-10 rounded-2xl border border-line bg-surface p-3 shadow-[var(--shadow-2)] transition-[opacity,translate,visibility] duration-200 ease-out data-[visible=false]:invisible data-[visible=false]:translate-y-2 data-[visible=false]:opacity-0 data-[visible=false]:duration-150 sm:px-4 lg:col-span-2 lg:row-start-4"
        >
          {update.isError ? (
            <ErrorNote className="mt-0 mb-3">{update.error.message}</ErrorNote>
          ) : null}

          <div className="flex items-center justify-end gap-2">
            {/*
              Always rendered, so the live region exists before its text
              changes — a `role="status"` inserted with its message is often
              not read. The dirty notice is left out on the phone: the buttons
              need the width, and a bar that just appeared says it already.
            */}
            <p role="status" className="min-w-0 flex-1 text-sm">
              {showSaved ? (
                <span className="inline-flex items-center gap-1.5 text-bottle-deep">
                  <Check className="size-4 shrink-0" aria-hidden />
                  Réglages enregistrés.
                </span>
              ) : isDirty ? (
                <span className="hidden text-ink-soft sm:inline">
                  Modifications non enregistrées
                </span>
              ) : null}
            </p>

            {isDirty ? (
              <CancelButton onClick={reset} disabled={update.isPending} />
            ) : null}
            {/* Kept while the confirmation shows, so the bar keeps its height. */}
            <SaveButton pending={update.isPending} disabled={!isDirty} />
          </div>
        </div>
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
  fonts,
  mode,
  name,
  logoUrl,
  logoPlate,
}: {
  theme: MenuTheme
  fonts: MenuFonts
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
        {/*
          The name wraps rather than truncating, as it does on the carte
          (`text-balance`, no ellipsis there). Side by side on the phone each
          board leaves the title about 100px, and « Chez Lambert » set in the
          wide house face ended in « … » — a preview that invents an ellipsis
          the customer never sees.
        */}
        <p
          data-menu-face={menuFace(fonts.title)}
          className="display-title mt-0.5 text-base leading-tight text-balance wrap-break-word"
        >
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
      {/*
        Every role appears once, with the carte's own classes — `.menu-text` on
        the reading lines included, so the size correction of `menu-fonts.css`
        is previewed too.
      */}
      <div data-menu-theme={theme} className="px-3 pt-3 pb-1">
        <p
          data-menu-face={menuFace(fonts.category)}
          className="display-title truncate text-sm leading-tight text-ink"
        >
          Bières pression
        </p>
        <p
          data-menu-face={menuFace(fonts.product)}
          className="menu-text mt-1.5 flex items-baseline justify-between gap-2 text-xs"
        >
          <span className="truncate font-semibold text-ink">Jupiler</span>
          <span className="shrink-0 font-semibold text-ink tabular-nums">
            2,50 €
          </span>
        </p>
        <p
          data-menu-face={menuFace(fonts.description)}
          className="menu-text mt-0.5 truncate text-[0.6875rem] text-ink-soft"
        >
          Blonde légère, servie bien fraîche.
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
 * Elle pose les quatre panneaux à leur place et à leur largeur, sur la même
 * grille que l'écran : c'est une page de formulaire, et voir la colonne de
 * droite arriver après coup déplacerait tout ce que le gérant est en train de
 * lire. The save bar has no bone: it is hidden until something changes.
 */
function VenueSettingsSkeleton() {
  return (
    <SkeletonScreen label="Chargement des réglages…" className="page-wrap px-0">
      <Skeleton className="h-4 w-40 rounded-full lg:hidden" />

      <SkeletonHeader>
        <SkeletonAddress delay={110} />
        <SkeletonLine className="mt-2 w-full max-w-prose" delay={140} />
      </SkeletonHeader>

      <div className={cn('mt-6', SETTINGS_GRID)}>
        <div className="panel rounded-2xl p-4 sm:p-6 lg:col-start-1 lg:row-start-1">
          <Skeleton className="h-4 w-20 rounded-full" delay={180} />
          <Skeleton className="mt-2 h-3 w-56 rounded-full" delay={200} />
          <Skeleton className="mt-4 h-11 w-full" delay={220} />
          <Skeleton className="mt-4 h-20 w-full" delay={260} />
          <Skeleton className="mt-4 h-16 w-48" delay={280} />
        </div>

        <div className="panel rounded-2xl p-4 sm:p-6 lg:col-start-1 lg:row-start-2">
          <Skeleton className="h-4 w-32 rounded-full" delay={300} />
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
            <Skeleton className="h-14 w-full" delay={320} />
            <Skeleton className="h-14 w-full" delay={340} />
            <Skeleton className="h-14 w-full" delay={360} />
          </div>
        </div>

        <div
          className={cn('panel rounded-2xl p-4 sm:p-6 lg:p-4', PREVIEW_CELL)}
        >
          <Skeleton className="h-4 w-16 rounded-full" delay={200} />
          <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-1 xl:grid-cols-2">
            <Skeleton className="h-44 w-full" delay={240} />
            <Skeleton className="h-44 w-full" delay={280} />
          </div>
        </div>

        <div className="panel rounded-2xl p-4 sm:p-6 lg:col-start-1 lg:row-start-3">
          <Skeleton className="h-4 w-40 rounded-full" delay={380} />
          <Skeleton className="mt-4 h-3 w-48 rounded-full" delay={400} />
          <Skeleton className="mt-2 h-11 w-full" delay={420} />
          <Skeleton className="mt-4 h-3 w-40 rounded-full" delay={440} />
          <Skeleton className="mt-2 h-11 w-full" delay={460} />
        </div>
      </div>
    </SkeletonScreen>
  )
}
