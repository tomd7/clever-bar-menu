import {
  HeadContent,
  ScriptOnce,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'

import TanStackQueryDevtools from '../integrations/tanstack-query/devtools'

import { NotFound } from '#/components/not-found'
import { env } from '#/env'

import appCss from '../styles.css?url'

import type { QueryClient } from '@tanstack/react-query'

interface MyRouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: env.VITE_APP_TITLE,
      },
      {
        name: 'description',
        content:
          'La carte de votre bar, à jour, consultable au téléphone en scannant un QR code.',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),
  /*
    The application's 404.

    Declared on the root route rather than through the router's
    `defaultNotFoundComponent`: the shell lives here, and an address matching
    nothing belongs to no route in particular. The router's default
    `notFoundMode` (`fuzzy`) walks up to the nearest ancestor declaring one, so
    every intermediate route that doesn't lands here — `/admin/nawak` gets the
    same full page, without the back-office column, since there is nothing left
    to navigate beside.

    `/m/$venueSlug` keeps its own wording: a customer scanning a stale QR code
    has no use for a venue they never heard of.
  */
  notFoundComponent: () => <NotFound />,

  shellComponent: RootDocument,
})

/**
 * Aligne la classe `dark` de `<html>` sur le réglage du système.
 *
 * Exécuté en ligne, avant que React n'hydrate : sans cela la page s'afficherait
 * une fraction de seconde en thème clair avant de basculer, ce qui est
 * particulièrement violent quand la cible est un fond nuit — un client qui
 * scanne le QR code dans une salle tamisée prendrait un flash blanc en pleine
 * figure.
 *
 * Il n'y a volontairement ni interrupteur ni `localStorage` : la carte suit le
 * téléphone du client. Le jour où un choix manuel sera ajouté (item de roadmap
 * « thème clair/sombre »), il viendra se poser avant ce `matchMedia`, la
 * mécanique de classe restant la même.
 */
const themeScript = `(function () {
  try {
    var query = window.matchMedia('(prefers-color-scheme: dark)')
    var apply = function (dark) {
      document.documentElement.classList.toggle('dark', dark)
    }
    apply(query.matches)
    query.addEventListener('change', function (event) { apply(event.matches) })
  } catch (error) {}
})()`

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    /*
      Le script ci-dessous pose une classe sur `<html>` avant l'hydratation :
      le serveur a rendu l'élément sans elle, React doit donc être prévenu que
      cet écart est voulu, sans quoi il signale une divergence d'hydratation.
    */
    <html lang="fr" suppressHydrationWarning>
      <head>
        <ScriptOnce>{themeScript}</ScriptOnce>
        {/*
          Ces deux balises sont écrites ici plutôt que dans `head.meta` : le
          routeur dédoublonne les `meta` par `name`, et il n'en resterait qu'une
          — la barre d'adresse d'un téléphone en thème clair se retrouverait
          teintée en nuit. Distinguées par `media`, elles doivent coexister.
        */}
        <meta
          name="theme-color"
          content="#eeefec"
          media="(prefers-color-scheme: light)"
        />
        <meta
          name="theme-color"
          content="#1a1e1c"
          media="(prefers-color-scheme: dark)"
        />
        <HeadContent />
      </head>
      <body>
        {children}
        <TanStackDevtools
          config={{
            position: 'bottom-right',
          }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
            TanStackQueryDevtools,
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}
