import { Plus } from 'lucide-react'

import { addToCart, useCart } from '#/features/orders/cart'
import { productLabel } from '#/components/product-size'

import type { Product } from '#/lib/supabase'

/**
 * Le « + » posé en bout de ligne sur chaque produit de la carte.
 *
 * Un seul geste, et volontairement un seul : ajouter. Retirer, changer une
 * quantité, tout cela se fait dans le panier, où l'on voit ce qu'on modifie.
 * Poser un « − » ici obligerait chaque ligne de la carte à porter un compteur,
 * c'est-à-dire à devenir un formulaire — et une carte se lit.
 *
 * Quand le produit est déjà au panier, le bouton l'annonce sans changer de
 * fonction : la pastille chiffrée remplace l'icône. C'est la seule chose que
 * cette ligne a besoin de savoir du panier — combien, pas quoi en faire.
 *
 * Aucune animation d'apparition : ces boutons sont dans le HTML rendu au
 * serveur, comme le reste de la carte. Le seul mouvement est l'enfoncement au
 * doigt, que porte déjà la classe de base.
 */
export function AddToCartButton({
  venueSlug,
  product,
}: {
  venueSlug: string
  product: Product
}) {
  const cart = useCart(venueSlug)
  const quantity =
    cart.find((line) => line.productId === product.id)?.quantity ?? 0

  return (
    <button
      type="button"
      onClick={() => addToCart(venueSlug, product.id)}
      /*
        Pas d'`IconButton` : celui-ci est fantôme et carré, alors qu'il s'agit
        ici de la seule action de la carte client, sur une page où tout le reste
        est du texte. Elle a besoin d'un contour pour exister, et d'un rond pour
        ne pas ressembler à un bouton de back-office.

        44px de côté, la cible tactile du projet — cette page ne se lit que sur
        un téléphone.
      */
      className="flex size-11 shrink-0 items-center justify-center rounded-full border border-line bg-surface-raised text-sm font-semibold tabular-nums text-ink transition-transform duration-150 ease-(--ease-out) active:scale-[0.94]"
      /*
        Le libellé dit ce que le bouton fait *et* où il en est. « Ajouter » seul
        laisserait un lecteur d'écran devant quinze boutons identiques, et
        n'annoncerait jamais que le panier a bougé.
      */
      aria-label={
        quantity > 0
          ? `Ajouter ${productLabel(product.name, product.size)} — ${quantity} au panier`
          : `Ajouter ${productLabel(product.name, product.size)}`
      }
    >
      {quantity > 0 ? quantity : <Plus className="size-5" aria-hidden="true" />}
    </button>
  )
}
