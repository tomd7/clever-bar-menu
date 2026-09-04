import { Link, createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { ChevronRight, Plus, Store } from 'lucide-react'

import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { supabase } from '#/lib/supabase'

import type { FormEvent } from 'react'
import type { Venue } from '#/lib/supabase'

export const Route = createFileRoute('/_authenticated/admin/')({
  component: VenuesPage,
})

/**
 * Dérive un identifiant d'URL depuis le nom saisi.
 *
 * `NFD` sépare les lettres de leurs accents, que la plage
 * `\u0300-\u036f` supprime ensuite : « Café Léon » devient `cafe-leon` plutôt que `caf-l-on`.
 * Ce slug se retrouvera dans l'URL encodée par le QR code, il doit rester
 * lisible et stable.
 */
function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

function VenuesPage() {
  const { user } = Route.useRouteContext()
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const venuesQuery = useQuery({
    queryKey: ['venues', user.id],
    queryFn: async (): Promise<Array<Venue>> => {
      /**
       * Le filtre sur `owner_id` est explicite alors que le RLS autorise la
       * lecture publique : les policies de lecture servent la carte publique,
       * pas le back-office. Sans ce filtre, le gérant verrait tous les
       * établissements de la plateforme.
       */
      const { data, error: queryError } = await supabase
        .from('venues')
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: true })

      if (queryError) throw new Error(queryError.message)
      return data
    },
  })

  const createVenue = useMutation({
    mutationFn: async (venueName: string) => {
      const slug = slugify(venueName)
      if (!slug) {
        throw new Error('Ce nom ne permet pas de construire une adresse.')
      }

      /**
       * `owner_id` n'est pas renseigné : la colonne vaut `auth.uid()` par
       * défaut, et la policy d'insertion refuserait toute autre valeur.
       */
      const { error: insertError } = await supabase
        .from('venues')
        .insert({ name: venueName.trim(), slug })

      if (insertError) {
        // 23505 = violation de contrainte d'unicité (le slug est déjà pris).
        throw new Error(
          insertError.code === '23505'
            ? `L'adresse « ${slug} » est déjà utilisée. Choisissez un autre nom.`
            : insertError.message,
        )
      }
    },
    onSuccess: async () => {
      setName('')
      setError(null)
      await queryClient.invalidateQueries({ queryKey: ['venues', user.id] })
    },
    onError: (cause: Error) => setError(cause.message),
  })

  function handleCreate(event: FormEvent) {
    event.preventDefault()
    setError(null)
    createVenue.mutate(name)
  }

  const venues = venuesQuery.data ?? []
  const preview = slugify(name)

  return (
    <div className="page-wrap px-0">
      <header>
        <p className="island-kicker">Vos établissements</p>
        <h1 className="display-title mt-1 text-2xl leading-tight sm:text-3xl">
          Établissements
        </h1>
        <p className="mt-2 max-w-prose text-sm text-[var(--sea-ink-soft)]">
          Chaque établissement porte sa propre carte et sa propre adresse
          publique.
        </p>
      </header>

      <section className="island-shell mt-6 rounded-2xl p-4 sm:p-6">
        <form
          onSubmit={handleCreate}
          className="flex flex-col gap-3 lg:flex-row lg:items-end"
        >
          <div className="flex-1 space-y-2">
            <Label htmlFor="venue-name">Nom de l'établissement</Label>
            <Input
              id="venue-name"
              required
              maxLength={80}
              placeholder="Le Comptoir"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="h-11 lg:h-10"
            />
            {preview ? (
              <p className="text-xs text-[var(--sea-ink-soft)]">
                Adresse publique : <code>/m/{preview}</code>
              </p>
            ) : null}
          </div>

          <Button
            type="submit"
            disabled={createVenue.isPending || !name.trim()}
            className="h-11 gap-2 transition-transform duration-150 ease-out active:scale-[0.97] lg:h-10"
          >
            <Plus className="size-4" />
            {createVenue.isPending ? 'Création…' : 'Ajouter'}
          </Button>
        </form>

        {error ? (
          <p
            role="alert"
            className="animate-in fade-in-0 slide-in-from-top-1 mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive duration-200 ease-out"
          >
            {error}
          </p>
        ) : null}
      </section>

      <section className="mt-6">
        {venuesQuery.isPending ? (
          <p className="text-sm text-[var(--sea-ink-soft)]">Chargement…</p>
        ) : venuesQuery.isError ? (
          <p role="alert" className="text-sm text-destructive">
            {venuesQuery.error.message}
          </p>
        ) : venues.length === 0 ? (
          <div className="island-shell rounded-2xl px-6 py-12 text-center">
            <Store className="mx-auto size-8 text-[var(--lagoon-deep)]" />
            <p className="display-title mt-3 text-lg">
              Aucun établissement pour l'instant
            </p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-[var(--sea-ink-soft)]">
              Créez le premier ci-dessus : vous pourrez ensuite y composer vos
              catégories et vos produits.
            </p>
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {venues.map((venue, position) => (
              <li
                key={venue.id}
                className="rise-in"
                /*
                  Décalage court entre les cartes : l'entrée se lit comme une
                  cascade plutôt que comme un bloc. Au-delà de quelques dizaines
                  de millisecondes, l'interface paraîtrait simplement lente.
                */
                style={{ animationDelay: `${Math.min(position, 8) * 45}ms` }}
              >
                <Link
                  to="/admin/$venueSlug"
                  params={{ venueSlug: venue.slug }}
                  className="feature-card flex min-h-24 flex-col rounded-2xl border border-[var(--line)] p-4 no-underline"
                >
                  <p className="display-title text-lg leading-tight text-[var(--sea-ink)]">
                    {venue.name}
                  </p>
                  <p className="mt-1 text-xs text-[var(--sea-ink-soft)]">
                    <code>/m/{venue.slug}</code>
                  </p>
                  <p className="mt-3 flex items-center gap-1 text-xs font-semibold text-[var(--lagoon-deep)]">
                    Composer la carte
                    <ChevronRight className="size-3" />
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
