import { ArrowUpRight } from 'lucide-react'

import { CopyButton } from '#/components/buttons/copy-button'
import { ExternalNavLink } from '#/components/nav-link'
import { cn } from '#/lib/utils.ts'
import { publicMenuPath, publicMenuUrl } from '#/lib/public-menu-url'

/**
 * L'adresse publique d'un établissement, telle qu'elle s'emploie.
 *
 * Elle était affichée en `<code>` inerte à trois endroits du back-office : un
 * gérant qui voulait vérifier sa carte devait retaper l'adresse, et celui qui
 * voulait l'envoyer à un client la recopiait à la main. Deux gestes que la
 * ligne suggérait sans les permettre.
 *
 * Les deux gestes sont donc séparés, parce qu'ils ne mènent pas au même
 * endroit :
 *
 * - **le lien ouvre un nouvel onglet.** Le gérant regarde sa carte comme la
 *   voit un client, puis revient à son écran d'édition tel qu'il l'a laissé —
 *   naviguer sur place lui ferait perdre le formulaire en cours ;
 * - **la copie prend l'adresse absolue**, jamais le chemin affiché. `/m/x`
 *   collé dans un message ne mène nulle part.
 *
 * Le chemin reste ce qui est *écrit* : il tient sur une ligne d'une carte
 * d'établissement là où l'URL complète déborderait, et c'est la partie que le
 * gérant reconnaît.
 *
 * Composant de back-office : `window` y est toujours défini, ces écrans sont en
 * `ssr: false` — même raison que dans `VenueQr`.
 */
export function MenuAddress({
  slug,
  className,
}: {
  slug: string
  className?: string
}) {
  const path = publicMenuPath(slug)

  return (
    <span
      className={cn('inline-flex max-w-full items-center gap-1', className)}
    >
      <ExternalNavLink
        href={path}
        target="_blank"
        rel="noreferrer"
        title="Ouvrir la carte publique dans un nouvel onglet"
        className="min-w-0 gap-1.5 font-mono text-xs"
      >
        {/*
          Le nom d'un établissement va jusqu'à 80 caractères, et son slug
          suit : sur un téléphone, l'adresse d'un établissement au nom long
          pousserait la page en travers. Elle se replie plutôt, `break-all`
          parce qu'un chemin n'offre aucune césure naturelle. Tronquer
          l'aurait rendue plus nette et illisible.
        */}
        <span className="break-all">{path}</span>
        <ArrowUpRight className="size-3.5 shrink-0" aria-hidden />
      </ExternalNavLink>

      <CopyButton
        value={publicMenuUrl(window.location.origin, slug)}
        label="Copier l'adresse de la carte"
        copiedLabel="Adresse copiée"
      />
    </span>
  )
}
