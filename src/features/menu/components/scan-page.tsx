import { ArrowLeft, Undo2 } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { ActionButton } from '#/components/buttons/action-button'
import { BarcodeFormatError, normalizeBarcode } from '#/features/menu/barcode'
import { ErrorNote } from '#/components/error-note'
import { NavLink } from '#/components/nav-link'
import { ProductSize } from '#/components/product-size'
import { ScanCamera } from '#/features/menu/components/scan-camera'
import { ScanMovementPanel } from '#/features/menu/components/scan-movement-panel'
import { ScanPairingPanel } from '#/features/menu/components/scan-pairing-panel'
import { TextField } from '#/components/form/text-field'
import { isScannerAvailable } from '#/features/menu/scanner'
import { menuQueryOptions } from '#/features/menu/api'
import {
  useAdjustProductStock,
  useSetProductBarcode,
  useSetProductStock,
} from '#/features/menu/mutations'

import type { Menu } from '#/features/menu/api'
import type {
  MovementDirection,
  ScanMovement,
} from '#/features/menu/components/scan-movement-panel'
import type { Product } from '#/lib/supabase'

/** Ce qui couvre la caméra, quand quelque chose la couvre. */
type Overlay =
  | { kind: 'movement'; barcode: string; productId: string }
  | { kind: 'pairing'; barcode: string; pairedProductId: string | null }

/** Un mouvement passé, gardé le temps de la session pour pouvoir le défaire. */
type JournalEntry = {
  id: string
  productId: string
  name: string
  size: string | null
  /** Ce qui a été demandé. */
  delta: number
  /**
   * Ce qui a **réellement** bougé. Différent de `delta` quand une sortie
   * dépasse le stock : la fonction SQL planche à zéro, et défaire l'opposé de
   * ce qui avait été demandé fabriquerait des bouteilles.
   */
  applied: number
  resulting: number
  /** Le mouvement a activé le suivi plutôt que de déplacer un niveau. */
  started: boolean
  undone: boolean
  error: string | null
}

/**
 * Écran de scan : une caméra, un mouvement de stock par code lu.
 *
 * Il existe pour un moment précis, la livraison. La page Stock compte au doigt,
 * une ligne à la fois, ce qui est juste pour corriger un niveau et intenable
 * pour ranger un casier : vingt-quatre allers-retours dans une carte de
 * quarante produits. Ici, un scan amène le produit, on dit combien et dans quel
 * sens, et on passe au suivant.
 *
 * Trois choses portent la fiabilité de cet écran, et aucune ne se voit :
 *
 * - **La résolution se fait sur la carte fraîchement lue**, pas sur une table
 *   indexée côté base. Un `select ... where barcode = ?` demanderait un index
 *   et ouvrirait une énumération à qui possède la clé publiable ; la carte de
 *   l'établissement, elle, est déjà en cache, et la chercher en mémoire est
 *   instantané pour quelques dizaines de lignes. Elle a aussi une propriété
 *   qu'aucune requête n'aurait gratuitement : un gérant qui tient deux bars ne
 *   peut pas décompter la bière de l'autre.
 * - **Un code inconnu déclenche une relecture avant d'être déclaré inconnu.**
 *   Sans elle, l'appareil qui ignore l'appairage fait à l'instant sur l'autre
 *   téléphone proposerait de refaire le même — deux produits porteraient le
 *   même code, et la résolution rendrait le premier venu. Un aller-retour sur
 *   le chemin froid, zéro sur le chemin chaud.
 * - **Le journal retient ce qui a bougé, pas ce qui a été demandé.** C'est ce
 *   qui rend « Annuler » exact quand le plancher à zéro s'en est mêlé.
 */
export function ScanPage({ venueSlug }: { venueSlug: string }) {
  const queryClient = useQueryClient()

  const adjust = useAdjustProductStock()
  const setStock = useSetProductStock()
  const setBarcode = useSetProductBarcode()

  const [overlay, setOverlay] = useState<Overlay | null>(null)
  const [product, setProduct] = useState<Product | null>(null)
  const [categories, setCategories] = useState<Menu['categories']>([])
  const [journal, setJournal] = useState<Array<JournalEntry>>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  /*
    Le sens est retenu d'un mouvement à l'autre, mais jamais deviné : ranger une
    livraison, c'est vingt entrées de suite, et redemander vingt fois serait une
    cérémonie. Il reste affiché en grand dans le panneau, ce qui est la vraie
    protection contre le sens inversé — le montrer, plutôt que le mémoriser.
  */
  const [direction, setDirection] = useState<MovementDirection>('in')

  const scannerAvailable = isScannerAvailable()

  async function readMenu(refresh: boolean): Promise<Menu> {
    const options = menuQueryOptions(venueSlug)
    return refresh
      ? queryClient.fetchQuery(options)
      : queryClient.ensureQueryData(options)
  }

  async function handleBarcode(barcode: string) {
    setError(null)
    setBusy(true)

    try {
      let menu = await readMenu(false)
      let found = findByBarcode(menu, barcode)

      if (!found) {
        /* Le chemin froid : peut-être que l'autre appareil vient de l'appairer. */
        menu = await readMenu(true)
        found = findByBarcode(menu, barcode)
      }

      setCategories(menu.categories)

      if (found) {
        setProduct(found)
        setOverlay({ kind: 'movement', barcode, productId: found.id })
      } else {
        setProduct(null)
        setOverlay({ kind: 'pairing', barcode, pairedProductId: null })
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'La carte n’a pas pu être lue.',
      )
    } finally {
      setBusy(false)
    }
  }

  async function handleMovement(movement: ScanMovement) {
    if (!product) return

    setError(null)
    const before = product.stock_quantity ?? 0

    try {
      if (movement.kind === 'adjust') {
        const resulting = await adjust.mutateAsync({
          productId: product.id,
          delta: movement.delta,
        })

        addEntry(setJournal, {
          product,
          delta: movement.delta,
          applied: resulting - before,
          resulting,
          started: false,
        })
      } else {
        await setStock.mutateAsync({
          productId: product.id,
          quantity: movement.quantity,
        })

        addEntry(setJournal, {
          product,
          delta: movement.quantity,
          applied: movement.quantity,
          resulting: movement.quantity,
          started: true,
        })
      }

      close()
    } catch (cause) {
      /* Le panneau reste ouvert : l'erreur est là où le geste a été fait. */
      setError(cause instanceof Error ? cause.message : 'Écriture refusée.')
    }
  }

  async function handlePair(productId: string) {
    if (overlay?.kind !== 'pairing') return

    setError(null)

    try {
      await setBarcode.mutateAsync({ productId, barcode: overlay.barcode })

      /*
        Relecture plutôt que patch local : le produit affiché par le panneau de
        mouvement doit porter le niveau que la base connaît, et l'appairage
        vient d'invalider la carte de toute façon.
      */
      const menu = await readMenu(false)
      const paired = findProduct(menu, productId)
      if (!paired) return

      setCategories(menu.categories)
      setProduct(paired)
      setOverlay({ kind: 'movement', barcode: overlay.barcode, productId })
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Association impossible.',
      )
    }
  }

  async function handleUndo(entry: JournalEntry) {
    setJournal((entries) =>
      entries.map((item) =>
        item.id === entry.id ? { ...item, error: null } : item,
      ),
    )

    try {
      if (entry.started) {
        /* Défaire une activation, c'est retirer le suivi — pas revenir à zéro,
           qui masquerait le produit de la carte des clients. */
        await setStock.mutateAsync({
          productId: entry.productId,
          quantity: null,
        })
      } else {
        await adjust.mutateAsync({
          productId: entry.productId,
          delta: -entry.applied,
        })
      }

      setJournal((entries) =>
        entries.map((item) =>
          item.id === entry.id ? { ...item, undone: true } : item,
        ),
      )
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : 'Annulation refusée.'
      setJournal((entries) =>
        entries.map((item) =>
          item.id === entry.id ? { ...item, error: message } : item,
        ),
      )
    }
  }

  function close() {
    setOverlay(null)
    setProduct(null)
    setError(null)
  }

  return (
    <div className="page-wrap px-0">
      <NavLink
        to="/admin/$venueSlug/stock"
        params={{ venueSlug }}
        icon={ArrowLeft}
        className="lg:hidden"
      >
        Retour au stock
      </NavLink>

      <header className="mt-2 lg:mt-0">
        <p className="island-kicker">Scanner</p>
        <h1 className="display-title mt-1 text-2xl leading-tight sm:text-3xl">
          Entrées et sorties
        </h1>
        <p className="mt-2 text-sm text-ink-soft">
          Scannez le code-barres d’un produit, indiquez le sens et la quantité.
          Un produit encore inconnu vous sera demandé une seule fois.
        </p>
      </header>

      <div className="mt-6 space-y-4">
        {scannerAvailable ? (
          <div className="relative">
            <ScanCamera
              paused={overlay !== null || busy}
              onDetect={handleBarcode}
            />

            {overlay ? (
              <div className="animate-in fade-in-0 slide-in-from-bottom-2 absolute inset-0 z-10 overflow-hidden rounded-2xl border border-line duration-200 ease-out">
                {overlay.kind === 'movement' && product ? (
                  <ScanMovementPanel
                    product={product}
                    direction={direction}
                    onDirectionChange={setDirection}
                    onSubmit={handleMovement}
                    onCancel={close}
                    onRepair={() =>
                      setOverlay({
                        kind: 'pairing',
                        barcode: overlay.barcode,
                        pairedProductId: product.id,
                      })
                    }
                    pending={adjust.isPending || setStock.isPending}
                    error={error}
                  />
                ) : null}

                {overlay.kind === 'pairing' ? (
                  <ScanPairingPanel
                    barcode={overlay.barcode}
                    categories={categories}
                    pairedProductId={overlay.pairedProductId}
                    onPair={handlePair}
                    onCancel={close}
                    pending={setBarcode.isPending}
                    error={error}
                  />
                ) : null}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="panel rounded-2xl p-4 sm:p-5">
            <p className="text-sm text-ink-soft">
              Ce navigateur ne sait pas lire un code-barres par la caméra —
              c’est le cas de Safari et de Firefox. Sur un téléphone Android,
              ouvrez cet écran dans Chrome. En attendant, le code se saisit à la
              main.
            </p>
          </div>
        )}

        <ManualEntry onSubmit={handleBarcode} disabled={busy} />

        {/* Une erreur survenue hors panneau — la carte illisible, surtout. */}
        {error && !overlay ? <ErrorNote>{error}</ErrorNote> : null}
      </div>

      {journal.length > 0 ? (
        <section aria-label="Mouvements de la session" className="mt-6">
          <h2 className="island-kicker">Cette session</h2>

          <ul className="mt-2 divide-y divide-line border-t border-line">
            {journal.map((entry) => (
              <li key={entry.id} className="py-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <p
                    className={`min-w-0 flex-1 font-medium ${entry.undone ? 'text-ink-soft line-through' : ''}`}
                  >
                    {entry.name}
                    <ProductSize size={entry.size} />
                  </p>

                  <p className="shrink-0 text-sm tabular-nums text-ink-soft">
                    {entry.started
                      ? `suivi activé à ${entry.resulting}`
                      : `${formatDelta(entry.delta)} → ${entry.resulting}`}
                  </p>

                  {/*
                    « Annuler » n'apparaît que si quelque chose a bougé : sur une
                    sortie entièrement absorbée par le plancher à zéro, il n'y a
                    rien à défaire, et le proposer créerait du stock.
                  */}
                  {!entry.undone && entry.applied !== 0 ? (
                    <ActionButton
                      icon={Undo2}
                      variant="ghost"
                      onClick={() => void handleUndo(entry)}
                    >
                      Annuler
                    </ActionButton>
                  ) : null}
                </div>

                {entry.applied !== entry.delta && !entry.started ? (
                  <p className="mt-1 text-xs text-ink-soft">
                    {`Il n’y en avait que ${Math.abs(entry.applied)} : la sortie s’est arrêtée à zéro.`}
                  </p>
                ) : null}

                {entry.error ? <ErrorNote>{entry.error}</ErrorNote> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}

/**
 * La saisie du code à la main.
 *
 * Toujours présente, et pas seulement en secours : c'est le seul chemin sur
 * iPhone et sur Firefox, et le seul quand l'étiquette est déchirée. Elle passe
 * par exactement la même résolution que la caméra — deux chemins qui ne
 * s'accorderaient pas sur ce qu'est un code se contrediraient en production.
 */
function ManualEntry({
  onSubmit,
  disabled,
}: {
  onSubmit: (barcode: string) => void
  disabled: boolean
}) {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)

  return (
    <form
      className="panel rounded-2xl p-4 sm:p-5"
      onSubmit={(event) => {
        event.preventDefault()

        try {
          const barcode = normalizeBarcode(value)
          setError(null)
          setValue('')
          onSubmit(barcode)
        } catch (cause) {
          setError(
            cause instanceof BarcodeFormatError
              ? cause.message
              : 'Code-barres invalide.',
          )
        }
      }}
    >
      <div className="flex flex-wrap items-end gap-2">
        <TextField
          label="Saisir un code-barres"
          className="min-w-40 flex-1"
          inputMode="numeric"
          placeholder="3017620422003"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          inputClassName="tabular-nums"
        />
        <ActionButton type="submit" disabled={disabled || !value.trim()}>
          Chercher
        </ActionButton>
      </div>

      {/* `role="alert"` porté par `ErrorNote` : le message est annoncé à son
          apparition, sans qu'il faille l'attacher au champ. */}
      {error ? <ErrorNote>{error}</ErrorNote> : null}
    </form>
  )
}

function findByBarcode(menu: Menu, barcode: string): Product | undefined {
  for (const category of menu.categories) {
    const found = category.products.find(
      (product) => product.barcode === barcode,
    )
    if (found) return found
  }

  return undefined
}

function findProduct(menu: Menu, productId: string): Product | undefined {
  for (const category of menu.categories) {
    const found = category.products.find((product) => product.id === productId)
    if (found) return found
  }

  return undefined
}

function addEntry(
  setJournal: (
    update: (entries: Array<JournalEntry>) => Array<JournalEntry>,
  ) => void,
  entry: {
    product: Product
    delta: number
    applied: number
    resulting: number
    started: boolean
  },
) {
  setJournal((entries) => [
    {
      id: crypto.randomUUID(),
      productId: entry.product.id,
      name: entry.product.name,
      size: entry.product.size,
      delta: entry.delta,
      applied: entry.applied,
      resulting: entry.resulting,
      started: entry.started,
      undone: false,
      error: null,
    },
    ...entries,
  ])
}

function formatDelta(delta: number): string {
  return delta > 0 ? `+${delta}` : String(delta)
}
