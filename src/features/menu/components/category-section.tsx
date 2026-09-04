import { useState } from 'react'
import { Plus } from 'lucide-react'

import { ActionButton } from '#/components/action-button'
import { CategoryHeader } from '#/features/menu/components/category-header'
import { ProductForm } from '#/features/menu/components/product-form'
import { ProductRow } from '#/features/menu/components/product-row'
import { nextPosition, swapPositions } from '#/features/menu/api'

import type { CategoryWithProducts } from '#/features/menu/api'

/** Une catégorie de la carte et la liste de ses produits. */
export function CategorySection({
  category,
  currency,
  isFirst,
  isLast,
  onMove,
  onDone,
}: {
  category: CategoryWithProducts
  currency: string
  isFirst: boolean
  isLast: boolean
  onMove: (direction: -1 | 1) => Promise<void>
  onDone: () => Promise<void>
}) {
  const [isAdding, setIsAdding] = useState(false)
  const productCount = category.products.length

  return (
    <section className="panel rounded-2xl p-4 sm:p-5">
      <CategoryHeader
        category={category}
        isFirst={isFirst}
        isLast={isLast}
        onMove={onMove}
        onDone={onDone}
      />

      {productCount > 0 ? (
        <ul className="mt-4 divide-y divide-line border-t border-line">
          {category.products.map((product, index) => (
            <ProductRow
              key={product.id}
              product={product}
              currency={currency}
              isFirst={index === 0}
              isLast={index === productCount - 1}
              onMove={async (direction) => {
                await swapPositions(
                  'products',
                  product,
                  category.products[index + direction],
                )
                await onDone()
              }}
              onDone={onDone}
            />
          ))}
        </ul>
      ) : null}

      {isAdding ? (
        <ProductForm
          categoryId={category.id}
          position={nextPosition(category.products)}
          onCancel={() => setIsAdding(false)}
          onDone={async () => {
            setIsAdding(false)
            await onDone()
          }}
        />
      ) : (
        <ActionButton
          icon={Plus}
          variant="ghost"
          onClick={() => setIsAdding(true)}
          className="mt-3"
        >
          Ajouter un produit
        </ActionButton>
      )}
    </section>
  )
}
