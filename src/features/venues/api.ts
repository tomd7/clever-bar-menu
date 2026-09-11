import { queryOptions } from '@tanstack/react-query'

import { VENUES_QUERY_KEY } from '#/lib/query-keys'
import { MENU_THEMES } from '#/lib/menu-theme'
import { describeError } from '#/lib/postgrest-error'
import { removeVenueImages } from '#/lib/venue-images'
import { supabase } from '#/lib/supabase'

import type { MenuTheme } from '#/lib/menu-theme'
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

/**
 * Les slugs que le back-office s'est déjà réservés.
 *
 * `/admin/corbeille` est un segment statique : le routeur le fait passer avant
 * `/admin/$venueSlug`, si bien qu'un établissement portant ce slug serait créé
 * sans la moindre erreur puis resterait introuvable — sa carte publique
 * marcherait, son écran d'édition non. Le refus à la création est le seul
 * endroit où le problème est encore explicable.
 */
const RESERVED_SLUGS = new Set(['corbeille'])

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
 * Vide la corbeille : détruit pour de bon les établissements archivés.
 *
 * C'est la seule opération irréversible du back-office, et tout ici sert à ce
 * qu'elle ne détruise que ce qu'elle doit.
 *
 * **La liste est relue en base plutôt que reçue en argument.** L'écran ne
 * transmet pas les identifiants qu'il affiche : son cache peut dater de la
 * veille, d'un autre onglet, d'une restauration faite entre-temps. Ce que la
 * requête ci-dessous rapporte est ce qui est archivé maintenant.
 *
 * **Les photos partent avant la ligne, et l'ordre n'est pas négociable** — la
 * raison est dans `removeVenueImages`. Une erreur de stockage interrompt donc
 * la purge : l'établissement reste à la corbeille, et réessayer reprend là où
 * l'on s'était arrêté.
 *
 * **La suppression revérifie `deleted_at`** : entre la lecture et l'écriture,
 * un établissement restauré depuis un autre appareil ne doit pas être détruit
 * par une purge décidée sur un état d'avant.
 *
 * Un établissement à la fois, sans `Promise.all` : la corbeille compte
 * quelques lignes, l'ordre photos-puis-ligne se lit d'un coup d'œil, et le
 * premier échec laisse un état simple à décrire — ce qui est passé est parti,
 * le reste est intact.
 */
export async function purgeArchivedVenues(ownerId: string): Promise<void> {
  const { data, error } = await supabase
    .from('venues')
    .select('id')
    .eq('owner_id', ownerId)
    .not('deleted_at', 'is', null)

  if (error) throw new Error(describeError(error))

  for (const venue of data) {
    await removeVenueImages(venue.id)

    const { error: deleteError } = await supabase
      .from('venues')
      .delete()
      .eq('id', venue.id)
      .not('deleted_at', 'is', null)

    if (deleteError) throw new Error(describeError(deleteError))
  }
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
  if (RESERVED_SLUGS.has(slug)) {
    throw new Error(
      `L'adresse « ${slug} » est réservée par le back-office. Choisissez un autre nom.`,
    )
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

/** Ce qu'un gérant peut changer sur son établissement depuis l'écran de réglages. */
export type VenueSettings = {
  name: string
  description: string | null
  theme: MenuTheme
  /** Storage path of the logo, already uploaded — or `null` for no logo. */
  logoPath: string | null
  logoPlate: boolean
}

/**
 * Met à jour un établissement.
 *
 * **`slug` n'est jamais écrit, et ce n'est pas un oubli.** L'adresse publique
 * est ce qu'un QR code déjà imprimé et collé sur les tables encode, et
 * `m.$venueSlug.tsx` répond volontairement 404 sur une adresse inconnue : il
 * n'existe ni colonne d'alias ni table de redirection, donc un slug renommé
 * transformerait chaque code en salle en cul-de-sac. S'y ajoute que
 * `venues_slug_unique` ignore l'archivage — un renommage pourrait échouer
 * contre un établissement à la corbeille, que le gérant ne peut libérer qu'en
 * vidant celle-ci, la seule action irréversible de l'application. Changer
 * l'adresse publique demande d'abord une histoire de redirection ; le nom, lui,
 * se change librement.
 *
 * Le thème est vérifié ici plutôt que laissé à la contrainte : `describeError`
 * n'a aucun cas pour un `23514`, et la violation remonterait en anglais dans
 * une interface française.
 */
export async function updateVenue(
  venueId: string,
  settings: VenueSettings,
): Promise<void> {
  const name = settings.name.trim()
  if (!name) {
    throw new Error('Un établissement a besoin d’un nom.')
  }

  if (!MENU_THEMES.some((theme) => theme.id === settings.theme)) {
    throw new Error('Ce thème n’existe pas.')
  }

  const { data, error } = await supabase
    .from('venues')
    .update({
      name,
      /*
        Une description vide vaut `null`, jamais `''` : la carte publique teste
        `venue.description` pour décider d'afficher le paragraphe sous le nom,
        et une chaîne vide y ouvrirait un bloc sans texte.
      */
      description: settings.description?.trim() || null,
      theme: settings.theme,
      logo_path: settings.logoPath,
      /*
        No logo, no plate: the flag would otherwise survive a removed logo and
        resurface, already on, the day another is uploaded.
      */
      logo_plate: settings.logoPath ? settings.logoPlate : false,
    })
    .eq('id', venueId)
    /*
      The row is asked back, and its absence is the error. Under RLS a refused
      `update` is not a failure as far as PostgREST is concerned: it matches zero
      rows and answers 204, exactly like a successful one. Without this line a
      manager who does not own the venue — or whose session has gone stale —
      clicked « Enregistrer », watched nothing happen, and was told nothing.
      Same trap `removeVenueImages` documents for storage.
    */
    .select('id')

  if (error) throw new Error(describeError(error))

  if (data.length === 0) {
    throw new Error(
      'Ces réglages n’ont pas été enregistrés : cet établissement n’est pas rattaché à votre compte.',
    )
  }
}
