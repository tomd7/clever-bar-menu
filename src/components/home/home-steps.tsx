import { PencilLine, QrCode, Smartphone } from 'lucide-react'

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

export function HomeSteps() {
  return (
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
          <step.icon className="size-5 text-bottle-deep" aria-hidden />
          <h2 className="display-title mt-3 text-lg leading-tight">
            {step.title}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            {step.body}
          </p>
        </article>
      ))}
    </section>
  )
}
