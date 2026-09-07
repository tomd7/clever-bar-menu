import { Check, X } from 'lucide-react'
import { useState } from 'react'

import { ActionButton } from '#/components/buttons/action-button'
import { CancelButton } from '#/components/buttons/cancel-button'
import { ErrorNote } from '#/components/error-note'
import { TextField } from '#/components/form/text-field'
import { displayBarcode } from '#/features/menu/barcode'
import { SIZE_MAX_LENGTH, SIZE_SUGGESTIONS } from '#/features/menu/size'

import type { CatalogEntry } from '#/features/menu/catalog'
import type { CategoryWithProducts } from '#/features/menu/api'

/** Ce que le panneau demande de créer. Les valeurs sont brutes, en texte. */
export type CatalogDraft = {
  categoryId: string
  name: string
  size: string
  price: string
  /** Photo à recopier, ou `null` : celle du catalogue, si elle existe. */
  photoUrl: string | null
}

/**
 * Ajouter à la carte la bouteille qu'on vient de scanner.
 *
 * Ce panneau remplace un cul-de-sac. Avant lui, un code inconnu ne pouvait
 * qu'être associé à un produit déjà saisi : le gérant sortait du scan, ouvrait
 * l'éditeur de carte, tapait le nom, la contenance et le prix, revenait,
 * rescannait, appairait. Six écrans pour une bouteille, une caisse dans les
 * bras.
 *
 * Deux cas, un seul écran. Le catalogue connaît le code, et tout est
 * pré-rempli — il ne reste que la catégorie et le prix, les deux seules choses
 * qu'aucune base extérieure ne peut savoir. Ou il ne le connaît pas — vins et
 * spiritueux, pour l'essentiel — et c'est le même formulaire, vide. Ne rien
 * proposer dans le second cas aurait laissé la moitié des scans d'un bar sans
 * issue.
 *
 * **La fiche en tête est le garde-fou.** Un GTIN désigne une unité commerciale,
 * qui est parfois le pack de six et non la bouteille : la photo et la
 * contenance sont ce qui permet au gérant de s'en apercevoir avant d'appuyer.
 * Même rôle que le niveau résultant affiché avant validation dans le panneau de
 * mouvement — montrer, plutôt que demander de se souvenir.
 *
 * Aucun champ de stock ici, et c'est délibéré : le produit naît non suivi, et
 * le panneau de mouvement enchaîne aussitôt sur « activer le suivi », qui est
 * la bonne première question pour une bouteille qu'on vient de recevoir. Le
 * demander aux deux endroits est la façon dont un 24 devient un 48.
 */
export function ScanCatalogPanel({
  barcode,
  entry,
  unavailable,
  categories,
  onCreate,
  onPairInstead,
  onCancel,
  pending,
  error,
}: {
  barcode: string
  /** La fiche trouvée, ou `null` : le formulaire est alors vide. */
  entry: CatalogEntry | null
  /**
   * Le catalogue n'a pas répondu — panne réseau, serveur injoignable.
   *
   * À ne surtout pas confondre avec « il ne connaît pas ce code » : le
   * formulaire est le même, mais ce qu'on dit au gérant ne l'est pas. Présenter
   * un incident comme une bouteille inconnue lui fait ressaisir à la main ce
   * qu'une fiche lui aurait donné, sans que personne n'apprenne qu'il y a une
   * panne.
   */
  unavailable: boolean
  categories: Array<CategoryWithProducts>
  onCreate: (draft: CatalogDraft) => void
  onPairInstead: () => void
  onCancel: () => void
  pending: boolean
  error: string | null
}) {
  const [name, setName] = useState(entry?.name ?? '')
  const [size, setSize] = useState(entry?.quantity ?? '')
  const [price, setPrice] = useState('')
  /*
    Une seule catégorie : elle est le choix évident, et le demander serait une
    question dont la réponse est déjà connue. Au-delà, rien n'est présélectionné
    — ranger une bière dans les softs se répare sur la carte, mais après coup.
  */
  const [categoryId, setCategoryId] = useState(
    categories.length === 1 ? categories[0].id : '',
  )

  const valid = name.trim() !== '' && categoryId !== ''

  return (
    <div className="flex h-full flex-col bg-surface">
      <header className="border-b border-line p-4 sm:p-5">
        <p className="island-kicker">
          {entry
            ? 'Trouvé au catalogue'
            : unavailable
              ? 'Catalogue indisponible'
              : 'Code-barres inconnu'}
        </p>

        <div className="mt-2 flex items-center gap-3">
          {/*
            La photo du catalogue, affichée depuis son origine. Elle n'est
            recopiée dans le bucket de l'établissement qu'à la validation : tant
            que le gérant n'a rien créé, il n'y a rien à stocker.
          */}
          {entry?.photoUrl ? (
            <img
              src={entry.photoUrl}
              alt=""
              className="size-16 shrink-0 rounded-xl border border-line bg-surface-raised object-contain"
            />
          ) : null}

          <div className="min-w-0">
            <p className="font-medium tabular-nums text-ink">
              {displayBarcode(barcode)}
            </p>
            <p className="mt-0.5 text-sm text-ink-soft">
              {entry
                ? [entry.brand, entry.quantity].filter(Boolean).join(' · ') ||
                  'Aucun détail'
                : unavailable
                  ? 'Le catalogue n’a pas répondu. Vous pouvez créer la bouteille à la main — la fiche sera retrouvée au prochain scan.'
                  : 'Aucune fiche pour ce code — décrivez la bouteille.'}
            </p>
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5">
        {categories.length === 0 ? (
          <p className="text-sm text-ink-soft">
            Cette carte n’a encore aucune catégorie, et un produit ne peut pas
            exister sans elle. Créez-en une depuis l’éditeur de carte, puis
            rescannez.
          </p>
        ) : (
          <div className="space-y-4">
            <TextField
              label="Nom"
              /*
                Le focus va au nom et pas à la catégorie : sur une fiche
                trouvée, c'est le champ qu'on relit, et sur un code inconnu
                c'est le premier à remplir. Dans les deux cas, le clavier
                s'ouvre là où le doigt allait.
              */
              autoFocus
              maxLength={120}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />

            <div>
              <TextField
                label="Taille"
                maxLength={SIZE_MAX_LENGTH}
                placeholder="50cl"
                value={size}
                onChange={(event) => setSize(event.target.value)}
              />

              {/*
                Les mêmes puces que la fiche produit, et pour la même raison :
                Open Food Facts écrit « 330 ml » là où une carte de bar écrit
                « 33cl ». Rien ne convertit — `size.ts` pose que ce champ est du
                texte libre — donc la correction doit tenir en une frappe.
              */}
              <ul className="mt-2 flex flex-wrap gap-2">
                {SIZE_SUGGESTIONS.map((suggestion) => {
                  const selected = size === suggestion
                  return (
                    <li key={suggestion}>
                      <button
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setSize(selected ? '' : suggestion)}
                        className={`flex min-h-11 items-center justify-center rounded-full border px-4 text-sm font-medium transition-transform duration-150 ease-out active:scale-[0.97] ${
                          selected
                            ? 'border-ink bg-primary text-primary-foreground'
                            : 'border-line bg-surface-raised text-ink-soft hover:text-ink'
                        }`}
                      >
                        {suggestion}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>

            <fieldset>
              <legend className="text-sm font-medium">Catégorie</legend>

              {/*
                Des puces plutôt qu'un `<select>` : sur un téléphone, le select
                natif ouvre une roue qui masque l'écran et demande deux gestes,
                là où une carte de bar tient en cinq catégories visibles d'un
                coup. Même vocabulaire que les tailles et les quantités.
              */}
              <ul className="mt-2 flex flex-wrap gap-2">
                {categories.map((category) => {
                  const selected = category.id === categoryId
                  return (
                    <li key={category.id}>
                      <button
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setCategoryId(category.id)}
                        className={`flex min-h-11 items-center justify-center rounded-full border px-4 text-sm font-medium transition-transform duration-150 ease-out active:scale-[0.97] ${
                          selected
                            ? 'border-ink bg-primary text-primary-foreground'
                            : 'border-line bg-surface-raised text-ink-soft hover:text-ink'
                        }`}
                      >
                        {category.name}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </fieldset>

            <TextField
              label="Prix"
              inputMode="decimal"
              placeholder="3,50"
              hint="Facultatif — la carte n’affichera rien sans prix."
              value={price}
              onChange={(event) => setPrice(event.target.value)}
            />

            {error ? <ErrorNote>{error}</ErrorNote> : null}
          </div>
        )}
      </div>

      <footer className="border-t border-line p-4 sm:p-5">
        <div className="flex flex-wrap gap-2">
          <ActionButton
            icon={Check}
            disabled={!valid || pending}
            onClick={() =>
              onCreate({
                categoryId,
                name,
                size,
                price,
                photoUrl: entry?.photoUrl ?? null,
              })
            }
          >
            {pending ? 'Création…' : 'Ajouter à la carte'}
          </ActionButton>
          <CancelButton icon={X} onClick={onCancel} />
        </div>

        {/*
          L'issue de secours, au même endroit et avec le même poids que « Ce
          n'est pas ce produit ? » du panneau de mouvement : le code peut
          appartenir à une bouteille déjà sur la carte, et c'est même le cas
          dominant les premières semaines d'un établissement.
        */}
        <button
          type="button"
          onClick={onPairInstead}
          className="mt-3 min-h-11 text-sm text-ink-soft underline underline-offset-4 hover:text-ink"
        >
          Il est déjà sur ma carte
        </button>

        {/*
          L'attribution due à la source, à l'endroit honnête : celui où le
          gérant voit la donnée empruntée et décide de la prendre. La mention
          sur la carte publique, elle, tient à la photo une fois recopiée.
        */}
        {entry ? (
          <p className="mt-3 text-xs text-ink-soft">
            Fiche : Open Food Facts (ODbL) — photo sous licence CC-BY-SA.
          </p>
        ) : null}
      </footer>
    </div>
  )
}
