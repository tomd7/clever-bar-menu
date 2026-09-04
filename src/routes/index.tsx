import { Link, createFileRoute } from '@tanstack/react-router'
import { PencilLine, QrCode, Smartphone } from 'lucide-react'

export const Route = createFileRoute('/')({ component: Home })

/**
 * Les trois temps du produit, dans l'ordre où ils se vivent : le gérant tient
 * sa carte à jour, le client scanne, la carte s'ouvre. L'ordre compte plus que
 * le contenu — c'est lui qui explique le produit sans paragraphe.
 */
const STEPS = [
  {
    icon: PencilLine,
    title: 'Vous tenez la carte',
    body: 'Catégories, produits, prix, ruptures. Une modification est en ligne aussitôt, sans réimpression.',
  },
  {
    icon: QrCode,
    title: 'Le QR code fait le lien',
    body: 'Un code par table renvoie vers la carte de votre établissement. Rien à installer côté client.',
  },
  {
    icon: Smartphone,
    title: 'La carte s’ouvre',
    body: 'Une page lisible sur téléphone, pensée pour une salle tamisée autant que pour une terrasse.',
  },
]

function Home() {
  return (
    <div className="flex min-h-dvh flex-col">
      <main className="page-wrap flex-1 py-12 sm:py-20">
        <section className="rise-in max-w-2xl">
          <p className="island-kicker">Carte digitale pour bars et cafés</p>
          <h1 className="display-title mt-3 text-4xl leading-[1.08] sm:text-5xl lg:text-6xl">
            La carte de votre bar,
            <br />
            toujours à jour.
          </h1>
          <p className="mt-5 max-w-prose text-base leading-relaxed text-ink-soft sm:text-lg">
            Vos clients scannent le QR code posé sur la table et consultent la
            carte depuis leur téléphone. Vous la modifiez depuis votre
            back-office, elle change à l’instant.
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

        <section className="mt-14 grid gap-4 sm:mt-20 sm:grid-cols-3">
          {STEPS.map((step, index) => (
            <article
              key={step.title}
              className="feature-card rise-in rounded-2xl border border-line p-5"
              /*
                Décalage de 70ms entre les cartes : assez pour lire une cascade,
                assez court pour que la dernière n'ait pas l'air en retard.
              */
              style={{ animationDelay: `${120 + index * 70}ms` }}
            >
              <step.icon className="size-5 text-brass-deep" aria-hidden />
              <h2 className="display-title mt-3 text-lg leading-tight">
                {step.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                {step.body}
              </p>
            </article>
          ))}
        </section>
      </main>

      <footer className="site-footer">
        <div className="page-wrap flex flex-col gap-1 py-6 text-xs text-ink-soft sm:flex-row sm:items-center sm:justify-between">
          <p>Clever Bar Menu</p>
          <p>Projet en cours de développement.</p>
        </div>
      </footer>
    </div>
  )
}
