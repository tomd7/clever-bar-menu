import { useMemo, useState } from 'react'

import { CancelButton } from '#/components/buttons/cancel-button'
import { ErrorNote } from '#/components/error-note'
import { ProductSize } from '#/components/product-size'
import { TextField } from '#/components/form/text-field'
import { displayBarcode } from '#/features/menu/barcode'

import type { CategoryWithProducts } from '#/features/menu/api'

/**
 * À quel produit ce code appartient-il ?
 *
 * Ouvert au premier scan d'un code inconnu, et rouvert depuis le panneau de
 * mouvement quand l'appairage s'avère faux. C'est le seul endroit où un
 * code-barres se choisit un produit : la fiche produit n'en porte volontairement
 * pas de champ, qui se ferait écraser par le premier enregistrement venu d'un
 * autre écran pendant qu'on scanne.
 *
 * Un panneau pleine hauteur, et non une feuille glissée par le bas. La caméra
 * derrière une modale ne sert à rien pendant qu'on lit soixante lignes, et une
 * liste cherchable enfermée dans une boîte à défilement interne, clavier
 * ouvert, laisse deux produits visibles à la fois. Ici la liste a toute la
 * hauteur, et la recherche est ce qu'on touche en premier.
 */
export function ScanPairingPanel({
  barcode,
  categories,
  pairedProductId,
  onPair,
  onCreateInstead,
  onCancel,
  pending,
  error,
}: {
  barcode: string
  categories: Array<CategoryWithProducts>
  /** Le produit qui porte déjà ce code, quand on vient le corriger. */
  pairedProductId: string | null
  onPair: (productId: string) => void
  /**
   * Retour vers la création d'un produit. `undefined` quand elle n'a pas de
   * sens — corriger un appairage, où créer un second produit ferait le doublon
   * qu'on est en train de défaire.
   */
  onCreateInstead?: () => void
  onCancel: () => void
  pending: boolean
  error: string | null
}) {
  const [search, setSearch] = useState('')

  const matches = useMemo(() => {
    const needle = foldCase(search)
    if (!needle) return categories

    return categories
      .map((category) => ({
        ...category,
        products: category.products.filter((product) =>
          foldCase(product.name).includes(needle),
        ),
      }))
      .filter((category) => category.products.length > 0)
  }, [categories, search])

  return (
    <div className="flex h-full flex-col bg-surface">
      <header className="border-b border-line p-4 sm:p-5">
        <p className="island-kicker">
          {pairedProductId ? 'Corriger l’association' : 'Code-barres inconnu'}
        </p>
        <p className="mt-1 text-sm text-ink-soft">
          <span className="font-medium tabular-nums text-ink">
            {displayBarcode(barcode)}
          </span>{' '}
          {pairedProductId
            ? '— choisissez le bon produit.'
            : '— à quel produit de la carte correspond-il ?'}
        </p>

        <TextField
          label="Rechercher un produit"
          hiddenLabel
          className="mt-3"
          autoFocus
          type="search"
          placeholder="Rechercher un produit…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        {error ? <ErrorNote>{error}</ErrorNote> : null}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5">
        {matches.length === 0 ? (
          <p className="text-sm text-ink-soft">
            Aucun produit ne porte ce nom.
          </p>
        ) : (
          <div className="space-y-4">
            {matches.map((category) => (
              <section key={category.id}>
                <h2 className="island-kicker">{category.name}</h2>

                <ul className="mt-1 divide-y divide-line border-t border-line">
                  {category.products.map((product) => (
                    <li key={product.id}>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => onPair(product.id)}
                        className="flex min-h-11 w-full items-center justify-between gap-3 py-3 text-left transition-transform duration-150 ease-out active:scale-[0.99] disabled:opacity-60"
                      >
                        <span className="min-w-0">
                          <span className="font-medium">{product.name}</span>
                          <ProductSize size={product.size} />
                        </span>

                        {/*
                          Dire qu'un produit porte déjà un code évite le
                          remplacement fait sans le savoir — l'erreur qui coûte
                          le plus cher ici, puisqu'elle casse un appairage qui
                          marchait pour en créer un qui ne marchera pas.
                        */}
                        {product.barcode ? (
                          <span className="shrink-0 text-xs text-ink-soft">
                            {product.id === pairedProductId
                              ? 'ce code'
                              : 'déjà associé'}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>

      <footer className="border-t border-line p-4 sm:p-5">
        <CancelButton onClick={onCancel}>Revenir à la caméra</CancelButton>

        {/*
          L'autre issue : cette bouteille n'est pas encore sur la carte. Elle
          existe parce que ce panneau était auparavant un cul-de-sac — « le
          produit doit exister avant de recevoir un code-barres » envoyait le
          gérant vers l'éditeur de carte, sur un autre écran, une caisse dans
          les bras.
        */}
        {onCreateInstead ? (
          <button
            type="button"
            onClick={onCreateInstead}
            className="mt-3 block min-h-11 text-sm text-ink-soft underline underline-offset-4 hover:text-ink"
          >
            Il n’est pas encore sur ma carte
          </button>
        ) : null}
      </footer>
    </div>
  )
}

/** Compare des noms comme un gérant les cherche : sans casse ni accents. */
function foldCase(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
}
