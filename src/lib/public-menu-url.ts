/**
 * L'adresse de la carte publique d'un établissement.
 *
 * Elle appartient à aucun domaine : la carte client la porte sur un QR code,
 * le back-office l'affiche et la fait copier, le formulaire de création en
 * montre l'aperçu. C'est du routage, comme les codes d'erreur de PostgREST
 * sont de la persistance — d'où sa place ici plutôt que dans une feature, que
 * les deux autres devraient alors s'importer entre elles.
 */

/**
 * Le chemin, relatif à l'application.
 *
 * Suffisant pour un `href` : le navigateur le résout contre la page courante,
 * et l'écrire relatif évite qu'un lien du back-office parte vers l'origine de
 * production depuis un environnement de recette.
 */
export function publicMenuPath(venueSlug: string): string {
  return `/m/${venueSlug}`
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
export function publicMenuUrl(origin: string, venueSlug: string): string {
  return `${origin}${publicMenuPath(venueSlug)}`
}
