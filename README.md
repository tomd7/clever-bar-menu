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
- **Multi-établissements** — un même déploiement héberge plusieurs bars, chacun avec sa
  carte et ses accès.
- **Multilingue et thème clair/sombre** — carte traduisible et apparence personnalisable
  par établissement.

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
VITE_APP_TITLE=          # optionnel : titre affiché dans l'application
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
requête. La carte publique, elle, restera en SSR — c'est une page scannée au QR code, sa
vitesse de premier affichage compte.

| Route    | Rôle                                            |
| -------- | ----------------------------------------------- |
| `/login` | Connexion                                       |
| `/admin` | Liste des établissements du gérant, et création |

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
- [ ] Carte publique responsive
- [ ] Génération des QR codes par table
- [x] Authentification du back-office (Supabase Auth, comptes créés par l'administrateur)
- [ ] CRUD de la carte (catégories, produits, prix, photos)
- [ ] Gestion des ruptures de stock
- [ ] Multi-établissements
- [ ] Internationalisation
- [ ] Thème clair/sombre et personnalisation par établissement

## Contribuer

Les contributions sont bienvenues. Ouvrez une issue avant d'attaquer un chantier
important, puis :

1. Créez une branche depuis `main`.
2. Faites vos modifications.
3. Lancez `npm run format` et `npm run lint` avant de committer.
4. Ouvrez une pull request en décrivant le changement.
