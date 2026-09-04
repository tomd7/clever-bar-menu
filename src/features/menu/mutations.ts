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
import { removeProductPhoto, uploadProductPhoto } from '#/features/menu/photo'

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
 *
 * La photo suit le même chemin, et l'ordre des opérations n'est pas neutre :
 * l'envoi précède l'écriture en base, parce que la ligne doit connaître le
 * chemin du fichier. Si l'écriture échoue ensuite, le fichier fraîchement
 * envoyé est retiré — sans quoi chaque tentative ratée laisserait un orphelin
 * dans le bucket.
 */
export function useSaveProduct() {
  return useMenuMutation(
    async (input: {
      productId?: string
      venueId: string
      categoryId: string
      position: number
      name: string
      description: string
      price: string
      /** Photo choisie à l'instant, si le gérant vient d'en sélectionner une. */
      photoFile: File | null
      /** Chemin conservé : celui du produit, ou `null` si la photo est retirée. */
      imagePath: string | null
      /** Chemin avant modification, pour savoir quel fichier devient inutile. */
      previousImagePath: string | null
    }) => {
      let priceCents: number | null
      try {
        priceCents = parseOptionalEurosToCents(input.price)
      } catch (cause) {
        throw cause instanceof PriceFormatError
          ? cause
          : new Error('Prix invalide.')
      }

      const uploadedPath = input.photoFile
        ? await uploadProductPhoto(input.venueId, input.photoFile)
        : null

      const draft = {
        name: input.name.trim(),
        description: input.description.trim() || null,
        priceCents,
        imagePath: uploadedPath ?? input.imagePath,
      }

      try {
        await (input.productId
          ? updateProduct(input.productId, draft)
          : createProduct({
              ...draft,
              categoryId: input.categoryId,
              position: input.position,
            }))
      } catch (cause) {
        if (uploadedPath) await removeProductPhoto(uploadedPath)
        throw cause
      }

      /*
        L'ancienne photo n'est plus référencée : remplacée, ou retirée. Elle
        part après l'écriture, jamais avant — un échec en base doit laisser le
        produit exactement dans l'état où il était, image comprise.
      */
      if (
        input.previousImagePath &&
        input.previousImagePath !== draft.imagePath
      ) {
        await removeProductPhoto(input.previousImagePath)
      }
    },
  )
}
