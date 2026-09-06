/**
 * Traduit une erreur PostgREST en message affichable.
 *
 * Ces codes viennent de Postgres et de PostgREST, pas d'un domaine
 * particulier : la fonction reste donc hors des features, faute de quoi
 * `venues` devrait importer chez `menu` pour lire un code `23505`.
 */
export function describeError(error: {
  code?: string
  message: string
}): string {
  switch (error.code) {
    case '23505':
      return 'Cet élément existe déjà.'
    case '42501':
      return "Vous n'avez pas les droits sur cet établissement."
    case 'PGRST202':
      /*
        PostgREST ne trouve pas la fonction appelée : elle manque, ou son cache
        de schéma n'a pas encore rechargé après une migration. Le message brut
        cite la signature SQL en anglais — acceptable dans une console, pas sur
        le téléphone d'un client à qui on vient de proposer un bouton.
      */
      return "Cette action n'est pas disponible pour le moment."
    case 'PGRST116':
      return 'Élément introuvable. Il a peut-être été supprimé entre-temps.'
    default:
      return error.message
  }
}
