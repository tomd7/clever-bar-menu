import { createFileRoute, notFound } from '@tanstack/react-router'
import { QrCode } from 'lucide-react'

import { EmptyState } from '#/components/empty-state'
import { PublicMenu } from '#/features/menu/components/public-menu'
import { VenueNotFoundError } from '#/features/menu/api'
import { publicMenuQueryOptions } from '#/features/menu/public-api'

/**
 * La carte publique d'un établissement — la page que vise le QR code.
 *
 * Rendue au serveur, contrairement au back-office : elle s'ouvre sur le réseau
 * mobile d'un client attablé, sans compte ni session à consulter. Le HTML part
 * complet, la carte est lisible avant même que le JavaScript n'ait été évalué.
 */
export const Route = createFileRoute('/m/$venueSlug')({
  loader: async ({ context, params }) => {
    try {
      /*
        `ensureQueryData` et non un simple `fetch` : la requête est déshydratée
        vers le client, qui la reprend telle quelle au lieu de la refaire à
        l'hydratation.
      */
      return await context.queryClient.ensureQueryData(
        publicMenuQueryOptions(params.venueSlug),
      )
    } catch (error) {
      /*
        Une adresse inconnue doit répondre 404, et pas 200 avec un message :
        ces URL sont imprimées sur des QR codes et partagées, un code correct
        vaut mieux qu'une page d'erreur déguisée en page valide.
      */
      if (error instanceof VenueNotFoundError) throw notFound()
      throw error
    }
  },

  head: ({ loaderData }) =>
    loaderData
      ? {
          meta: [
            { title: `${loaderData.venue.name} — Carte` },
            ...(loaderData.venue.description
              ? [{ name: 'description', content: loaderData.venue.description }]
              : []),
          ],
        }
      : {},

  notFoundComponent: () => (
    <main className="page-wrap py-20">
      <EmptyState icon={QrCode} title="Cette carte n’existe pas">
        L’adresse est peut-être incomplète, ou l’établissement n’utilise plus
        Clever Bar Menu.
      </EmptyState>
    </main>
  ),

  component: PublicMenuRoute,
})

function PublicMenuRoute() {
  return <PublicMenu menu={Route.useLoaderData()} />
}
