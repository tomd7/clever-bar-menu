import { useRef, useState } from 'react'

import { CancelButton } from '#/components/buttons/cancel-button'
import { SaveButton } from '#/components/buttons/save-button'
import { ErrorNote } from '#/components/error-note'
import { TextAreaField } from '#/components/form/textarea-field'
import { PhotoField } from '#/features/menu/components/photo-field'
import { TextField } from '#/components/form/text-field'
import { SIZE_MAX_LENGTH, SIZE_SUGGESTIONS } from '#/features/menu/size'
import { centsToInput } from '#/features/menu/price'
import { stockToInput } from '#/features/menu/stock'
import { useSaveProduct } from '#/features/menu/mutations'

import type { FormEvent } from 'react'
import type { Product } from '#/lib/supabase'

/**
 * Formulaire de création et d'édition d'un produit.
 *
 * Le même composant sert aux deux : les champs, la validation du prix et les
 * messages d'erreur y sont identiques, et les dupliquer garantirait qu'ils
 * divergent. La présence de `product` distingue les deux modes.
 */
export function ProductForm({
  product,
  venueId,
  categoryId,
  position,
  onCancel,
  onSaved,
}: {
  product?: Product
  venueId: string
  categoryId: string
  position: number
  onCancel: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(product?.name ?? '')
  const [description, setDescription] = useState(product?.description ?? '')
  const [size, setSize] = useState(product?.size ?? '')
  const [price, setPrice] = useState(
    product ? centsToInput(product.price_cents) : '',
  )
  /*
    Deux états distincts pour une seule photo : `photoFile` est le fichier
    choisi mais pas encore envoyé, `imagePath` celui déjà en base. Les garder
    séparés permet de distinguer « remplacée » de « retirée », et de ne rien
    envoyer tant que le formulaire n'est pas validé — un gérant qui annule ne
    doit laisser aucun fichier derrière lui.
  */
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [imagePath, setImagePath] = useState<string | null>(
    product?.image_path ?? null,
  )
  const [stock, setStock] = useState(
    product ? stockToInput(product.stock_quantity) : '',
  )
  const [lowStockThreshold, setLowStockThreshold] = useState(
    product ? stockToInput(product.low_stock_threshold) : '',
  )

  /*
    Les valeurs de stock à l'ouverture, figées.
    `useRef` et non les props : celles-ci changent si le comptoir décompte
    pendant que la fiche est ouverte, et une comparaison avec la valeur courante
    ferait alors passer un champ auquel personne n'a touché pour une saisie.
  */
  const stockAtOpen = useRef({ stock, lowStockThreshold })

  const save = useSaveProduct()

  /*
    Zéro n'est pas une quantité basse, c'est une disparition : le produit quitte
    la carte publique tant qu'il n'est pas réapprovisionné. L'écrire au moment
    de la saisie évite au gérant de le découvrir en rechargeant sa carte.
  */
  const willBeHidden = /^0+$/.test(stock.replace(/\s/g, ''))

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    save.mutate(
      {
        productId: product?.id,
        venueId,
        categoryId,
        position,
        name,
        description,
        size,
        price,
        stock,
        lowStockThreshold,
        initialStock: stockAtOpen.current.stock,
        initialLowStockThreshold: stockAtOpen.current.lowStockThreshold,
        photoFile,
        imagePath,
        photoCredit: product?.photo_credit ?? null,
        previousImagePath: product?.image_path ?? null,
      },
      { onSuccess: onSaved },
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-3 rounded-xl border border-line bg-surface-raised p-3 sm:p-4"
    >
      {/*
        Le nom prend toute la largeur, la taille et le prix se partagent la
        ligne suivante dès `sm`, et les trois s'alignent à partir de `lg` : le
        back-office doit exploiter la largeur, pas empiler. Taille et prix sont
        voisins parce qu'ils se lisent ensemble — « 50cl à 5,50 € » est une
        seule décision.
      */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr]">
        <TextField
          label="Nom"
          className="sm:col-span-2 lg:col-span-1"
          autoFocus
          required
          maxLength={120}
          placeholder="Pinte de blonde"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />

        <div>
          <TextField
            label={
              <>
                Taille{' '}
                <span className="font-normal text-ink-soft">(facultatif)</span>
              </>
            }
            maxLength={SIZE_MAX_LENGTH}
            placeholder="50cl"
            value={size}
            onChange={(event) => setSize(event.target.value)}
          />

          {/*
            Des suggestions, pas une liste fermée : le champ accepte n'importe
            quoi — « pichet », « demi », « 4cl » — et ces pastilles ne font
            qu'épargner six caractères au clavier pour les formats que tous les
            bars partagent. Une pastille active se retire d'un second appui :
            c'est le seul moyen de vider le champ sans revenir au clavier, et
            personne ne cherche une croix qu'il n'a pas vue apparaître.

            Le rail est celui de la carte client et de la page Stock
            (`menu-nav.css`) : sept pastilles débordent la largeur d'un
            téléphone, et le dégradé dit qu'il y a une suite là où une barre de
            défilement ne ferait que salir la bande.
          */}
          <ul
            aria-label="Formats courants"
            className="scrollbar-none rail-fade mt-2 flex gap-2 overflow-x-auto"
          >
            {SIZE_SUGGESTIONS.map((suggestion) => {
              const isActive = size.trim() === suggestion

              return (
                <li key={suggestion}>
                  <button
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => setSize(isActive ? '' : suggestion)}
                    /*
                      44px de haut sur mobile, resserré à partir de `lg` comme
                      tous les contrôles du back-office (`SURFACE_HEIGHT`) : ce
                      formulaire se remplit aussi bien au pouce derrière le bar
                      qu'à la souris. L'enfoncement au clic reprend celui des
                      pastilles de la carte — la transition `transform` est
                      globale (`motion.css`), le repos se fait en `--ease-out`.
                    */
                    className={
                      isActive
                        ? 'flex min-h-11 items-center rounded-full border border-bottle bg-bottle px-3 text-sm font-semibold whitespace-nowrap text-on-bottle active:scale-[0.97] lg:min-h-8'
                        : 'flex min-h-11 items-center rounded-full border border-line bg-surface px-3 text-sm font-medium whitespace-nowrap text-ink-soft hover:text-ink active:scale-[0.97] lg:min-h-8'
                    }
                  >
                    {suggestion}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>

        <TextField
          label={
            <>
              Prix{' '}
              <span className="font-normal text-ink-soft">(facultatif)</span>
            </>
          }
          /*
            `inputMode="decimal"` fait apparaître le pavé numérique sur mobile,
            là où `type="number"` imposerait le point décimal et des flèches
            inutiles pour un prix.
          */
          inputMode="decimal"
          placeholder="6,50"
          value={price}
          onChange={(event) => setPrice(event.target.value)}
          inputClassName="tabular-nums"
          hint="Laissez vide pour un plat du jour ou un prix selon arrivage."
        />
      </div>

      <TextAreaField
        label="Description"
        className="mt-3"
        rows={2}
        maxLength={500}
        placeholder="Facultatif — origine, degré, allergènes…"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
      />

      <PhotoField
        className="mt-3"
        imagePath={imagePath}
        file={photoFile}
        onSelect={setPhotoFile}
        onRemove={() => {
          setPhotoFile(null)
          setImagePath(null)
        }}
      />

      {/*
        Le stock est séparé du reste par un filet : les champs au-dessus
        décrivent ce qu'un client lit, ceux-ci ce que le bar compte. Les mêler
        dans la même grille ferait du seuil d'alerte un attribut de la carte.
      */}
      <div className="mt-4 border-t border-line pt-3">
        <p className="island-kicker">Suivi de stock</p>

        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <TextField
            label={
              <>
                Stock restant{' '}
                <span className="font-normal text-ink-soft">(facultatif)</span>
              </>
            }
            /* `inputMode="numeric"` : le pavé numérique, sans les flèches ni le
               défilement à la molette d'un `type="number"`. */
            inputMode="numeric"
            placeholder="24"
            value={stock}
            onChange={(event) => setStock(event.target.value)}
            inputClassName="tabular-nums"
            hint={
              willBeHidden
                ? 'Épuisé : le produit est masqué de la carte jusqu’au réapprovisionnement.'
                : 'Laissez vide pour ne pas suivre ce produit — un café, une pression au fût.'
            }
          />

          <TextField
            label={
              <>
                Seuil d’alerte{' '}
                <span className="font-normal text-ink-soft">(facultatif)</span>
              </>
            }
            inputMode="numeric"
            placeholder="5"
            value={lowStockThreshold}
            onChange={(event) => setLowStockThreshold(event.target.value)}
            inputClassName="tabular-nums"
            hint="Sans seuil, le produit n’apparaît sur la page Stock qu’une fois épuisé ; en dessous, il y est signalé."
          />
        </div>
      </div>

      {save.error ? <ErrorNote>{save.error.message}</ErrorNote> : null}

      <div className="mt-3 flex gap-2">
        <SaveButton pending={save.isPending} disabled={!name.trim()} />
        <CancelButton onClick={onCancel} />
      </div>
    </form>
  )
}
