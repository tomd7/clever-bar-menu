import { useMutation, useQueryClient } from '@tanstack/react-query'

import {
  MENU_QUERY_KEY,
  createCategory,
  createProduct,
  deleteCategory,
  deleteProduct,
  renameCategory,
  setProductAvailability,
  swapPositions,
  updateProduct,
} from '#/features/menu/api'
import {
  PriceFormatError,
  parseOptionalEurosToCents,
} from '#/features/menu/price'

/**
 * Toute écriture sur la carte invalide la carte.
 *
 * C'est la seule raison pour laquelle un `onDone` remontait autrefois de
 * chaque bouton jusqu'à l'éditeur, en traversant trois composants qui n'en
 * faisaient rien d'autre que le transmettre. La règle tient ici, une fois.
 *
 * L'invalidation vise `['menu']` et non `['menu', venueSlug]` : la clé exacte
 * obligerait à faire redescendre le slug jusqu'à la ligne de produit, soit
 * exactement le fil qu'on vient de couper. Une seule carte est ouverte à la
 * fois, et seules les requêtes actives sont rechargées.
 */
function useMenuMutation<TVariables>(
  mutationFn: (variables: TVariables) => Promise<void>,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: MENU_QUERY_KEY }),
  })
}

export function useCreateCategory() {
  return useMenuMutation(createCategory)
}

export function useRenameCategory() {
  return useMenuMutation((input: { categoryId: string; name: string }) =>
    renameCategory(input.categoryId, input.name),
  )
}

export function useDeleteCategory() {
  return useMenuMutation(deleteCategory)
}

export function useDeleteProduct() {
  return useMenuMutation(deleteProduct)
}

export function useSetProductAvailability() {
  return useMenuMutation((input: { productId: string; isAvailable: boolean }) =>
    setProductAvailability(input.productId, input.isAvailable),
  )
}

export function useMoveItem() {
  return useMenuMutation(
    (input: {
      table: 'categories' | 'products'
      a: { id: string; position: number }
      b: { id: string; position: number }
    }) => swapPositions(input.table, input.a, input.b),
  )
}

/**
 * Enregistre un produit, qu'il existe déjà ou non.
 *
 * Le prix arrive tel que saisi, en texte : c'est ici qu'il devient des
 * centimes, et donc ici qu'un « 6,5O » avec un O majuscule échoue. Passer par
 * la mutation plutôt que par une validation séparée dans le formulaire fait
 * remonter les deux sortes d'échec — saisie illisible et refus du serveur —
 * par le même `error`, donc au même endroit à l'écran.
 */
export function useSaveProduct() {
  return useMenuMutation(
    async (input: {
      productId?: string
      categoryId: string
      position: number
      name: string
      description: string
      price: string
    }) => {
      let priceCents: number | null
      try {
        priceCents = parseOptionalEurosToCents(input.price)
      } catch (cause) {
        throw cause instanceof PriceFormatError
          ? cause
          : new Error('Prix invalide.')
      }

      const draft = {
        name: input.name.trim(),
        description: input.description.trim() || null,
        priceCents,
      }

      await (input.productId
        ? updateProduct(input.productId, draft)
        : createProduct({
            ...draft,
            categoryId: input.categoryId,
            position: input.position,
          }))
    },
  )
}
