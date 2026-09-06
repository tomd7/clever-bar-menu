/**
 * Les clés de requête qu'une feature doit invalider sans être celle qui les lit.
 *
 * La règle du projet est que la clé vit avec sa fonction de chargement.
 * Ce fichier est l'exception nommée, et `features/orders` est ce qui l'a
 * rendue nécessaire : cette feature écrit dans des tables qu'elle ne lit pas.
 *
 * - Accepter une commande décompte le stock, donc écrit dans `products`, donc
 *   périme la carte de `features/menu`.
 * - Ouvrir la prise de commande écrit `venues.orders_enabled`, donc périme la
 *   liste de `features/venues`.
 *
 * Dans les deux cas il faut invalider la requête d'une autre feature, ce qu'un
 * import entre features interdit. Suivant la règle qui a déjà envoyé
 * `describeError` et `publicMenuPath` ici — ce dont deux features ont besoin
 * n'appartient à aucune des deux — les clés descendent, et les
 * `queryOptions` qui les portaient les lisent d'ici.
 *
 * Y ajouter une clé demande donc de vérifier d'abord qu'elle est réellement
 * partagée : une clé qu'une seule feature invalide n'a rien à faire ici, elle
 * y perdrait le voisinage de la fonction qu'elle désigne. `PUBLIC_MENU_QUERY_KEY`
 * et `GUEST_ORDER_QUERY_KEY` sont restées chez elles pour cette raison.
 */

/**
 * La carte d'un établissement, back-office et écran de stock confondus.
 *
 * Le **préfixe**, pas la clé complète : `['menu', venueSlug]` est ce que lit
 * `menuQueryOptions`, et l'invalidation vise `['menu']` pour qu'aucun
 * composant n'ait besoin de connaître le slug — c'est ce qui a supprimé le
 * `onDone` qu'on faisait descendre à travers trois composants.
 */
export const MENU_QUERY_KEY = ['menu'] as const

/**
 * Les établissements d'un gérant.
 *
 * Même remarque sur le préfixe : la clé complète est `['venues', ownerId]`, et
 * `['venues', 'by-slug', slug]` pour la lecture unitaire. Viser `['venues']`
 * les recharge toutes les deux, ce qu'on veut — la colonne de gauche et
 * l'écran ouvert doivent dire la même chose.
 */
export const VENUES_QUERY_KEY = ['venues'] as const
