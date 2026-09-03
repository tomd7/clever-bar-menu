# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commandes

Le gestionnaire de paquets est **npm** (`.cta.json`, `package-lock.json`).

```bash
npm run dev              # dev server sur le port 3000
npm run build            # build de production (Vite + Nitro)
npm run preview          # sert le build
npm run generate-routes  # régénère src/routeTree.gen.ts depuis src/routes/
npm run lint             # ESLint
npm run format           # prettier --write . puis eslint --fix
npm run check            # prettier --check . (ne modifie rien)
npx tsc --noEmit         # typecheck — il n'existe pas de script npm pour ça
```

**Aucun framework de test n'est configuré** (pas de Vitest, pas de script `test`). Si des
tests deviennent nécessaires, la stack Vite appelle Vitest — à installer et à documenter ici.

Ajouter un composant shadcn/ui :

```bash
npx shadcn@latest add dialog
```

`.cursorrules` donne cette commande en `pnpm dlx` : c'est un reliquat du template, le projet
est en npm.

## Architecture

### Chaîne de démarrage

L'app est une application **TanStack Start** avec SSR. Le point d'entrée logique est
`src/router.tsx` → `getRouter()`, qui :

1. construit le contexte via `getContext()` (`src/integrations/tanstack-query/root-provider.tsx`) — un `QueryClient` neuf par requête ;
2. crée le router avec `routeTree` (généré), `defaultPreload: 'intent'` et `scrollRestoration` ;
3. branche `setupRouterSsrQueryIntegration` pour déshydrater le cache Query côté client ;
4. déclare le type du router dans `declare module '@tanstack/react-router'`, ce qui rend `Link`/`useNavigate` typés globalement.

Le contexte est typé à la racine via `createRootRouteWithContext<MyRouterContext>` dans
`src/routes/__root.tsx`, donc `context.queryClient` est accessible dans les `loader` de route
— c'est le mécanisme à utiliser pour précharger des données côté serveur plutôt que de
fetcher dans les composants.

`src/routes/__root.tsx` fait office de shell HTML complet (`<html>`, `<head>`, `<body>`) via
`shellComponent`, et monte `TanStackDevtools` en bas à droite en dev.

### Routing

Routing par fichiers dans `src/routes/`. **`src/routeTree.gen.ts` est généré** — ne jamais
l'éditer (`.vscode/settings.json` le marque readonly, l'exclut de la recherche et du
file-watcher). Le plugin Vite le régénère à chaud ; `npm run generate-routes` sert pour un
build à froid ou après un renommage massif.

### Alias d'import

`tsconfig.json` mappe **`#/*` et `@/*`** vers `./src/*`, mais seul `#/*` est déclaré dans le
champ `imports` de `package.json` (subpath import Node standard). `components.json` de shadcn
utilise `#/`. **Utiliser `#/`** — `@/` ne résout que par les tsconfig paths.

### Variables d'environnement

`src/env.ts` valide l'environnement au démarrage avec `@t3-oss/env-core` + Zod. Le préfixe
client est `VITE_`, `emptyStringAsUndefined: true`, et `runtimeEnv` est `import.meta.env`.
Une variable manquante ou mal typée fait **échouer le démarrage**, pas silencieusement passer.
Toute nouvelle variable doit être ajoutée au schéma (`server` ou `client`) — la lire
directement via `import.meta.env` contourne la validation.

`SERVER_URL` est un placeholder optionnel : la persistance des données n'est pas encore
choisie.

### Build et serveur

`vite.config.ts` — **l'ordre des plugins compte** : `devtools()`, `nitro()`, `tailwindcss()`,
`tanstackStart()`, `viteReact()`. Nitro sert d'adapter serveur générique ; son
`rollupConfig` externalise `/^@sentry\//`. La cible de déploiement documentée est Vercel, mais
le build Nitro tourne sur tout hôte Node (`node .output/server/index.mjs`).

## Styles

`src/styles.css` (347 lignes) est le seul fichier de style et contient **deux jeux de tokens
parallèles** — c'est le piège principal du projet :

1. **Tokens shadcn** (`--background`, `--primary`, `--border`… en `oklch`, base zinc) définis
   dans `:root`, redéfinis dans `.dark`, puis exposés à Tailwind via `@theme inline`. Ils
   s'utilisent comme utilitaires : `bg-background`, `text-muted-foreground`, `rounded-lg`.
2. **Palette maison « côtière »** (`--sea-ink`, `--lagoon`, `--lagoon-deep`, `--palm`,
   `--sand`, `--foam`, `--surface`, `--line`, `--hero-a`…) en hex/rgba brut. Elle n'est **pas**
   mappée dans `@theme`, donc pas d'utilitaire Tailwind : il faut `var(--lagoon)` en CSS ou
   une valeur arbitraire type `bg-[var(--lagoon)]`. Elle n'a **pas de variante dark** — seuls
   les tokens shadcn basculent.

Le dark mode est **piloté par classe** : `@custom-variant dark (&:is(.dark *))`. Il faut donc
un `.dark` sur un ancêtre (rien ne le pose pour l'instant — pas de theme provider).

Polices : **Manrope** en `--font-sans`, **Fraunces** pour les titres display, chargées par un
`@import` Google Fonts en tête de `styles.css`.

Un vocabulaire visuel est **déjà écrit mais encore inutilisé** dans le code : `.page-wrap`,
`.display-title`, `.island-shell`, `.feature-card`, `.island-kicker`, `.nav-link`, `.rise-in`,
`.site-footer`, plus les décors `body::before`/`body::after` et l'animation `rise-in`. Réutiliser
ces classes avant d'en inventer de nouvelles.

## Conventions

- **Prettier** : pas de point-virgule, quotes simples, virgules finales partout. Lancer
  `npm run format` avant de committer. Attention : `npm run check` signale déjà 13 fichiers
  préexistants non formatés issus du scaffold (composants shadcn, `src/styles.css`,
  `tsconfig.json`, `components.json`, `AGENTS.md`) — un `npm run format` global les
  réécrirait tous et gonflerait le diff. Formater seulement les fichiers touchés.
- **ESLint** : `@tanstack/eslint-config`, avec `import/order`, `sort-imports`,
  `import/no-cycle`, `@typescript-eslint/array-type` et `require-await` **désactivés**. Ne pas
  réordonner des imports « pour faire propre ».
- **TypeScript strict** avec `noUnusedLocals` et `noUnusedParameters` : une variable ou un
  paramètre non utilisé casse le typecheck. `verbatimModuleSyntax` est actif → les imports de
  types doivent passer par `import type`.

## État du projet

Scaffold fraîchement initialisé. `src/routes/index.tsx` est encore la page du template
TanStack, et le `<title>` de `__root.tsx` est toujours « TanStack Start Starter ».

Le `README.md` décrit le produit **visé** — carte digitale scannable par QR code côté client,
back-office CRUD côté gérant, multi-établissements, i18n et thème clair/sombre — et non
l'existant. Sa section Roadmap est la source de vérité sur ce qui reste à faire : seul le socle
technique y est coché. Ne pas supposer qu'une fonctionnalité listée existe.

Le dépôt est volontairement **sans licence** (choix explicite du propriétaire, ne pas
réintroduire de fichier `LICENSE`).

## Skills TanStack Intent

`AGENTS.md` impose ceci avant toute modification substantielle :

```bash
npx @tanstack/intent@latest list                    # lister les skills disponibles
npx @tanstack/intent@latest load <package>#<skill>   # charger celui qui correspond
```

Suivre le `SKILL.md` chargé pendant la modification. En cas de plusieurs correspondances,
préférer le skill local le plus spécifique au périmètre touché.

## Skills tiers (skills-lock.json)

Des skills externes sont installés dans le projet. Ils suivent un modèle type npm :

| Élément            | Rôle                                             | Versionné       |
| ------------------ | ------------------------------------------------ | --------------- |
| `skills-lock.json` | Manifeste : source GitHub + hash de chaque skill | **oui**         |
| `.agents/skills/`  | Contenu téléchargé                               | non (gitignore) |
| `.claude/skills/`  | Symlinks relatifs vers `.agents/skills/`         | non (gitignore) |

`skills-lock.json` est la source de vérité ; les deux dossiers sont dérivés et régénérables.
Ne pas committer `.agents/` ni `.claude/skills/` — ce dernier ne contient que des liens
symboliques, qui arriveraient cassés chez les autres. En revanche `.claude/` n'est **pas**
ignoré en bloc : un futur `settings.json` (permissions, hooks, slash commands) s'y ajoute et
se partage normalement. Le fichier personnel à ignorer le jour où il apparaît est
`.claude/settings.local.json`.
