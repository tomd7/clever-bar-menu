import { Check, Minus, Plus, X } from 'lucide-react'
import { useState } from 'react'

import { ActionButton } from '#/components/buttons/action-button'
import { CancelButton } from '#/components/buttons/cancel-button'
import { ErrorNote } from '#/components/error-note'
import { ProductSize } from '#/components/product-size'
import { StockBadge } from '#/features/menu/components/stock-badge'
import { TextField } from '#/components/form/text-field'
import { displayBarcode } from '#/features/menu/barcode'

import type { Product } from '#/lib/supabase'

/** Sens du mouvement : on range, ou on sort. */
export type MovementDirection = 'in' | 'out'

/**
 * Ce qu'un mouvement demande d'écrire.
 *
 * Deux formes, parce que ce sont deux écritures différentes : le mouvement
 * ordinaire est **relatif** et passe par `adjust_product_stock`, tandis que
 * l'activation d'un suivi est **absolue** et remplace la valeur. Les distinguer
 * ici évite à l'appelant de les deviner à partir d'un produit.
 */
export type ScanMovement =
  { kind: 'adjust'; delta: number } | { kind: 'start'; quantity: number }

/** Les conditionnements d'un bar : la bouteille, le pack, le casier. */
const QUANTITY_CHIPS = [1, 6, 12, 24]

/**
 * Le mouvement de stock d'un produit qu'on vient de scanner.
 *
 * Tout se décide ici, et c'est délibéré : le sens et la quantité sont les deux
 * seules choses que la caméra ne peut pas savoir, et les séparer en deux gestes
 * — un mode choisi une fois en tête d'écran, puis des scans à l'unité — coûtait
 * plus cher qu'il n'y paraît. Un casier de vingt-quatre demandait vingt-quatre
 * passages devant l'objectif, plus lent que taper le chiffre ; et un mode
 * persistant se trompe en silence, vingt-quatre bouteilles rangées en sortie
 * faisant un écart de quarante-huit unités que rien n'annonce.
 *
 * D'où la forme : le sens est rechoisi à chaque mouvement, **à côté du nom du
 * produit et de son niveau**, et le niveau qui en résultera s'affiche avant la
 * validation. « 12 − 24 » se voit comme une erreur ; « Sortie » tout seul, en
 * haut d'un écran, ne se voit plus au bout de trois bouteilles.
 *
 * Le sens revient toutefois pré-choisi d'un scan à l'autre — `direction` est
 * tenu par l'écran, pas ici. Ranger une livraison, c'est vingt entrées de
 * suite : redemander vingt fois serait une cérémonie, alors que le montrer
 * vingt fois est une relecture.
 */
export function ScanMovementPanel({
  product,
  direction,
  onDirectionChange,
  onSubmit,
  onCancel,
  onRepair,
  pending,
  error,
}: {
  product: Product
  direction: MovementDirection
  onDirectionChange: (direction: MovementDirection) => void
  onSubmit: (movement: ScanMovement) => void
  onCancel: () => void
  /** « Ce n'est pas ce produit ? » — rouvre l'appairage sur le même code. */
  onRepair: () => void
  pending: boolean
  error: string | null
}) {
  const [quantity, setQuantity] = useState('1')

  const tracked = product.stock_quantity !== null
  const parsed = Number(quantity)
  const valid = /^\d+$/.test(quantity) && parsed > 0

  const current = product.stock_quantity ?? 0
  const delta = direction === 'in' ? parsed : -parsed
  const resulting = tracked ? Math.max(current + delta, 0) : parsed

  /*
    Le plancher à zéro de la fonction SQL n'est pas une erreur à empêcher : un
    comptoir a le droit d'avoir un compte faux, et c'est justement l'écran qui
    le répare. Il se dit, il ne se bloque pas.
  */
  const clipped = tracked && direction === 'out' && parsed > current

  return (
    <div className="flex h-full flex-col overflow-y-auto overscroll-contain bg-surface p-4 sm:p-5">
      <header>
        <p className="text-base font-medium">
          {product.name}
          <ProductSize size={product.size} />
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <StockBadge product={product} />
          {product.barcode ? (
            <span className="text-xs tabular-nums text-ink-soft">
              {displayBarcode(product.barcode)}
            </span>
          ) : null}
        </div>
      </header>

      {tracked ? (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <DirectionButton
              icon={Plus}
              selected={direction === 'in'}
              onClick={() => onDirectionChange('in')}
            >
              Entrée
            </DirectionButton>
            <DirectionButton
              icon={Minus}
              selected={direction === 'out'}
              onClick={() => onDirectionChange('out')}
            >
              Sortie
            </DirectionButton>
          </div>

          <QuantityField value={quantity} onChange={setQuantity} />

          {/*
            La relecture, et la seule protection contre le sens inversé : elle
            dit le résultat en toutes lettres, avant que le geste soit fait.
          */}
          <p className="mt-3 text-sm text-ink-soft" aria-live="polite">
            {valid ? (
              <>
                {direction === 'in' ? 'Entrée' : 'Sortie'} de{' '}
                <span className="font-medium tabular-nums text-ink">
                  {parsed}
                </span>{' '}
                — il en restera{' '}
                <span className="font-medium tabular-nums text-ink">
                  {resulting}
                </span>
                {clipped ? ` (il n’y en a que ${current} en stock)` : null}
              </>
            ) : (
              'Indiquez une quantité.'
            )}
          </p>
        </>
      ) : (
        <>
          {/*
            Un produit sans suivi ne peut pas recevoir un mouvement : la
            fonction SQL refuse, et à raison — lui inventer un niveau
            activerait un suivi que personne n'a demandé. On propose donc
            l'écriture absolue, et surtout pas « démarrer à N puis retirer » :
            un produit démarré puis ramené à zéro quitterait la carte des
            clients dans la seconde.
          */}
          <p className="mt-4 text-sm text-ink-soft">
            Ce produit n’a pas de suivi de stock. Indiquez ce qu’il en reste
            pour l’activer — il apparaîtra alors sur la page Stock.
          </p>

          <QuantityField
            label="Stock restant"
            value={quantity}
            onChange={setQuantity}
          />
        </>
      )}

      {error ? <ErrorNote>{error}</ErrorNote> : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <ActionButton
          icon={Check}
          disabled={!valid || pending}
          onClick={() =>
            onSubmit(
              tracked
                ? { kind: 'adjust', delta }
                : { kind: 'start', quantity: parsed },
            )
          }
        >
          {pending ? 'Enregistrement…' : tracked ? 'Valider' : 'Activer'}
        </ActionButton>
        <CancelButton icon={X} onClick={onCancel} />
      </div>

      {/*
        La réparation d'un appairage erroné vit ici, à l'instant précis où on
        s'en aperçoit : la bouteille est dans la main, et le nom affiché n'est
        pas le bon. C'est ce qui remplace un champ code-barres sur la fiche
        produit — lequel se ferait écraser par la première fiche enregistrée
        depuis un autre écran.
      */}
      <button
        type="button"
        onClick={onRepair}
        className="mt-4 self-start text-sm text-ink-soft underline underline-offset-4 hover:text-ink"
      >
        Ce n’est pas ce produit ?
      </button>
    </div>
  )
}

function QuantityField({
  label = 'Quantité',
  value,
  onChange,
}: {
  label?: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="mt-4">
      <TextField
        label={label}
        inputMode="numeric"
        autoFocus
        value={value}
        /* Filtré à la saisie : le champ ne peut produire aucune valeur que la
           base refuserait, donc aucun message d'erreur à écrire. */
        onChange={(event) => onChange(event.target.value.replace(/\D/g, ''))}
        onFocus={(event) => event.target.select()}
        inputClassName="text-base font-semibold tabular-nums"
      />

      {/*
        Des suggestions, pas une énumération — même geste que les formats de
        `size.ts`. Une caisse dans les bras, une puce vaut mieux qu'un pavé
        numérique, et le champ reste libre pour les dix-huit d'un carton
        entamé.
      */}
      <ul className="mt-2 flex gap-2">
        {QUANTITY_CHIPS.map((chip) => (
          <li key={chip}>
            <button
              type="button"
              onClick={() => onChange(String(chip))}
              aria-pressed={value === String(chip)}
              className={`flex min-h-11 min-w-11 items-center justify-center rounded-full border px-4 text-sm font-medium tabular-nums transition-transform duration-150 ease-out active:scale-[0.97] ${
                value === String(chip)
                  ? 'border-ink bg-primary text-primary-foreground'
                  : 'border-line bg-surface-raised text-ink-soft hover:text-ink'
              }`}
            >
              {chip}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Un des deux sens, en grand.
 *
 * `aria-pressed` plutôt qu'un groupe de boutons radio : ce sont deux actions
 * qui basculent un état, pas un formulaire à soumettre, et un lecteur d'écran
 * annonce alors « Entrée, activé » sans qu'un `fieldset` ait à porter un
 * intitulé que rien ne montre à l'écran.
 */
function DirectionButton({
  icon,
  selected,
  onClick,
  children,
}: {
  icon: typeof Plus
  selected: boolean
  onClick: () => void
  children: string
}) {
  return (
    <ActionButton
      icon={icon}
      variant={selected ? 'default' : 'outline'}
      aria-pressed={selected}
      onClick={onClick}
      className="w-full"
    >
      {children}
    </ActionButton>
  )
}
