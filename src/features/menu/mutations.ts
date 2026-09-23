import { useMutation, useQueryClient } from '@tanstack/react-query'

import { MENU_QUERY_KEY } from '#/lib/query-keys'
import {
  adjustProductStock,
  createCategory,
  createProduct,
  deleteCategory,
  deleteProduct,
  renameCategory,
  setProductAvailability,
  setProductBarcode,
  setProductStock,
  setProductVisibility,
  swapPositions,
  updateProduct,
} from '#/features/menu/api'
import {
  PriceFormatError,
  parseOptionalEurosToCents,
} from '#/features/menu/price'
import { StockFormatError, parseOptionalStock } from '#/features/menu/stock'
import { parseOptionalSize } from '#/features/menu/size'
import { removeProductPhoto, uploadProductPhoto } from '#/features/menu/photo'

import type { Menu } from '#/features/menu/api'
import type { Product } from '#/lib/supabase'

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
      /** Format saisi, en texte. Vide = la carte n'affiche pas de format. */
      size: string
      price: string
      /** Niveau de stock saisi, en texte. Vide = produit non suivi. */
      stock: string
      /** Seuil d'alerte saisi, en texte. Vide = alerte à l'épuisement seulement. */
      lowStockThreshold: string
      /** Les deux mêmes champs tels qu'ils étaient à l'ouverture du formulaire. */
      initialStock: string
      initialLowStockThreshold: string
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

      /*
        Les colonnes de stock ne sont réécrites que si leur champ a bougé.
        C'est la seule partie d'un produit qu'un autre écran modifie pendant
        que ce formulaire est ouvert : enregistrer une description ne doit pas
        remonter le niveau à ce qu'il était quand la fiche s'est affichée.
        `undefined` laisse la colonne intacte (voir `ProductDraft`).
      */
      let stockQuantity: number | null | undefined
      let lowStockThreshold: number | null | undefined
      try {
        stockQuantity =
          input.stock === input.initialStock
            ? undefined
            : parseOptionalStock(input.stock)
        lowStockThreshold =
          input.lowStockThreshold === input.initialLowStockThreshold
            ? undefined
            : parseOptionalStock(input.lowStockThreshold)
      } catch (cause) {
        throw cause instanceof StockFormatError
          ? cause
          : new Error('Quantité invalide.')
      }

      const uploadedPath = input.photoFile
        ? await uploadProductPhoto(input.venueId, input.photoFile)
        : null

      const draft = {
        name: input.name.trim(),
        description: input.description.trim() || null,
        size: parseOptionalSize(input.size),
        priceCents,
        imagePath: uploadedPath ?? input.imagePath,
        stockQuantity,
        lowStockThreshold,
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

/**
 * Mutation qui retouche un seul produit, et le montre avant la réponse.
 *
 * Les gestes de stock se répètent — un « −1 » par bouteille servie, debout
 * derrière le bar, sur une connexion mobile. Attendre l'aller-retour Supabase
 * avant de bouger le chiffre transforme un compteur en formulaire : on appuie
 * deux fois parce que rien n'a bougé. Le cache est donc corrigé sur-le-champ,
 * remis en état si l'écriture échoue, et rechargé dans tous les cas.
 *
 * La retouche vise le préfixe `['menu']` comme l'invalidation, et pour la même
 * raison : le composant qui appuie ne connaît pas le slug, et le lui faire
 * redescendre reconstituerait le fil que le projet a coupé.
 */
function useOptimisticProductMutation<
  TVariables extends { productId: string },
  TData,
>(
  /*
    Générique sur ce que l'écriture renvoie, et non figé à `void` :
    `adjustProductStock` rend le niveau obtenu, dont l'écran de scan a besoin
    pour savoir ce que le plancher à zéro a absorbé de sa demande. Le laisser
    tomber ici obligerait l'appelant à le relire, donc à réintroduire le
    lire-puis-écrire que la fonction SQL existe pour supprimer.
  */
  mutationFn: (variables: TVariables) => Promise<TData>,
  patch: (product: Product, variables: TVariables) => Product,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn,

    onMutate: async (variables) => {
      /*
        Un chargement déjà en vol répondrait avec l'ancien niveau et écraserait
        la correction : il est annulé avant, pas après.
      */
      await queryClient.cancelQueries({ queryKey: MENU_QUERY_KEY })

      const snapshot = queryClient.getQueriesData<Menu>({
        queryKey: MENU_QUERY_KEY,
      })

      queryClient.setQueriesData<Menu>({ queryKey: MENU_QUERY_KEY }, (menu) =>
        menu
          ? {
              ...menu,
              categories: menu.categories.map((category) => ({
                ...category,
                products: category.products.map((product) =>
                  product.id === variables.productId
                    ? patch(product, variables)
                    : product,
                ),
              })),
            }
          : menu,
      )

      return { snapshot }
    },

    onError: (_error, _variables, context) => {
      for (const [queryKey, data] of context?.snapshot ?? []) {
        queryClient.setQueryData(queryKey, data)
      }
    },

    /*
      `onSettled` et non `onSuccess` : après un échec, le cache vient d'être
      remis à sa valeur d'avant, laquelle peut elle-même être périmée si un
      autre appareil a servi entre-temps. C'est le serveur qui tranche.
    */
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: MENU_QUERY_KEY }),
  })
}

/** Décompte ou recrédite le stock d'un produit. `delta` peut être négatif. */
export function useAdjustProductStock() {
  return useOptimisticProductMutation(
    (input: { productId: string; delta: number }) =>
      adjustProductStock(input.productId, input.delta),
    (product, input) =>
      product.stock_quantity === null
        ? product
        : {
            ...product,
            /*
              Le même plancher que la fonction SQL. Sans lui, l'affichage
              passerait par « −1 » le temps d'un aller-retour avant de revenir
              à zéro — un chiffre que la base n'a jamais pu contenir.
            */
            stock_quantity: Math.max(product.stock_quantity + input.delta, 0),
          },
  )
}

/** Fixe le niveau de stock. `null` coupe le suivi du produit. */
export function useSetProductStock() {
  return useOptimisticProductMutation(
    (input: { productId: string; quantity: number | null }) =>
      setProductStock(input.productId, input.quantity),
    (product, input) => ({ ...product, stock_quantity: input.quantity }),
  )
}

/**
 * Puts a product back on sale, or marks it out of stock by hand.
 *
 * Optimistic like the stock gestures, and it was not before. A toggle that
 * waits for the round trip — and for the refetch behind it — before moving
 * reads as a tap that didn't take, and gets tapped again, which on a toggle
 * undoes the first one.
 */
export function useSetProductAvailability() {
  return useOptimisticProductMutation(
    (input: { productId: string; isAvailable: boolean }) =>
      setProductAvailability(input.productId, input.isAvailable),
    (product, input) => ({ ...product, is_available: input.isAvailable }),
  )
}

/**
 * Takes a product off the customer's menu, or puts it back. Optimistic for the
 * reason `useSetProductAvailability` gives: the two toggles sit side by side on
 * the same row, and must answer the finger the same way.
 */
export function useSetProductVisibility() {
  return useOptimisticProductMutation(
    (input: { productId: string; isVisible: boolean }) =>
      setProductVisibility(input.productId, input.isVisible),
    (product, input) => ({ ...product, is_visible: input.isVisible }),
  )
}

/**
 * Associe un code-barres à un produit, ou le retire avec `null`.
 *
 * Optimiste comme les écritures de stock, et pour la même raison : l'appairage
 * se fait une bouteille à la main, devant la caméra, et l'écran enchaîne
 * aussitôt sur le mouvement de stock. Attendre l'aller-retour ferait patienter
 * devant un panneau qui a déjà tout ce qu'il faut pour continuer.
 *
 * Le code doit avoir traversé `normalizeBarcode` : le patch écrit dans le cache
 * ce que la base recevra, et deux formes du même code y feraient deux produits
 * différents jusqu'à la prochaine invalidation.
 */
export function useSetProductBarcode() {
  return useOptimisticProductMutation(
    (input: { productId: string; barcode: string | null }) =>
      setProductBarcode(input.productId, input.barcode),
    (product, input) => ({ ...product, barcode: input.barcode }),
  )
}
