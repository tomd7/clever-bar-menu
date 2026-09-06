import { AddVenueForm } from '#/features/venues/components/add-venue-form'
import { VenueList } from '#/features/venues/components/venue-list'
import { VenueTrashLink } from '#/features/venues/components/venue-trash-link'

/** Écran d'accueil du back-office : les établissements du gérant connecté. */
export function VenuesPage({ ownerId }: { ownerId: string }) {
  return (
    <div className="page-wrap px-0">
      <header>
        <p className="island-kicker">Vos établissements</p>

        {/*
          La corbeille est en tête et non en pied de liste : un gérant qui la
          cherche vient de supprimer quelque chose, et la lui faire trouver au
          bout de la grille lui impose de faire défiler tout ce qui est encore
          en service. `items-baseline` la pose sur la ligne du titre ; sur
          téléphone elle passe à la ligne, où ses 44px de cible retombent.
        */}
        <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <h1 className="display-title text-2xl leading-tight sm:text-3xl">
            Établissements
          </h1>
          <VenueTrashLink ownerId={ownerId} />
        </div>
        <p className="mt-2 max-w-prose text-sm text-ink-soft">
          Chaque établissement porte sa propre carte et sa propre adresse
          publique.
        </p>
      </header>

      <AddVenueForm />

      <section className="mt-6">
        <VenueList ownerId={ownerId} />
      </section>
    </div>
  )
}
