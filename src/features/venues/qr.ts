import { renderSVG } from 'uqr'

/**
 * QR code menant à la carte publique d'un établissement.
 *
 * Le SVG plutôt que le PNG : l'image finit imprimée sur un chevalet ou un
 * autocollant, à une taille que le gérant choisit. Un vecteur reste net à
 * 3 cm comme à 15 ; un bitmap oblige à deviner la résolution à l'avance.
 */

/**
 * Niveau de correction d'erreur.
 *
 * `Q` est un cran au-dessus du défaut parce que l'objet est physique : il sera
 * mouillé, rayé, à moitié caché par un verre ou un sous-bock.
 *
 * Le barème annonce 25 % des mots de code récupérables ; mesuré avec le
 * décodeur de Chrome sur une tache opaque d'un seul tenant, ce code se lit
 * jusqu'à **15 % de sa surface masquée** et échoue à 20 %. Une tache continue
 * est plus difficile à corriger qu'un bruit réparti — c'est la valeur à retenir
 * pour juger de la marge réelle.
 *
 * Le surcoût est modeste : pour une URL de cette longueur, la matrice passe de
 * 29×29 modules en `L` à 37×37 en `Q`, soit environ 1,35 mm par module sur un
 * code imprimé à 5 cm, très au-dessus du seuil de lecture d'un téléphone.
 */
const ERROR_CORRECTION = 'Q' as const

/**
 * Marge blanche autour du code, en modules. La norme en demande 4.
 *
 * À noter pour qui relit `encode` : la `size` que renvoie uqr **inclut** cette
 * marge. Un code de 37 modules avec cette valeur mesure donc 45 de côté.
 */
const QUIET_ZONE = 4

/**
 * URL absolue de la carte publique.
 *
 * Absolue et non relative : un QR code est scanné par un appareil qui n'a
 * aucun contexte de navigation. `origin` est passé plutôt que lu ici, pour que
 * la fonction reste vérifiable sans navigateur.
 */
export function publicMenuUrl(origin: string, venueSlug: string): string {
  return `${origin}/m/${venueSlug}`
}

/**
 * Rend le QR code en SVG.
 *
 * La chaîne est ensuite injectée telle quelle dans le document. C'est sans
 * risque : `renderSVG` ne produit que des `path` géométriques, et l'URL n'y
 * figure jamais comme texte — elle est encodée dans la disposition des
 * modules. Rien de ce que saisit un gérant ne se retrouve dans ce balisage.
 */
export function venueQrSvg(url: string): string {
  return renderSVG(url, {
    ecc: ERROR_CORRECTION,
    border: QUIET_ZONE,
    /*
      Noir sur blanc franc, quelle que soit la palette de l'application. Un
      lecteur de QR s'appuie sur le contraste : le teinter aux couleurs du
      thème dégraderait la lecture pour un gain purement décoratif, sur un
      objet que le client ne regarde qu'une seconde.
    */
    blackColor: '#000000',
    whiteColor: '#ffffff',
  })
}

/**
 * Signale une origine qui n'a de sens que sur la machine du développeur.
 *
 * Un QR code généré depuis `localhost` encode `localhost` : imprimé et collé
 * sur les tables, il ne mène nulle part, et rien à l'écran ne le laisse
 * deviner — le code est visuellement identique à un code valide. Le seul
 * moment où l'erreur se rattrape est avant l'impression.
 */
export function isLocalOrigin(origin: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|$)/.test(origin)
}
