import { createFileRoute, notFound } from '@tanstack/react-router'
import { QrCode } from 'lucide-react'

import { AddToCartButton } from '#/features/orders/components/add-to-cart-button'
import { EmptyState } from '#/components/empty-state'
import { env } from '#/env'
import { OrderBar } from '#/features/orders/components/order-bar'
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
        L’adresse est peut-être incomplète, ou l’établissement n’utilise plus{' '}
        {env.VITE_APP_TITLE}.
      </EmptyState>
    </main>
  ),

  component: PublicMenuRoute,
})

/**
 * La carte, et la prise de commande par-dessus.
 *
 * C'est la route qui monte les deux, et elle seule : `features/menu` ne doit
 * rien savoir de `features/orders`, et réciproquement. La carte expose un
 * emplacement (`productAction`), la commande le remplit, et le fichier qui a le
 * droit de connaître les deux features est celui-ci. Même montage que
 * `_authenticated.tsx`, qui passe `<VenueNav>` à un `BackOfficeShell` incapable
 * d'aller le chercher lui-même.
 *
 * Rien n'apparaît tant que le gérant n'a pas ouvert la prise de commande.
 * `orders_enabled` est vérifié ici pour l'affichage et dans `place_order` pour
 * l'écriture : cacher un bouton n'a jamais fermé une API.
 */
function PublicMenuRoute() {
  const menu = Route.useLoaderData()
  const { venue, categories } = menu

  if (!venue.orders_enabled) return <PublicMenu menu={menu} />

  /*
    La carte à plat, pour que le panier retrouve un nom et un prix derrière un
    identifiant. Elle est aplatie ici plutôt que dans le panier : c'est la
    route qui tient la carte, et la commande n'a pas à connaître la notion de
    catégorie.
  */
  const products = categories.flatMap((category) => category.products)

  return (
    <>
      <PublicMenu
        menu={menu}
        productAction={(product) => (
          <AddToCartButton venueSlug={venue.slug} product={product} />
        )}
      />
      <OrderBar
        venueSlug={venue.slug}
        products={products}
        currency={venue.currency}
      />
    </>
  )
}
