import { createLink } from '@tanstack/react-router'

import { cn } from '#/lib/utils.ts'

import type { ComponentProps } from 'react'
import type { LinkComponent } from '@tanstack/react-router'
import type { LucideIcon } from 'lucide-react'

/**
 * Lien de navigation textuel.
 *
 * `.nav-link` — dans `nav-link.css`, juste à côté — porte l'identité visuelle :
 * couleur, 44px de cible tactile, soulignement qui pousse depuis la gauche. Ce
 * composant porte ce qui ne peut pas vivre dans une feuille de style : la mise
 * en ligne du libellé avec son icône, et le typage de la destination.
 *
 * Volontairement **sans `activeProps` par défaut**. Le routeur considère un
 * lien actif dès que l'URL courante commence par sa cible : un retour vers
 * `/admin` serait donc marqué actif depuis `/admin/le-comptoir`, et resterait
 * souligné en permanence. Un lien de retour n'a jamais à se désigner comme la
 * page courante ; celui qui le veut le demande explicitement.
 *
 * Ce composant est celui des liens **en ligne dans le contenu**. La colonne du
 * back-office n'en est pas : ses éléments passent par `.rail-link`
 * (`features/venues/components/venue-nav.css`), parce que le soulignement posé
 * 8px sous la boîte tomberait dans l'élément suivant d'une liste verticale.
 */
function BaseNavLink({
  icon: Icon,
  className,
  children,
  ...props
}: { icon?: LucideIcon } & ComponentProps<'a'>) {
  return (
    <a
      className={cn(
        'nav-link inline-flex items-center gap-2 text-sm no-underline',
        className,
      )}
      {...props}
    >
      {Icon ? <Icon className="size-4" /> : null}
      {children}
    </a>
  )
}

const CreatedNavLink = createLink(BaseNavLink)

/** Navigation interne. `to` reste inféré depuis l'arbre des routes. */
export const NavLink: LinkComponent<typeof BaseNavLink> = (props) => (
  <CreatedNavLink {...props} />
)

/**
 * Même lien, vers l'extérieur.
 *
 * C'est le composant de base réexporté, pas une seconde implémentation : les
 * liens sortants prennent un `href` et n'ont rien à faire du routeur, mais ils
 * doivent se ressembler au pixel près.
 */
export { BaseNavLink as ExternalNavLink }
