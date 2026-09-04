import { Link } from '@tanstack/react-router'

/** Accroche de la page d'accueil : ce que fait le produit, et par où entrer. */
export function HomeHero() {
  return (
    <section className="rise-in max-w-2xl">
      <p className="island-kicker">Carte digitale pour bars et cafés</p>
      <h1 className="display-title mt-3 text-4xl leading-[1.08] sm:text-5xl lg:text-6xl">
        La carte de votre bar,
        <br />
        toujours à jour.
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
            44px de haut sur mobile : la cible tactile minimale. Le `scale`
            au maintien donne le retour immédiat qui fait qu'un bouton
            paraît écouter — 150ms, sous le seuil où l'on perçoit un délai.
          */
          className="inline-flex min-h-11 items-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground no-underline transition-transform duration-150 ease-out active:scale-[0.97]"
        >
          Espace gérant
        </Link>
        <a
          href="https://github.com/tomd7/clever-bar-menu"
          className="nav-link inline-flex min-h-11 items-center px-1 text-sm font-medium"
        >
          Voir le projet
        </a>
      </div>
    </section>
  )
}
