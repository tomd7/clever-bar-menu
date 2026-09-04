/**
 * Teinte d'un bouton dont l'action retire quelque chose.
 *
 * Distincte de `variant="destructive"`, qui donne un aplat rouge : celui-ci
 * porte l'action principale d'une confirmation, quand cette teinte-ci habille
 * un bouton de second plan — une corbeille dans une ligne, un « Retirer » dans
 * un formulaire. Le texte est coloré, le fond ne s'affirme qu'au survol.
 *
 * Une seule définition parce que `IconButton` et `ActionButton` la portent tous
 * les deux. Recopiée, elle divergerait au premier ajustement de la palette —
 * et la divergence ne se verrait que sur l'un des deux boutons.
 */
export const DESTRUCTIVE_TONE =
  'text-destructive hover:bg-destructive/10 hover:text-destructive'

export type Tone = 'default' | 'destructive'
