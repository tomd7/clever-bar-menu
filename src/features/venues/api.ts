import { queryOptions } from '@tanstack/react-query'

import { describeError } from '#/lib/postgrest-error'
import { supabase } from '#/lib/supabase'

import type { Venue } from '#/lib/supabase'

/**
 * Dérive un identifiant d'URL depuis le nom saisi.
 *
 * `NFD` sépare les lettres de leurs accents, que la plage
 * `\u0300-\u036f` supprime ensuite : « Café Léon » devient `cafe-leon` plutôt que `caf-l-on`.
 * Ce slug se retrouvera dans l'URL encodée par le QR code, il doit rester
 * lisible et stable.
 */
export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

export const VENUES_QUERY_KEY = ['venues'] as const

/**
 * Les établissements d'un gérant, du plus ancien au plus récent.
 *
 * Les archivés sont **inclus** : c'est l'écran qui les sépare des actifs. Deux
 * requêtes distinctes doubleraient les allers-retours pour deux listes qui
 * s'affichent ensemble, et il faudrait invalider les deux à chaque archivage.
 * La policy `venues_owner_read` est ce qui rend les archivés lisibles ici, là
 * où un visiteur ne voit que les actifs.
 */
export function venuesQueryOptions(ownerId: string) {
  return queryOptions({
    queryKey: [...VENUES_QUERY_KEY, ownerId],
    queryFn: async (): Promise<Array<Venue>> => {
      /**
       * Le filtre sur `owner_id` est explicite alors que le RLS autorise la
       * lecture publique : les policies de lecture servent la carte publique,
       * pas le back-office. Sans ce filtre, le gérant verrait tous les
       * établissements de la plateforme.
       */
      const { data, error } = await supabase
        .from('venues')
        .select('*')
        .eq('owner_id', ownerId)
        .order('created_at', { ascending: true })

      if (error) throw new Error(describeError(error))
      return data
    },
  })
}

/**
 * Archive un établissement — suppression logique.
 *
 * La date vient du client, faute d'un `now()` exprimable via PostgREST sur une
 * mise à jour. Un décalage d'horloge de quelques secondes est sans conséquence
 * sur un marqueur d'archivage ; il en aurait sur une date de facturation.
 */
export async function archiveVenue(venueId: string): Promise<void> {
  const { error } = await supabase
    .from('venues')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', venueId)

  if (error) throw new Error(describeError(error))
}

/** Remet un établissement archivé en service, carte et photos comprises. */
export async function restoreVenue(venueId: string): Promise<void> {
  const { error } = await supabase
    .from('venues')
    .update({ deleted_at: null })
    .eq('id', venueId)

  if (error) throw new Error(describeError(error))
}

/**
 * Un établissement désigné par son slug.
 *
 * Requête distincte de `venuesQueryOptions` : celle-ci sert une page qui ne
 * connaît que l'adresse, pas le propriétaire. Le filtre sur `owner_id` y serait
 * inutile — le RLS refuse déjà toute écriture, et la lecture d'un établissement
 * est publique par conception.
 */
export function venueBySlugQueryOptions(venueSlug: string) {
  return queryOptions({
    queryKey: [...VENUES_QUERY_KEY, 'by-slug', venueSlug],
    queryFn: async (): Promise<Venue> => {
      const { data, error } = await supabase
        .from('venues')
        .select('*')
        .eq('slug', venueSlug)
        .maybeSingle()

      if (error) throw new Error(describeError(error))
      if (!data) throw new Error("Cet établissement n'existe pas.")
      return data
    },
  })
}

/** Crée un établissement à partir de son seul nom, dont le slug est dérivé. */
export async function createVenue(name: string): Promise<void> {
  const slug = slugify(name)
  if (!slug) {
    throw new Error('Ce nom ne permet pas de construire une adresse.')
  }

  /**
   * `owner_id` n'est pas renseigné : la colonne vaut `auth.uid()` par
   * défaut, et la policy d'insertion refuserait toute autre valeur.
   */
  const { error } = await supabase
    .from('venues')
    .insert({ name: name.trim(), slug })

  if (error) {
    /*
      Le seul cas que `describeError` ne peut pas traiter aussi bien : elle rend
      « Cet élément existe déjà. » là où le slug fautif est connu ici, et le
      nommer dit au gérant quoi changer. Tout le reste lui revient.
    */
    throw new Error(
      error.code === '23505'
        ? `L'adresse « ${slug} » est déjà utilisée. Choisissez un autre nom.`
        : describeError(error),
    )
  }
}
