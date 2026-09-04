import { Link, createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'

import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Switch } from '#/components/ui/switch'
import { Textarea } from '#/components/ui/textarea'
import {
  describeError,
  fetchMenu,
  nextPosition,
  swapPositions,
} from '#/lib/menu'
import {
  PriceFormatError,
  centsToInput,
  formatPrice,
  parseOptionalEurosToCents,
} from '#/lib/price'
import { supabase } from '#/lib/supabase'

import type { FormEvent } from 'react'
import type { CategoryWithProducts } from '#/lib/menu'
import type { Product } from '#/lib/supabase'

export const Route = createFileRoute('/_authenticated/admin/$venueSlug')({
  component: MenuEditor,
})

function MenuEditor() {
  const { venueSlug } = Route.useParams()
  const queryClient = useQueryClient()
  const queryKey = ['menu', venueSlug]

  const menuQuery = useQuery({
    queryKey,
    queryFn: () => fetchMenu(venueSlug),
  })

  const refresh = () => queryClient.invalidateQueries({ queryKey })

  if (menuQuery.isPending) {
    return <p className="text-sm text-[var(--sea-ink-soft)]">Chargement…</p>
  }

  if (menuQuery.isError) {
    return (
      <div className="island-shell rounded-2xl p-6">
        <p role="alert" className="text-sm text-destructive">
          {menuQuery.error.message}
        </p>
        <Link to="/admin" className="mt-4 inline-block text-sm">
          Retour aux établissements
        </Link>
      </div>
    )
  }

  const { venue, categories } = menuQuery.data

  return (
    <div className="page-wrap px-0">
      <Link
        to="/admin"
        className="nav-link inline-flex min-h-11 items-center gap-1 text-sm no-underline"
      >
        <ArrowLeft className="size-4" />
        Établissements
      </Link>

      <header className="mt-2">
        <p className="island-kicker">Carte</p>
        <h1 className="display-title mt-1 text-2xl leading-tight sm:text-3xl">
          {venue.name}
        </h1>
        <p className="mt-2 text-sm text-[var(--sea-ink-soft)]">
          <code>/m/{venue.slug}</code> — les produits en rupture sont masqués
          pour les clients.
        </p>
      </header>

      <AddCategoryForm
        venueId={venue.id}
        categories={categories}
        onDone={refresh}
      />

      {categories.length === 0 ? (
        <div className="island-shell mt-6 rounded-2xl px-6 py-12 text-center">
          <p className="display-title text-lg">Carte vide</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-[var(--sea-ink-soft)]">
            Commencez par une catégorie — « Bières pression », « Cocktails » —
            puis ajoutez-y vos produits.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {categories.map((category, index) => (
            <CategorySection
              key={category.id}
              category={category}
              currency={venue.currency}
              isFirst={index === 0}
              isLast={index === categories.length - 1}
              onMove={async (direction) => {
                const neighbour = categories[index + direction]
                await swapPositions('categories', category, neighbour)
                await refresh()
              }}
              onDone={refresh}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/** Message d'erreur partagé par tous les formulaires de cet écran. */
function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className="animate-in fade-in-0 slide-in-from-top-1 mt-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive duration-200 ease-out"
    >
      {children}
    </p>
  )
}

function AddCategoryForm({
  venueId,
  categories,
  onDone,
}: {
  venueId: string
  categories: Array<CategoryWithProducts>
  onDone: () => Promise<void>
}) {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const create = useMutation({
    mutationFn: async () => {
      const { error: insertError } = await supabase.from('categories').insert({
        venue_id: venueId,
        name: name.trim(),
        position: nextPosition(categories),
      })
      if (insertError) throw new Error(describeError(insertError))
    },
    onSuccess: async () => {
      setName('')
      setError(null)
      await onDone()
    },
    onError: (cause: Error) => setError(cause.message),
  })

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    create.mutate()
  }

  return (
    <section className="island-shell mt-6 rounded-2xl p-4 sm:p-6">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-3 lg:flex-row lg:items-end"
      >
        <div className="flex-1 space-y-2">
          <Label htmlFor="category-name">Nouvelle catégorie</Label>
          <Input
            id="category-name"
            required
            maxLength={80}
            placeholder="Bières pression"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="h-11 lg:h-10"
          />
        </div>
        <Button
          type="submit"
          disabled={create.isPending || !name.trim()}
          className="h-11 gap-2 transition-transform duration-150 ease-out active:scale-[0.97] lg:h-10"
        >
          <Plus className="size-4" />
          {create.isPending ? 'Ajout…' : 'Ajouter'}
        </Button>
      </form>
      {error ? <ErrorNote>{error}</ErrorNote> : null}
    </section>
  )
}

function CategorySection({
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
  const [isRenaming, setIsRenaming] = useState(false)
  const [name, setName] = useState(category.name)
  const [isAdding, setIsAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const rename = useMutation({
    mutationFn: async () => {
      const { error: updateError } = await supabase
        .from('categories')
        .update({ name: name.trim() })
        .eq('id', category.id)
      if (updateError) throw new Error(describeError(updateError))
    },
    onSuccess: async () => {
      setIsRenaming(false)
      setError(null)
      await onDone()
    },
    onError: (cause: Error) => setError(cause.message),
  })

  const remove = useMutation({
    mutationFn: async () => {
      const { error: deleteError } = await supabase
        .from('categories')
        .delete()
        .eq('id', category.id)
      if (deleteError) throw new Error(describeError(deleteError))
    },
    onSuccess: onDone,
    onError: (cause: Error) => setError(cause.message),
  })

  const productCount = category.products.length

  return (
    <section className="island-shell rounded-2xl p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        {isRenaming ? (
          <form
            onSubmit={(event) => {
              event.preventDefault()
              rename.mutate()
            }}
            className="flex flex-1 flex-wrap items-center gap-2"
          >
            <Input
              autoFocus
              required
              maxLength={80}
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="h-11 flex-1 lg:h-9"
            />
            <Button
              type="submit"
              size="sm"
              disabled={rename.isPending || !name.trim()}
              className="h-11 lg:h-9"
            >
              Enregistrer
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-11 lg:h-9"
              onClick={() => {
                setName(category.name)
                setIsRenaming(false)
                setError(null)
              }}
            >
              Annuler
            </Button>
          </form>
        ) : (
          <div className="min-w-0 flex-1">
            <h2 className="display-title text-lg leading-tight">
              {category.name}
            </h2>
            <p className="mt-0.5 text-xs text-[var(--sea-ink-soft)]">
              {productCount === 0
                ? 'Aucun produit'
                : `${productCount} produit${productCount > 1 ? 's' : ''}`}
            </p>
          </div>
        )}

        {!isRenaming ? (
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Monter la catégorie"
              disabled={isFirst}
              onClick={() => onMove(-1)}
              className="size-11 lg:size-9"
            >
              <ChevronUp className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Descendre la catégorie"
              disabled={isLast}
              onClick={() => onMove(1)}
              className="size-11 lg:size-9"
            >
              <ChevronDown className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Renommer la catégorie"
              onClick={() => setIsRenaming(true)}
              className="size-11 lg:size-9"
            >
              <Pencil className="size-4" />
            </Button>
            <ConfirmDelete
              label="Supprimer la catégorie"
              /*
                La cascade est déclarée en base (`on delete cascade`) : supprimer
                une catégorie emporte ses produits. L'annoncer explicitement,
                puisque rien à l'écran ne le laisse deviner.
              */
              question={
                productCount > 0
                  ? `Supprimer « ${category.name} » et ses ${productCount} produit${productCount > 1 ? 's' : ''} ?`
                  : `Supprimer « ${category.name} » ?`
              }
              pending={remove.isPending}
              onConfirm={() => remove.mutate()}
            />
          </div>
        ) : null}
      </div>

      {error ? <ErrorNote>{error}</ErrorNote> : null}

      {productCount > 0 ? (
        <ul className="mt-4 divide-y divide-[var(--line)] border-t border-[var(--line)]">
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
        <Button
          type="button"
          variant="ghost"
          onClick={() => setIsAdding(true)}
          className="mt-3 h-11 gap-2 transition-transform duration-150 ease-out active:scale-[0.97] lg:h-9"
        >
          <Plus className="size-4" />
          Ajouter un produit
        </Button>
      )}
    </section>
  )
}

function ProductRow({
  product,
  currency,
  isFirst,
  isLast,
  onMove,
  onDone,
}: {
  product: Product
  currency: string
  isFirst: boolean
  isLast: boolean
  onMove: (direction: -1 | 1) => Promise<void>
  onDone: () => Promise<void>
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const setAvailability = useMutation({
    mutationFn: async (isAvailable: boolean) => {
      const { error: updateError } = await supabase
        .from('products')
        .update({ is_available: isAvailable })
        .eq('id', product.id)
      if (updateError) throw new Error(describeError(updateError))
    },
    onSuccess: onDone,
    onError: (cause: Error) => setError(cause.message),
  })

  const remove = useMutation({
    mutationFn: async () => {
      const { error: deleteError } = await supabase
        .from('products')
        .delete()
        .eq('id', product.id)
      if (deleteError) throw new Error(describeError(deleteError))
    },
    onSuccess: onDone,
    onError: (cause: Error) => setError(cause.message),
  })

  if (isEditing) {
    return (
      <li className="py-3">
        <ProductForm
          product={product}
          categoryId={product.category_id}
          position={product.position}
          onCancel={() => setIsEditing(false)}
          onDone={async () => {
            setIsEditing(false)
            await onDone()
          }}
        />
      </li>
    )
  }

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
      <div className="min-w-0 flex-1">
        <p
          className={
            product.is_available
              ? 'font-medium'
              : 'font-medium text-[var(--sea-ink-soft)] line-through'
          }
        >
          {product.name}
        </p>
        {product.description ? (
          <p className="mt-0.5 line-clamp-2 text-sm text-[var(--sea-ink-soft)]">
            {product.description}
          </p>
        ) : null}
      </div>

      {product.price_cents === null ? (
        /*
          Un prix absent est une information, pas un vide : l'écrire évite au
          gérant de se demander si la ligne est cassée ou s'il a oublié de la
          renseigner.
        */
        <p className="text-sm text-[var(--sea-ink-soft)] italic">
          Prix non renseigné
        </p>
      ) : (
        <p className="font-semibold tabular-nums">
          {formatPrice(product.price_cents, currency)}
        </p>
      )}

      <div className="flex items-center gap-1">
        <label className="flex min-h-11 items-center gap-2 pr-1 text-xs text-[var(--sea-ink-soft)] lg:min-h-9">
          <Switch
            checked={product.is_available}
            disabled={setAvailability.isPending}
            onCheckedChange={(checked) => setAvailability.mutate(checked)}
            aria-label={
              product.is_available
                ? 'Marquer en rupture'
                : 'Remettre à la carte'
            }
          />
          <span className="hidden sm:inline">
            {product.is_available ? 'En vente' : 'Rupture'}
          </span>
        </label>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Monter le produit"
          disabled={isFirst}
          onClick={() => onMove(-1)}
          className="size-11 lg:size-9"
        >
          <ChevronUp className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Descendre le produit"
          disabled={isLast}
          onClick={() => onMove(1)}
          className="size-11 lg:size-9"
        >
          <ChevronDown className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Modifier le produit"
          onClick={() => setIsEditing(true)}
          className="size-11 lg:size-9"
        >
          <Pencil className="size-4" />
        </Button>
        <ConfirmDelete
          label="Supprimer le produit"
          question={`Supprimer « ${product.name} » ?`}
          pending={remove.isPending}
          onConfirm={() => remove.mutate()}
        />
      </div>

      {error ? (
        <div className="w-full">
          <ErrorNote>{error}</ErrorNote>
        </div>
      ) : null}
    </li>
  )
}

/**
 * Formulaire de création et d'édition d'un produit.
 *
 * Le même composant sert aux deux : les champs, la validation du prix et les
 * messages d'erreur y sont identiques, et les dupliquer garantirait qu'ils
 * divergent. La présence de `product` distingue les deux modes.
 */
function ProductForm({
  product,
  categoryId,
  position,
  onCancel,
  onDone,
}: {
  product?: Product
  categoryId: string
  position: number
  onCancel: () => void
  onDone: () => Promise<void>
}) {
  const [name, setName] = useState(product?.name ?? '')
  const [description, setDescription] = useState(product?.description ?? '')
  const [price, setPrice] = useState(
    product ? centsToInput(product.price_cents) : '',
  )
  const [error, setError] = useState<string | null>(null)

  const save = useMutation({
    mutationFn: async () => {
      let priceCents: number | null
      try {
        priceCents = parseOptionalEurosToCents(price)
      } catch (cause) {
        throw cause instanceof PriceFormatError
          ? cause
          : new Error('Prix invalide.')
      }

      const fields = {
        name: name.trim(),
        description: description.trim() || null,
        price_cents: priceCents,
      }

      const result = product
        ? await supabase.from('products').update(fields).eq('id', product.id)
        : await supabase
            .from('products')
            .insert({ ...fields, category_id: categoryId, position })

      if (result.error) throw new Error(describeError(result.error))
    },
    onSuccess: onDone,
    onError: (cause: Error) => setError(cause.message),
  })

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    save.mutate()
  }

  const fieldId = product
    ? `product-${product.id}`
    : `product-new-${categoryId}`

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-3 rounded-xl border border-[var(--line)] bg-[var(--chip-bg)] p-3 sm:p-4"
    >
      {/* Deux colonnes dès lg : le back-office doit exploiter la largeur, pas empiler. */}
      <div className="grid gap-3 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-2">
          <Label htmlFor={`${fieldId}-name`}>Nom</Label>
          <Input
            id={`${fieldId}-name`}
            autoFocus
            required
            maxLength={120}
            placeholder="Pinte de blonde"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="h-11 lg:h-9"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${fieldId}-price`}>
            Prix{' '}
            <span className="font-normal text-[var(--sea-ink-soft)]">
              (facultatif)
            </span>
          </Label>
          <Input
            id={`${fieldId}-price`}
            /*
              `inputMode="decimal"` fait apparaître le pavé numérique sur mobile,
              là où `type="number"` imposerait le point décimal et des flèches
              inutiles pour un prix.
            */
            inputMode="decimal"
            placeholder="6,50"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            className="h-11 tabular-nums lg:h-9"
          />
          <p className="text-xs text-[var(--sea-ink-soft)]">
            Laissez vide pour un plat du jour ou un prix selon arrivage.
          </p>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        <Label htmlFor={`${fieldId}-description`}>Description</Label>
        <Textarea
          id={`${fieldId}-description`}
          rows={2}
          maxLength={500}
          placeholder="Facultatif — origine, degré, allergènes…"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </div>

      {error ? <ErrorNote>{error}</ErrorNote> : null}

      <div className="mt-3 flex gap-2">
        <Button
          type="submit"
          disabled={save.isPending || !name.trim()}
          className="h-11 transition-transform duration-150 ease-out active:scale-[0.97] lg:h-9"
        >
          {save.isPending ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          className="h-11 lg:h-9"
        >
          Annuler
        </Button>
      </div>
    </form>
  )
}

/**
 * Suppression en deux temps.
 *
 * Le bouton se transforme en question au lieu d'ouvrir une boîte de dialogue :
 * la confirmation reste à l'endroit exact où le geste a eu lieu, sans déplacer
 * le regard ni voler le focus. `window.confirm` était l'autre option, mais il
 * bloque le fil d'exécution et ne se laisse pas mettre en forme.
 */
function ConfirmDelete({
  label,
  question,
  pending,
  onConfirm,
}: {
  label: string
  question: string
  pending: boolean
  onConfirm: () => void
}) {
  const [isAsking, setIsAsking] = useState(false)

  if (!isAsking) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={label}
        onClick={() => setIsAsking(true)}
        className="size-11 text-destructive hover:bg-destructive/10 hover:text-destructive lg:size-9"
      >
        <Trash2 className="size-4" />
      </Button>
    )
  }

  return (
    <div className="animate-in fade-in-0 flex flex-wrap items-center gap-2 duration-150 ease-out">
      <span className="text-sm">{question}</span>
      <Button
        type="button"
        variant="destructive"
        size="sm"
        disabled={pending}
        onClick={onConfirm}
        className="h-11 lg:h-9"
      >
        {pending ? 'Suppression…' : 'Supprimer'}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setIsAsking(false)}
        className="h-11 lg:h-9"
      >
        Annuler
      </Button>
    </div>
  )
}
