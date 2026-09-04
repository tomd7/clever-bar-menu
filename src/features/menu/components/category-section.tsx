import { useState } from 'react'
import { AddButton } from '#/components/buttons/add-button'
import { CategoryHeader } from '#/features/menu/components/category-header'
import { ProductForm } from '#/features/menu/components/product-form'
import { ProductRow } from '#/features/menu/components/product-row'
import { nextPosition } from '#/features/menu/api'
import { useMoveItem } from '#/features/menu/mutations'

import type { CategoryWithProducts } from '#/features/menu/api'

/** Une catégorie de la carte et la liste de ses produits. */
export function CategorySection({
  category,
  currency,
  isFirst,
  isLast,
  onMove,
}: {
  category: CategoryWithProducts
  currency: string
  isFirst: boolean
  isLast: boolean
  onMove: (direction: -1 | 1) => void
}) {
  const [isAdding, setIsAdding] = useState(false)
  const moveProduct = useMoveItem()
  const productCount = category.products.length

  return (
    <section className="panel rounded-2xl p-4 sm:p-5">
      <CategoryHeader
        category={category}
        isFirst={isFirst}
        isLast={isLast}
        onMove={onMove}
      />

      {productCount > 0 ? (
        <ul className="mt-4 divide-y divide-line border-t border-line">
          {category.products.map((product, index) => (
            <ProductRow
              key={product.id}
              product={product}
              venueId={category.venue_id}
              currency={currency}
              isFirst={index === 0}
              isLast={index === productCount - 1}
              onMove={(direction) =>
                moveProduct.mutate({
                  table: 'products',
                  a: product,
                  b: category.products[index + direction],
                })
              }
            />
          ))}
        </ul>
      ) : null}

      {isAdding ? (
        <ProductForm
          venueId={category.venue_id}
          categoryId={category.id}
          position={nextPosition(category.products)}
          onCancel={() => setIsAdding(false)}
          onSaved={() => setIsAdding(false)}
        />
      ) : (
        <AddButton
          variant="ghost"
          onClick={() => setIsAdding(true)}
          className="mt-3"
        >
          Ajouter un produit
        </AddButton>
      )}
    </section>
  )
}
