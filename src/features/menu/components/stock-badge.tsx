import { cn } from '#/lib/utils.ts'
import { stockStateOf } from '#/features/menu/stock'

import type { Product } from '#/lib/supabase'

/**
 * Pastille d'état du stock, affichée à côté du nom d'un produit.
 *
 * Ne rend **rien** pour un produit non suivi : la grande majorité d'une carte
 * de bar est dans ce cas, et une pastille « non suivi » sur trente lignes
 * transformerait une information en bruit.
 *
 * L'état se lit dans les mots, pas dans la couleur. Le thème « ardoise » n'a
 * pas de teinte d'avertissement — l'ambre qui jouait ce rôle a été retiré
 * précisément parce qu'il ressemblait à un état d'alerte par défaut — et un
 * stock bas n'est pas une erreur : c'est une information qui doit se lire sans
 * crier. Seul l'épuisement prend la couleur destructive, parce qu'il a une
 * conséquence visible pour un client : le produit ne se commande plus.
 */
export function StockBadge({
  product,
  className,
}: {
  product: Pick<Product, 'stock_quantity' | 'low_stock_threshold'>
  className?: string
}) {
  const state = stockStateOf(product)
  if (state === 'untracked') return null

  const base =
    'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium tabular-nums'

  if (state === 'out') {
    return (
      <span
        className={cn(
          base,
          'border-destructive/30 bg-destructive/10 text-destructive',
          className,
        )}
      >
        Épuisé
      </span>
    )
  }

  return (
    <span
      className={cn(
        base,
        'border-line bg-surface-raised text-ink-soft',
        className,
      )}
    >
      {state === 'low'
        ? `Plus que ${product.stock_quantity}`
        : `${product.stock_quantity} en stock`}
    </span>
  )
}
