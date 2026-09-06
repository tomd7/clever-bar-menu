/**
 * Rendre une somme lisible.
 *
 * Une devise n'appartient à aucun domaine : la carte affiche des prix, le
 * panier un total, la commande une addition — et la commande ne peut pas
 * importer chez la carte. La fonction descend donc ici, pour la même raison
 * que `describeError` et `publicMenuPath` avant elle.
 *
 * **La saisie, elle, reste dans `features/menu/price.ts`.** Convertir « 4,50 »
 * en centimes est le geste d'un gérant qui tarife sa carte, et d'un seul
 * écran ; l'afficher est le geste de tout le monde. Les deux moitiés de
 * l'ancien module n'avaient pas la même portée, c'est la seule raison pour
 * laquelle elles se séparent.
 */

/** Rend des centimes pour l'affichage : « 450 », « EUR » → « 4,50 € ». */
export function formatPrice(cents: number, currency: string): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
  }).format(cents / 100)
}
