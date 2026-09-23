/**
 * L'adresse de la carte publique d'un établissement.
 *
 * Elle appartient à aucun domaine : la carte client la porte sur un QR code,
 * le back-office l'affiche et la fait copier, le formulaire de création en
 * montre l'aperçu. C'est du routage, comme les codes d'erreur de PostgREST
 * sont de la persistance — d'où sa place ici plutôt que dans une feature, que
 * les deux autres devraient alors s'importer entre elles.
 *
 * **This file is the only place the URL shape is written**, table included:
 * `m.$venueSlug.tsx` reads the same `table` search parameter this file writes.
 */

/**
 * The search parameter a table's QR code carries. It holds the table's opaque
 * public id (`venue_tables.public_id`), never its number.
 */
export const TABLE_SEARCH_PARAM = 'table'

/**
 * Le chemin, relatif à l'application.
 *
 * Suffisant pour un `href` : le navigateur le résout contre la page courante,
 * et l'écrire relatif évite qu'un lien du back-office parte vers l'origine de
 * production depuis un environnement de recette.
 *
 * `tablePublicId` adds `?table=<id>` — the address one table's code encodes.
 */
export function publicMenuPath(
  venueSlug: string,
  tablePublicId?: string,
): string {
  const path = `/m/${venueSlug}`
  return tablePublicId
    ? `${path}?${TABLE_SEARCH_PARAM}=${encodeURIComponent(tablePublicId)}`
    : path
}

/**
 * La même adresse, absolue.
 *
 * C'est la forme qui se copie et celle qu'encode le QR code : les deux
 * atterrissent chez quelqu'un qui n'a aucun contexte de navigation — un
 * appareil qui scanne, une conversation où le lien est collé. `origin` est
 * passé plutôt que lu ici, pour que la fonction reste vérifiable sans
 * navigateur.
 */
export function publicMenuUrl(
  origin: string,
  venueSlug: string,
  tablePublicId?: string,
): string {
  return `${origin}${publicMenuPath(venueSlug, tablePublicId)}`
}
