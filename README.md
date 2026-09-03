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

| Domaine     | Choix                                                                                  |
| ----------- | -------------------------------------------------------------------------------------- |
| Framework   | [TanStack Start](https://tanstack.com/start) (SSR) + [React 19](https://react.dev)     |
| Routing     | [TanStack Router](https://tanstack.com/router) (routes générées depuis `src/routes/`)  |
| Données     | [TanStack Query](https://tanstack.com/query)                                           |
| Formulaires | [TanStack Form](https://tanstack.com/form) + [Zod](https://zod.dev)                    |
| UI          | [Tailwind CSS 4](https://tailwindcss.com) + [shadcn/ui](https://ui.shadcn.com) (Radix) |
| Build       | [Vite 8](https://vite.dev)                                                             |
| Serveur     | [Nitro](https://nitro.build)                                                           |
| Langage     | TypeScript                                                                             |

> [!NOTE]
> La persistance des données n'est pas encore arrêtée (base de données ou API dédiée).
> `src/env.ts` prévoit une variable `SERVER_URL` en attendant cette décision.

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

```bash
# Côté serveur
SERVER_URL=              # optionnel : URL de l'API de données

# Côté client (préfixe VITE_ obligatoire)
VITE_APP_TITLE=          # optionnel : titre affiché dans l'application
```

## Scripts

| Commande                  | Rôle                                                 |
| ------------------------- | ---------------------------------------------------- |
| `npm run dev`             | Serveur de développement sur le port 3000            |
| `npm run build`           | Build de production                                  |
| `npm run preview`         | Prévisualisation du build                            |
| `npm run generate-routes` | Régénère `src/routeTree.gen.ts` depuis `src/routes/` |
| `npm run lint`            | ESLint                                               |
| `npm run format`          | Prettier `--write` puis `eslint --fix`               |
| `npm run check`           | Vérifie le formatage sans modifier les fichiers      |

## Structure du projet

```
src/
├── routes/          # Routes fichier-système (TanStack Router)
│   ├── __root.tsx   # Shell HTML, providers et devtools
│   └── index.tsx    # Page d'accueil
├── components/ui/   # Composants shadcn/ui
├── integrations/    # Providers (TanStack Query)
├── lib/utils.ts     # Utilitaires (`cn`)
├── env.ts           # Schéma des variables d'environnement
├── router.tsx       # Configuration du router
├── routeTree.gen.ts # Généré — ne pas éditer à la main
└── styles.css       # Tailwind et thème
```

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
- [ ] Choix et mise en place de la persistance des données
- [ ] Modèle de données : établissement, catégorie, produit
- [ ] Carte publique responsive
- [ ] Génération des QR codes par table
- [ ] Authentification du back-office
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
