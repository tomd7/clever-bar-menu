/**
 * Conversion entre le prix saisi par le gérant et celui stocké en base.
 *
 * La base ne connaît que des centimes entiers (`products.price_cents`), jamais
 * de flottants : aucun arrondi ne peut ainsi se glisser dans un total. Le
 * gérant, lui, saisit des euros. Toute la traduction entre les deux vit ici.
 */

/** Erreur de saisie, destinée à être affichée telle quelle. */
export class PriceFormatError extends Error {}

/**
 * Convertit une saisie en euros vers des centimes.
 *
 * Accepte la virgule comme le point : sur un clavier français la virgule est la
 * touche naturelle, et refuser « 4,50 » serait absurde. Tous les espaces sont
 * retirés au passage : en JavaScript `\s` couvre aussi l'espace insécable et
 * l'insécable étroit, ceux que produit un copier-coller depuis un tableur.
 *
 * L'arrondi est délibérément absent : `Math.round(4.555 * 100)` donnerait un
 * résultat dépendant de la représentation binaire du flottant. On lit les
 * décimales comme du texte, ce qui rend la conversion exacte.
 */
export function parseEurosToCents(input: string): number {
  const cleaned = input.replace(/\s/g, '').replace(',', '.')

  if (!cleaned) {
    throw new PriceFormatError('Indiquez un prix.')
  }

  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(cleaned)
  if (!match) {
    throw new PriceFormatError(
      'Prix invalide. Utilisez un format comme 4,50 (deux décimales au maximum).',
    )
  }

  const [, whole, decimals = ''] = match
  const cents = Number(whole) * 100 + Number(decimals.padEnd(2, '0'))

  if (!Number.isSafeInteger(cents)) {
    throw new PriceFormatError('Ce prix est trop élevé.')
  }

  return cents
}

/**
 * Variante tolérante à l'absence de prix.
 *
 * Un champ vide vaut `null` — « pas de prix affiché » — et non zéro : un
 * article offert se saisit « 0 » et reste un prix parfaitement valide. Confondre
 * les deux afficherait « 0,00 € » sur un plat du jour.
 */
export function parseOptionalEurosToCents(input: string): number | null {
  return input.trim() ? parseEurosToCents(input) : null
}

/**
 * Rend des centimes sous la forme éditable d'un champ de saisie : « 450 » →
 * « 4.50 ». Sans symbole ni séparateur de milliers, contrairement à
 * `formatPrice` — un champ doit contenir ce que l'utilisateur pourrait taper.
 * Un prix absent donne un champ vide.
 */
export function centsToInput(cents: number | null): string {
  return cents === null ? '' : (cents / 100).toFixed(2)
}

/** Rend des centimes pour l'affichage : « 450 », « EUR » → « 4,50 € ». */
export function formatPrice(cents: number, currency: string): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
  }).format(cents / 100)
}
