import { useEffect, useRef, useState } from 'react'

import type { CategoryWithProducts } from '#/features/menu/api'

/** Ancre d'une section de la carte. Partagée avec `PublicMenu`, qui la pose. */
export function sectionId(categoryId: string): string {
  return `carte-${categoryId}`
}

/**
 * Sommaire collant de la carte client.
 *
 * Une carte de six sections se parcourt en faisant défiler jusqu'à trouver la
 * bonne — le client qui cherche les digestifs traverse les bières. Ce rail lui
 * donne les sections d'un coup d'œil et l'y emmène, puis reste en haut de
 * l'écran pendant la lecture pour dire où il se trouve.
 *
 * Il ne s'affiche qu'à partir de trois sections : sur une carte qui en compte
 * deux, tout tient déjà dans un écran et le rail ne serait qu'un bandeau de
 * plus à faire défiler. C'est `PublicMenu` qui applique ce seuil.
 *
 * Le surlignement suit le défilement plutôt que le clic : un client peut très
 * bien faire défiler à la main, et un rail qui désignerait encore la section
 * cliquée dix écrans plus bas mentirait. `IntersectionObserver` plutôt qu'un
 * écouteur de `scroll` — le navigateur fait le calcul hors du fil principal,
 * là où un `getBoundingClientRect()` par section et par image saccaderait sur
 * un téléphone d'entrée de gamme.
 */
export function MenuNav({
  categories,
}: {
  categories: Array<CategoryWithProducts>
}) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const visibleRef = useRef(new Set<string>())

  useEffect(() => {
    const visible = visibleRef.current
    visible.clear()

    const observed = categories
      .map((category) => document.getElementById(sectionId(category.id)))
      .filter((element): element is HTMLElement => element !== null)

    if (observed.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.id
          if (entry.isIntersecting) visible.add(id)
          else visible.delete(id)
        }

        /*
          La première section visible dans l'ordre du document, et non la plus
          grande ou la dernière signalée : c'est celle qu'on est en train de
          lire quand deux se chevauchent à la charnière.
        */
        const current = categories.find((category) =>
          visible.has(sectionId(category.id)),
        )
        setActiveId(current ? current.id : null)
      },
      /*
        Une bande étroite sous le rail plutôt que le viewport entier : sans
        elle, une section haute de trois écrans resterait « visible » bien
        après qu'on l'a quittée, et deux sections courtes seraient actives en
        même temps.
      */
      { rootMargin: '-25% 0px -65% 0px' },
    )

    observed.forEach((element) => observer.observe(element))
    return () => observer.disconnect()
  }, [categories])

  return (
    <nav
      aria-label="Sections de la carte"
      /*
        Opaque et non translucide : le texte qui défile dessous doit
        disparaître, pas transparaître. Les marges négatives font toucher le
        fond aux bords de l'écran là où le contenu reste dans sa colonne.
      */
      className="sticky top-0 z-10 -mx-4 mt-8 border-b border-line bg-ground px-4 py-2 sm:-mx-6 sm:px-6"
    >
      <ul className="scrollbar-none flex gap-2 overflow-x-auto">
        {categories.map((category) => {
          const isActive = category.id === activeId

          return (
            <li key={category.id}>
              <a
                href={`#${sectionId(category.id)}`}
                aria-current={isActive ? 'true' : undefined}
                className={
                  isActive
                    ? 'flex min-h-11 items-center rounded-full border border-bottle bg-bottle px-4 text-sm font-semibold whitespace-nowrap text-on-bottle no-underline'
                    : 'flex min-h-11 items-center rounded-full border border-line bg-surface px-4 text-sm font-medium whitespace-nowrap text-ink-soft no-underline'
                }
              >
                {category.name}
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
