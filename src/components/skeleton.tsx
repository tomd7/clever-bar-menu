import { cn } from '#/lib/utils.ts'

import type { ReactNode } from 'react'

/**
 * Une barre de l'ossature de chargement.
 *
 * Elle ne porte aucune dimension : c'est l'écran qui l'appelle qui les donne,
 * parce que c'est lui qui sait ce qui va s'afficher là. Une barre de titre fait
 * `h-6 w-48`, une ligne de prix `h-4 w-12` — l'ossature est utile dans la
 * mesure exacte où elle ressemble à ce qu'elle remplace.
 *
 * Les défauts passent par `cn` et non par `skeleton.css` : `tailwind-merge`
 * laisse alors un `rounded-full` de l'appelant l'emporter sur le `rounded-md`
 * d'ici, ce qu'une règle CSS hors `@layer` — comme toutes celles de ce projet —
 * aurait empêché.
 *
 * `delay` décale l'écriture du trait, pas le reflet : les traits s'écrivent
 * l'un après l'autre, le reflet traverse l'écran d'une seule vague.
 */
export function Skeleton({
  className,
  delay = 0,
}: {
  className?: string
  delay?: number
}) {
  return (
    <span
      /*
        `aria-hidden` : la barre n'est qu'une forme. L'attente est annoncée une
        seule fois, par le `role="status"` de `SkeletonScreen` — une ossature
        d'une trentaine de barres, chacune signalée, serait illisible au lecteur
        d'écran.
      */
      aria-hidden
      className={cn('skeleton block rounded-md bg-skeleton', className)}
      style={{ animationDelay: `${delay}ms` }}
    />
  )
}

/**
 * L'enveloppe d'une ossature : ce qui l'annonce, et ce qui retarde sa venue.
 *
 * `role="status"` avec `aria-live="polite"` plutôt qu'un texte visible : le
 * message part au lecteur d'écran sans rien enlever à la place réservée à
 * l'écran qui arrive. `aria-busy` le redit au niveau du conteneur, pour les
 * technologies qui l'exposent.
 *
 * Deux éléments et non un seul : le libellé est le frère de la mise en page,
 * pas son premier enfant. Glissé dedans, il compterait comme tel — `divide-y`
 * poserait un filet au-dessus de la première ligne, et une grille lui
 * réserverait une case. Il est en `sr-only`, donc en `position: absolute`, mais
 * les sélecteurs de fratrie, eux, le voient très bien.
 */
export function SkeletonScreen({
  label = 'Chargement…',
  className,
  children,
}: {
  label?: string
  className?: string
  children: ReactNode
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className="skeleton-screen"
    >
      <span className="sr-only">{label}</span>
      <div className={className}>{children}</div>
    </div>
  )
}

/**
 * L'en-tête d'un écran du back-office : le libellé de section et le titre.
 *
 * Les trois écrans d'un établissement — carte, stock, QR code — ouvrent sur ces
 * deux lignes-là, au même endroit et aux mêmes dimensions ; passer de l'un à
 * l'autre ne doit pas donner trois attentes différentes. Ce qui les distingue
 * — l'adresse publique, une phrase, deux — vient en `children`, parce que c'est
 * précisément là qu'ils cessent de se ressembler.
 *
 * `h-[1lh]` et non une hauteur en pixels : l'unité `lh` vaut l'interligne
 * calculé de l'élément, donc la barre porte exactement la hauteur de la ligne
 * qu'elle remplace — y compris quand le titre passe de `text-2xl` à
 * `text-3xl` au point d'arrêt `sm`. Une valeur en dur aurait été juste sur un
 * seul des deux, et l'écran aurait sauté sur l'autre.
 */
export function SkeletonHeader({ children }: { children?: ReactNode }) {
  return (
    <div className="mt-2 lg:mt-0">
      <Skeleton className="h-[1lh] w-24 rounded-full text-[13px]/[1.5]" />
      <Skeleton
        className="mt-1 h-[1lh] w-56 max-w-full text-2xl leading-tight sm:text-3xl"
        delay={60}
      />
      {children}
    </div>
  )
}

/**
 * L'adresse publique sous le titre — un `<code>` et le bouton qui le copie.
 *
 * Le conteneur garde le `h-11` du bouton : c'est lui qui fait la hauteur du
 * bloc, bien plus que la ligne de texte à côté.
 */
export function SkeletonAddress({ delay = 0 }: { delay?: number }) {
  return (
    <div className="mt-1 flex h-11 items-center gap-2">
      <Skeleton className="h-3.5 w-36 rounded-full" delay={delay} />
      <Skeleton className="size-9" delay={delay + 25} />
    </div>
  )
}

/**
 * Une ligne de texte courant sous l'en-tête — la phrase qui explique l'écran.
 *
 * `text-sm` sur la barre elle-même : c'est ce qui donne son `1lh`.
 */
export function SkeletonLine({
  className,
  delay = 0,
}: {
  className?: string
  delay?: number
}) {
  return (
    <Skeleton
      className={cn('h-[1lh] rounded-full text-sm', className)}
      delay={delay}
    />
  )
}
