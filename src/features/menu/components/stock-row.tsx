import { ErrorNote } from '#/components/error-note'
import { StockBadge } from '#/features/menu/components/stock-badge'
import { StockStepper } from '#/features/menu/components/stock-stepper'
import {
  useAdjustProductStock,
  useSetProductStock,
} from '#/features/menu/mutations'

import type { Product } from '#/lib/supabase'

/** Ancre d'un produit sur la page Stock. Posée ici, visée par le bandeau d'alerte. */
export function stockRowId(productId: string): string {
  return `stock-${productId}`
}

/**
 * Une ligne de la page Stock : le produit, son état, son compteur.
 *
 * Les deux écritures vivent ici plutôt que dans le compteur pour que leur échec
 * ait un endroit où s'afficher : une `ErrorNote` sous un contrôle large de
 * quatre-vingts pixels serait illisible, et un décompte qui échoue en silence
 * est pire qu'un décompte lent.
 *
 * Elles ne passent pas par le même chemin, et la distinction est le fond du
 * sujet. « −1 » est **relatif** : il part dans `adjust_product_stock`, qui
 * décompte atomiquement côté Postgres. Exécuté depuis le navigateur — lire,
 * puis écrire — il perdrait un appui sur deux le jour où le téléphone du gérant
 * et la tablette du comptoir servent en même temps. La saisie, elle, est
 * **absolue** : elle remplace la valeur, deux saisies concurrentes ne peuvent
 * donc pas s'annuler et un simple `update` suffit.
 */
export function StockRow({ product }: { product: Product }) {
  const adjust = useAdjustProductStock()
  const setStock = useSetProductStock()

  const error = adjust.error ?? setStock.error

  return (
    <li
      id={stockRowId(product.id)}
      /* `scroll-mt` : arrivé par une pastille du bandeau, le produit doit se
         poser sous l'en-tête et non derrière lui. */
      className="scroll-mt-6 py-3"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium">{product.name}</p>
          <StockBadge product={product} className="mt-1" />
        </div>

        <StockStepper
          productName={product.name}
          quantity={product.stock_quantity ?? 0}
          onAdjust={(delta) => adjust.mutate({ productId: product.id, delta })}
          onSet={(quantity) =>
            setStock.mutate({ productId: product.id, quantity })
          }
        />
      </div>

      {error ? <ErrorNote>{error.message}</ErrorNote> : null}
    </li>
  )
}
