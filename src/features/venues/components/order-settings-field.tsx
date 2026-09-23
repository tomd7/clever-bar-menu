import { Armchair } from 'lucide-react'

import { ChoiceField } from '#/components/form/choice-field'
import { NavLink } from '#/components/nav-link'

import type {
  FirstNameMode,
  OrderReference,
  OrderSettings,
  ServiceMode,
} from '#/lib/order-settings'
import type { ChoiceOption } from '#/components/form/choice-field'

const REFERENCE_OPTIONS: ReadonlyArray<ChoiceOption<OrderReference>> = [
  {
    value: 'name',
    label: 'Au prénom',
    hint: 'Le client donne son prénom, on l’appelle au comptoir.',
  },
  {
    value: 'table',
    label: 'Par table',
    hint: 'Chaque table a son QR code, et la commande part avec sa table.',
  },
]

const SERVICE_OPTIONS: ReadonlyArray<ChoiceOption<ServiceMode>> = [
  {
    value: 'counter',
    label: 'Au comptoir',
    hint: 'On appelle la table, le client vient chercher sa commande.',
  },
  {
    value: 'table',
    label: 'À table',
    hint: 'Le personnel apporte la commande à la table.',
  },
]

const FIRST_NAME_OPTIONS: ReadonlyArray<ChoiceOption<FirstNameMode>> = [
  {
    value: 'none',
    label: 'Pas demandé',
    hint: 'La table suffit à retrouver la commande.',
  },
  {
    value: 'optional',
    label: 'Facultatif',
    hint: 'Le client peut le donner, sans y être obligé.',
  },
]

/**
 * The « Commandes » panel of the settings screen: how a venue's orders are
 * identified, and — by table — how they are served and whether a first name is
 * still asked.
 *
 * **Configuration, not a daily gesture**, which is why it lives here and not
 * next to the open/closed switch of the orders screen: a bar decides once how
 * it works, and closes every night.
 *
 * The two table-only questions appear only once « Par table » is chosen. They
 * fade in rather than drop in: they answer the manager's own click, and a
 * block appearing with no transition under the finger reads as a glitch.
 *
 * The draft belongs to the form, like the theme's: nothing is written before
 * « Enregistrer », and the confirmation about open orders is the save bar's.
 */
export function OrderSettingsField({
  value,
  onChange,
  venueSlug,
  tablesCount,
}: {
  value: OrderSettings
  onChange: (value: OrderSettings) => void
  venueSlug: string
  /** `undefined` while the tables load. */
  tablesCount: number | undefined
}) {
  const byTable = value.reference === 'table'

  return (
    <>
      <h2 className="text-sm font-semibold">Commandes</h2>
      <p className="mt-1 text-xs text-ink-soft">
        Comment une commande est désignée, et comment elle arrive au client.
        L’ouverture du service, elle, reste sur l’écran des commandes.
      </p>

      <div className="mt-4 space-y-4">
        <ChoiceField
          legend="Référence d’une commande"
          options={REFERENCE_OPTIONS}
          value={value.reference}
          onChange={(reference) => onChange({ ...value, reference })}
        />

        {byTable ? (
          <div className="space-y-4 duration-200 ease-out animate-in fade-in-0">
            <ChoiceField
              legend="Service"
              options={SERVICE_OPTIONS}
              value={value.service}
              onChange={(service) => onChange({ ...value, service })}
            />
            <ChoiceField
              legend="Prénom du client"
              options={FIRST_NAME_OPTIONS}
              value={value.firstName}
              onChange={(firstName) => onChange({ ...value, firstName })}
            />
          </div>
        ) : null}
      </div>

      <div className="mt-4 border-t border-line-soft pt-3">
        {/*
          A link leaves the form: an unsaved choice is lost on the way. Said in
          the hint, because the tables are usually entered before switching, and
          the manager who has just clicked « Par table » is the one tempted.
        */}
        <NavLink
          to="/admin/$venueSlug/tables"
          params={{ venueSlug }}
          icon={Armchair}
          className="font-medium"
        >
          {tablesCount === undefined
            ? 'Gérer les tables'
            : tablesCount === 1
              ? 'Gérer les tables (1)'
              : `Gérer les tables (${tablesCount})`}
        </NavLink>

        {byTable && tablesCount === 0 ? (
          <p role="status" className="mt-1 text-xs text-destructive">
            Aucune table enregistrée : vos clients ne pourront pas commander
            tant que vous n’en aurez pas ajouté.
          </p>
        ) : (
          <p className="mt-1 text-xs text-ink-soft">
            Enregistrez d’abord vos réglages : quitter l’écran abandonne les
            modifications en cours.
          </p>
        )}
      </div>
    </>
  )
}
