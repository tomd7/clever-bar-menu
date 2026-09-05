# Clever Bar Menu

Une carte digitale pour les bars et cafés : les clients scannent un QR code posé sur la table
et consultent la carte à jour depuis leur téléphone, sans application à installer. Le gérant
gère ses catégories, ses produits et ses prix depuis un back-office.

![Status](https://img.shields.io/badge/status-work%20in%20progress-orange)

> [!WARNING]
> **Projet en cours de démarrage.** Les bases techniques sont posées, mais les
> fonctionnalités décrites ci-dessous sont encore en développement. Le schéma de données
> et les URLs ne sont pas figés : n'utilisez pas encore ce projet en production.

## Fonctionnalités

- **Carte publique via QR code** — chaque table renvoie vers la carte de l'établissement,
  consultable sur mobile, sans installation ni compte.
- **Back-office de gestion** — création et édition des catégories, produits, prix,
  descriptions et photos ; un produit en rupture peut être masqué en un clic.
- **Suivi de stock** — activable produit par produit, avec un seuil d'alerte et une page
  faite pour être tenue debout derrière le bar. Un produit épuisé quitte la carte des
  clients et y revient de lui-même au réapprovisionnement.
- **Multi-établissements** — un même déploiement héberge plusieurs bars. Un gérant en
  possède autant qu'il veut, chacun avec sa carte, son adresse publique et son QR code.
  L'isolation est portée par Postgres : un gérant ne voit et ne modifie que ses
  établissements. Un établissement a en revanche **un seul propriétaire** — plusieurs
  comptes sur un même bar restent à faire.
- **Multilingue et thème clair/sombre** — carte traduisible et apparence personnalisable
  par établissement. Le thème « bar du soir » est en place : il suit le réglage clair/sombre
  du téléphone qui scanne le QR code, sans interrupteur ni cookie.

## Stack technique

| Domaine      | Choix                                                                                  |
| ------------ | -------------------------------------------------------------------------------------- |
| Framework    | [TanStack Start](https://tanstack.com/start) (SSR) + [React 19](https://react.dev)     |
| Routing      | [TanStack Router](https://tanstack.com/router) (routes générées depuis `src/routes/`)  |
| Cache client | [TanStack Query](https://tanstack.com/query)                                           |
| Formulaires  | [TanStack Form](https://tanstack.com/form) + [Zod](https://zod.dev)                    |
| Persistance  | [Supabase](https://supabase.com) (Postgres) + [Drizzle ORM](https://orm.drizzle.team)  |
| UI           | [Tailwind CSS 4](https://tailwindcss.com) + [shadcn/ui](https://ui.shadcn.com) (Radix) |
| Build        | [Vite 8](https://vite.dev)                                                             |
| Serveur      | [Nitro](https://nitro.build)                                                           |
| Langage      | TypeScript                                                                             |

> [!NOTE]
> La persistance est assurée par un Postgres hébergé sur Supabase, interrogé via Drizzle.
> Supabase a été retenu parce qu'il couvre aussi l'authentification du back-office et le
> stockage des photos produits, deux besoins de la roadmap. Les requêtes passent par Drizzle
> et non par `supabase-js` : le jour où seule la base doit déménager, c'est du Postgres
> standard.

## Démarrage

Prérequis : **Node.js 22+**.

```bash
git clone https://github.com/tomd7/clever-bar-menu.git
cd clever-bar-menu
npm install
npm run dev
```

L'application est servie sur http://localhost:3000.

### Variables d'environnement

Les variables sont validées au démarrage par [`@t3-oss/env-core`](https://env.t3.gg) dans
[`src/env.ts`](src/env.ts) — un démarrage échoue plutôt que de laisser passer une
configuration incomplète. Créez un fichier `.env` à la racine :

Le fichier [`.env.example`](.env.example) liste les variables attendues :

```bash
# Côté serveur — src/env.server.ts
DATABASE_URL=            # requis : connexion Postgres Supabase (pooler transaction, 6543)
MIGRATION_DATABASE_URL=  # optionnel : connexion dédiée aux migrations (voir ci-dessous)

# Côté client (préfixe VITE_ obligatoire) — src/env.ts
VITE_APP_TITLE=          # requis : nom du produit (onglet, pied de page, back-office)
VITE_SUPABASE_URL=       # requis : https://<ref>.supabase.co
VITE_SUPABASE_ANON_KEY=  # requis : clé publiable (sb_publishable_...)
```

La clé publiable est **publique par conception** : elle est servie au navigateur et figure
dans le bundle. Ce n'est pas elle qui protège les données, c'est le RLS (voir ci-dessous).
La clé secrète (`sb_secret_…`), elle, ne doit jamais porter le préfixe `VITE_`.

Les variables serveur et client sont validées séparément, parce qu'elles ne viennent pas de
la même source : le client lit `import.meta.env`, qui n'expose que le préfixe `VITE_`. Une
variable serveur déclarée côté client vaudrait silencieusement `undefined`.

### Base de données

Créez un projet sur [supabase.com](https://supabase.com), puis récupérez la chaîne de
connexion dans **Project Settings → Database → Connection string**. Le dashboard en propose
trois, qui ne sont pas interchangeables :

| Chaîne             | Port | Réseau        | Usage                                         |
| ------------------ | ---- | ------------- | --------------------------------------------- |
| Transaction pooler | 6543 | IPv4          | **L'application** — c'est `DATABASE_URL`      |
| Session pooler     | 5432 | IPv4          | Les migrations, si le pooler transaction cale |
| Direct connection  | 5432 | **IPv6 seul** | À éviter : échoue sans IPv6, erreur obscure   |

L'application vise le pooler en mode transaction parce qu'en serverless chaque instance
ouvre sa propre connexion : des connexions Postgres directes épuiseraient la base bien
avant que le trafic ne devienne intéressant. En contrepartie ce mode interdit les
instructions préparées, d'où le `prepare: false` dans `src/db/client.server.ts`.

Renseignez `DATABASE_URL`, puis appliquez les migrations :

```bash
npm run db:migrate
```

Les migrations sont du DDL et se comportent mal à travers un pooler en mode transaction. Si
`db:migrate` échoue, renseignez `MIGRATION_DATABASE_URL` avec la chaîne **session pooler**
(port 5432) : seules les migrations l'emprunteront, la connexion applicative ne change pas.

#### Sécurité des données (RLS)

Supabase expose automatiquement le schéma `public` via PostgREST et accorde des droits aux
rôles `anon` et `authenticated`. **Une table sans Row Level Security y est donc lisible _et
modifiable_ par quiconque possède la clé publiable** — laquelle est, par construction, dans
le bundle navigateur.

Le RLS est donc activé sur les trois tables, avec des policies déclarées directement dans
[`src/db/schema.ts`](src/db/schema.ts) pour que le schéma reste la source de vérité :

- **lecture publique** sur `venues`, `categories` et `products` — c'est l'intérêt même du QR
  code : consulter la carte sans compte ;
- **aucune policy d'écriture**, donc aucune écriture possible avec la clé publiable.

Les écritures du back-office sont autorisées par des policies restreintes au propriétaire
(`auth.uid() = owner_id`, et par jointure sur l'établissement pour les catégories et les
produits). L'isolation entre établissements est donc portée par Postgres : un bug applicatif
ne peut pas exposer la carte d'un autre bar.

Drizzle, lui, se connecte en propriétaire de la base et **contourne** le RLS. Il ne sert plus
qu'aux migrations : aucune requête applicative ne passe par lui.

## Scripts

| Commande                  | Rôle                                                 |
| ------------------------- | ---------------------------------------------------- |
| `npm run dev`             | Serveur de développement sur le port 3000            |
| `npm run build`           | Build de production                                  |
| `npm run preview`         | Prévisualisation du build                            |
| `npm run generate-routes` | Régénère `src/routeTree.gen.ts` depuis `src/routes/` |
| `npm run db:generate`     | Génère une migration SQL depuis `src/db/schema.ts`   |
| `npm run db:migrate`      | Applique les migrations en attente                   |
| `npm run db:studio`       | Ouvre Drizzle Studio sur la base                     |
| `npm run lint`            | ESLint                                               |
| `npm run format`          | Prettier `--write` puis `eslint --fix`               |
| `npm run check`           | Vérifie le formatage sans modifier les fichiers      |

## Back-office

Le back-office vit sous `/admin`, derrière une authentification Supabase (e-mail + mot de
passe). L'accès aux données se fait **depuis le navigateur** via `supabase-js`, et c'est le
RLS qui garantit qu'un gérant ne voit que ses établissements.

Les routes du back-office sont en `ssr: false` : la session Supabase est conservée dans le
navigateur, donc l'évaluer pendant le rendu serveur conclurait « non connecté » à chaque
requête. La carte publique, elle, est en SSR — c'est une page scannée au QR code, sa vitesse de
premier affichage compte.

| Route                     | Rôle                                                       |
| ------------------------- | ---------------------------------------------------------- |
| `/login`                  | Connexion                                                  |
| `/admin`                  | Liste des établissements du gérant, et création            |
| `/admin/$venueSlug`       | Édition de la carte : catégories, produits, prix, ruptures |
| `/admin/$venueSlug/stock` | Suivi de stock : niveaux, alertes, décompte                |
| `/admin/$venueSlug/qr`    | Feuille de QR code à imprimer                              |
| `/m/$venueSlug`           | **Carte publique** — la page que vise le QR code           |

Les prix sont saisis en euros et stockés en **centimes entiers**
([`src/features/menu/price.ts`](src/features/menu/price.ts)) : la saisie accepte la virgule comme le point, et
les décimales sont lues comme du texte plutôt que multipliées en flottant — `1,10 * 100`
vaut `110.00000000000001` en JavaScript.

Les **photos** sont déposées dans le bucket Supabase Storage `product-photos`, public en
lecture (la carte se charge au QR code, une URL publique passe par le CDN) mais dont
l'écriture est réservée au propriétaire de l'établissement. Elles sont réduites dans le
navigateur avant l'envoi — 1200 px de côté au maximum, en WebP.

Le prix est **facultatif** : un champ laissé vide vaut « pas de prix affiché », pour un plat
du jour ou un tarif selon arrivage. C'est distinct de `0`, qui reste un prix valide pour un
article offert.

L'ordre des catégories et des produits est porté par une colonne `position`, avançant de 100
en 100 pour permettre d'insérer entre deux voisines sans réécrire la liste. Un produit en
rupture reste dans la carte du gérant, barré, et sera masqué côté client.

### Suivi de stock

Le suivi s'active **produit par produit**, en renseignant un stock restant sur sa fiche. Un
champ laissé vide veut dire « pas de suivi », et c'est le cas normal : un café ou une
pression au fût ne se comptent pas à l'échelle d'un service. Un seuil d'alerte facultatif
signale un stock bas avant l'épuisement.

`/admin/$venueSlug/stock` regroupe les produits suivis, dans l'ordre de la carte, avec un
compteur par ligne : « −1 » pendant le service, la saisie du niveau à la livraison. Un
bandeau en tête donne les raccourcis vers ce qui demande une intervention. La liste, elle,
ne se réordonne jamais — trier par urgence ferait remonter une ligne à l'instant où le doigt
appuie sur son « −1 ».

Deux points de conception valent d'être connus :

- **La rupture par épuisement est déduite, jamais écrite.** `is_available` reste le geste
  manuel du gérant ; un stock à zéro masque le produit de la carte publique par un filtre de
  requête, et le réapprovisionnement le fait réapparaître sans intervention. Basculer
  vraiment la colonne obligerait à réactiver chaque produit à la main après une livraison,
  et écraserait au passage une décision prise pour une tout autre raison.
- **Le décompte passe par une fonction Postgres**, `adjust_product_stock` (migration
  `0007`). PostgREST ne sait pas écrire `stock_quantity = stock_quantity - 1` : sans elle, le
  navigateur devrait lire puis écrire, et deux appareils derrière le même bar perdraient un
  décompte sur deux. C'est aussi le point d'accroche prévu pour la commande à table.

### Création des comptes

**Il n'y a pas d'inscription libre.** Les accès sont créés par l'administrateur de la
plateforme depuis **Authentication → Users → Add user** dans le tableau de bord Supabase
(cochez _Auto Confirm User_, sinon le gérant devra confirmer son adresse avant de pouvoir se
connecter).

> [!IMPORTANT]
> Retirer le formulaire d'inscription de l'interface ne ferme rien. L'endpoint
> `/auth/v1/signup` reste joignable directement avec la clé publiable, qui est par
> conception présente dans le bundle navigateur. Ce qui ferme réellement l'inscription est
> le réglage **Authentication → Sign In / Providers → Allow new users to sign up**, à
> désactiver dans le tableau de bord.
>
> Pour vérifier l'état réel du projet, sans rien modifier :
>
> ```bash
> curl -s "$VITE_SUPABASE_URL/auth/v1/settings" -H "apikey: $VITE_SUPABASE_ANON_KEY"
> ```
>
> `disable_signup` doit valoir `true`.

## Supprimer un établissement

La suppression est **logique** : la ligne reste en base avec sa carte, ses photos et son
slug, marquée par une date dans `deleted_at`. L'établissement part dans une **corbeille**
d'où il peut être restauré tel qu'il était.

Ce que garantit Postgres, et pas seulement le code :

- **La carte publique d'un établissement supprimé ne répond plus** — la policy de lecture
  publique exige `deleted_at is null`, donc `/m/<slug>` renvoie un 404 même si une requête
  oubliait le filtre.
- **Son propriétaire continue de le voir**, grâce à une seconde policy de lecture. Sans elle,
  supprimer un établissement le rendrait invisible à son propre gérant, donc impossible à
  restaurer.
- **Les autres gérants ne le voient pas**, ni ne peuvent le restaurer.

> [!NOTE]
> Le slug reste réservé tant que l'établissement est à la corbeille : `venues_slug_unique`
> ignore l'archivage. Une contrainte partielle libérerait l'adresse, au prix d'une
> restauration qui échouerait si le nom a été repris entre-temps.

## QR code

`/admin/<slug>/qr` produit le code à imprimer et à poser sur les tables. Il encode l'URL
publique de la carte, et c'est **un seul code pour tout l'établissement** : la carte est
identique à chaque table, distinguer les tables n'apporterait rien tant qu'aucune
fonctionnalité ne lit ce numéro.

- **Sortie SVG**, pas PNG : le code finit imprimé à une taille choisie par le gérant, d'un
  sous-bock à une affiche. Un vecteur reste net partout.
- **Correction d'erreur `Q`**, un cran au-dessus du défaut, parce que l'objet est physique.
  Mesuré avec le décodeur de Chrome : le code reste lisible jusqu'à **15 % de sa surface
  masquée** par une tache opaque, et échoue à 20 %.
- **Un avertissement s'affiche si l'adresse est `localhost`.** Un code généré en
  développement encode `localhost` : imprimé et collé sur les tables, il ne mène nulle part,
  et rien ne le distingue visuellement d'un code valide.
- `Cmd+P` n'imprime que la feuille : la navigation, les boutons et le fond du thème
  disparaissent (`.no-print` et `.print-sheet` dans `src/styles.css`).

## Carte publique

`/m/<slug>` est la page destinée aux clients : elle s'ouvre en scannant le QR code posé sur
la table, sans compte ni installation. Elle est **rendue au serveur** — le HTML part complet
et la carte est lisible avant même que le JavaScript n'ait été évalué, ce qui compte sur le
réseau mobile d'un client attablé.

Trois comportements à connaître :

- **Les produits en rupture sont écartés dans la requête**, pas à l'affichage : ils ne
  quittent jamais le serveur. Deux causes indépendantes les écartent — la rupture décidée à
  la main, et un stock épuisé. Une catégorie dont tous les produits sont partis disparaît
  également.
- **Un produit sans prix n'affiche rien** — pas « Prix non renseigné », qui est un message
  destiné au gérant. C'est ce que fait une carte imprimée pour un plat du jour.
- **Une adresse inconnue répond un vrai 404**, et non une page d'erreur en 200 : ces URL sont
  imprimées sur des QR codes.

## Structure du projet

```
src/
├── routes/          # Routes fichier-système (TanStack Router)
│   ├── __root.tsx   # Shell HTML, providers et devtools
│   ├── index.tsx    # Page d'accueil
│   ├── login.tsx    # Connexion / création de compte
│   ├── _authenticated.tsx      # Garde d'auth + coquille du back-office
│   └── _authenticated/
│       └── admin.tsx           # Liste des établissements
├── db/
│   ├── schema.ts    # Modèle de données + policies RLS
│   ├── client.server.ts # Connexion Drizzle — jamais importée côté client
│   └── migrations/  # Généré par drizzle-kit — ne pas éditer à la main
├── components/ui/   # Composants shadcn/ui
├── integrations/    # Providers (TanStack Query)
├── lib/
│   ├── supabase.ts  # Client navigateur + types des tables
│   └── utils.ts     # Utilitaires (`cn`)
├── env.ts           # Variables d'environnement client
├── env.server.ts    # Variables d'environnement serveur
├── router.tsx       # Configuration du router
├── routeTree.gen.ts # Généré — ne pas éditer à la main
└── styles.css       # Tailwind et thème
```

Les fichiers suffixés `.server.ts` sont refusés à la compilation s'ils sont importés depuis du
code client. C'est important ici : les `loader` de route sont **isomorphes** et s'exécutent
aussi dans le navigateur, donc tout accès aux données doit passer par un `createServerFn`.

L'alias `#/*` pointe vers `./src/*` : préférez `import { cn } from '#/lib/utils'` aux
chemins relatifs.

### Ajouter un composant UI

```bash
npx shadcn@latest add dialog
```

## Déploiement

Le projet cible **Vercel**. Poussez le dépôt, importez-le dans Vercel et laissez la
détection automatique faire le reste — pensez à renseigner les variables d'environnement
dans les réglages du projet.

Nitro sert d'adapter serveur, donc un déploiement sur tout hôte compatible Node reste
possible :

```bash
npm run build
node .output/server/index.mjs
```

## Roadmap

- [x] Socle technique : TanStack Start, Tailwind, shadcn/ui, validation d'environnement
- [x] Choix et mise en place de la persistance des données (Supabase + Drizzle)
- [x] Modèle de données : établissement, catégorie, produit
- [x] Carte publique responsive
- [x] Génération du QR code (un par établissement)
- [ ] Commande à table : panier côté client, envoi au bar depuis la carte scannée, suivi et
      historique des commandes dans le back-office, et décompte du stock à la validation.
      **Sans paiement en ligne** — le règlement se fait au comptoir, la commande ne
      transporte aucune donnée bancaire
- [x] Authentification du back-office (Supabase Auth, comptes créés par l'administrateur)
- [x] CRUD de la carte (catégories, produits, prix, photos)
- [x] Gestion des ruptures de stock
- [x] Gestion de l'inventaire : niveaux de stock activables par produit, seuils d'alerte,
      décompte manuel et passage automatique en rupture. Le **décompte à la vente** attend la
      commande à table : il appellera `adjust_product_stock`, la fonction qui sert déjà au
      décompte manuel
- [ ] Tableau de bord : nouvelle page d'accueil du back-office, à la place de la simple
      liste des établissements — chiffres de la journée, alertes (stocks bas, ruptures,
      commandes en attente) et accès direct à chaque carte
- [x] Multi-établissements : un gérant, plusieurs bars, cloisonnés par le RLS
- [ ] Accès partagés : plusieurs comptes sur un même établissement, rôles, transfert de
      propriété
- [x] Suppression d'un établissement (logique, avec corbeille et restauration)
- [ ] Internationalisation
- [x] Thème : variantes jour et nuit suivant le système
- [ ] Personnalisation du thème par établissement

## Contribuer

Les contributions sont bienvenues. Ouvrez une issue avant d'attaquer un chantier
important, puis :

1. Créez une branche depuis `main`.
2. Faites vos modifications.
3. Lancez `npm run format` et `npm run lint` avant de committer.
4. Ouvrez une pull request en décrivant le changement.
