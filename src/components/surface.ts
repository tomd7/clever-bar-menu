/**
 * Hauteur d'un contrôle au repos, selon la surface qui le porte.
 *
 * Sur mobile, tout fait 44px — la cible tactile ne se négocie pas. C'est à
 * partir de `lg` que la densité se différencie : un formulaire de page respire,
 * une ligne de produit se resserre, un popover plus encore.
 *
 * Boutons et champs lisent la même table, et c'est le point : dans
 * « Nouvelle catégorie » un `Input` et un `AddButton` sont côte à côte sur la
 * même ligne. Deux valeurs entretenues séparément finiraient par diverger d'un
 * pixel, et la ligne serait de travers.
 */
export const SURFACE_HEIGHT = {
  page: 'lg:h-10',
  panel: 'lg:h-9',
  popover: 'lg:h-8',
}

export type Surface = keyof typeof SURFACE_HEIGHT
