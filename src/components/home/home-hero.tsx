import { Link } from '@tanstack/react-router'

import { ExternalNavLink } from '#/components/nav-link'

/** Accroche de la page d'accueil : ce que fait le produit, et par où entrer. */
export function HomeHero() {
  return (
    <section className="rise-in max-w-2xl">
      <p className="island-kicker">Carte digitale pour bars et cafés</p>
      {/*
        `text-balance` plutôt qu'un `<br>` en dur : Archivo est plus large que
        la Fraunces qu'elle remplace, et sur un écran de 390px la première
        ligne se coupait déjà d'elle-même — la coupure forcée ajoutait une
        troisième ligne où « bar, » restait seul. Le navigateur répartit les
        lignes à chaque largeur, ce qu'une coupure écrite à la main ne peut
        faire que pour une seule.
      */}
      <h1 className="display-title mt-3 text-4xl leading-[1.08] text-balance sm:text-5xl lg:text-6xl">
        La carte de votre bar, toujours à jour.
      </h1>
      <p className="mt-5 max-w-prose text-base leading-relaxed text-ink-soft sm:text-lg">
        Vos clients scannent le QR code posé sur la table et consultent la carte
        depuis leur téléphone. Vous la modifiez depuis votre back-office, elle
        change à l’instant.
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Link
          to="/login"
          /*
            Les classes sont ici et non dans un composant : c'est le seul lien
            dessiné en bouton de l'application, et cette page d'accueil est une
            vitrine provisoire. 44px de haut sur mobile — la cible tactile
            minimale ; le `scale` au maintien donne le retour immédiat qui fait
            qu'un bouton paraît écouter, en 150ms, sous le seuil où l'on perçoit
            un délai.
          */
          className="inline-flex min-h-11 items-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground no-underline transition-transform duration-150 ease-out active:scale-[0.97]"
        >
          Espace gérant
        </Link>
        <ExternalNavLink
          href="https://github.com/tomd7/clever-bar-menu"
          className="px-1 font-medium"
        >
          Voir le projet
        </ExternalNavLink>
      </div>
    </section>
  )
}
