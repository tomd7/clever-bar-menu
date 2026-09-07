# Clever Bar Menu

[English](README.md) · **Français**

Une carte digitale pour les bars et cafés : les clients scannent un QR code posé sur la table
et consultent la carte à jour depuis leur téléphone, sans application à installer. Le gérant
gère ses catégories, ses produits et ses prix depuis un back-office.

**Le projet est écrit intégralement avec [Claude Code](https://claude.com/claude-code)**, et
c'est même son objet : voir jusqu'où un produit complet — mis en ligne, utilisable par un vrai
bar — peut être mené sans qu'une ligne soit tapée à la main. Le code applicatif, le schéma et
ses migrations, les policies RLS, le CSS, l'outillage et la documentation, ce README compris,
en viennent tous. Le rôle humain est celui de la commande, de l'arbitrage et de la relecture.

![Status](https://img.shields.io/badge/status-en%20ligne-brightgreen)
![Built with Claude Code](https://img.shields.io/badge/écrit%20avec-Claude%20Code-d97757)

## En ligne

**<https://bar-menu-taupe.vercel.app>**

|                          | Adresse                                            |
| ------------------------ | -------------------------------------------------- |
| Carte publique (exemple) | <https://bar-menu-taupe.vercel.app/m/chez-lambert> |
| Back-office              | <https://bar-menu-taupe.vercel.app/login>          |
| Compte de démonstration  | `demo@cbm.be` / `demo`                             |

La carte d'un établissement vit à `/m/<slug>` — c'est cette adresse qu'encode le QR code
posé sur les tables.

> [!NOTE]
> Le compte de démonstration est **partagé et public** : les modifications qu'on y fait sont
> visibles par les autres visiteurs, et l'établissement de démonstration peut être remis à
> zéro sans préavis. N'y déposez rien de réel. La remise à zéro est
> `npm run db:seed:demo`, qui vide sa carte et son historique puis les remplit d'un jeu
> fictif (voir « [Scripts](#scripts) »).

> [!IMPORTANT]
> Le produit est en service, mais le développement continue : voir la [roadmap](#roadmap)
> pour ce qui manque encore. L'inscription est fermée — les comptes des gérants sont créés
> par l'administrateur de la plateforme (voir « [Création des comptes](#création-des-comptes) »).

## Sommaire

- [Fonctionnalités](#fonctionnalités)
- [Stack technique](#stack-technique)
- [Processus de développement](#processus-de-développement)
  - [Garde-fous automatiques](#garde-fous-automatiques)
- [Structure du projet](#structure-du-projet)
- [Sous le capot](#sous-le-capot)
  - [Back-office](#back-office)
    - [Suivi de stock](#suivi-de-stock) — [scan des codes-barres](#scan-des-codes-barres)
    - [Commande au comptoir](#commande-au-comptoir)
    - [Création des comptes](#création-des-comptes)
    - [Supprimer un établissement](#supprimer-un-établissement)
  - [QR code](#qr-code)
  - [Carte publique](#carte-publique)
- [Roadmap](#roadmap)
- [Scripts](#scripts)

## Fonctionnalités

- **Carte publique via QR code** — chaque table renvoie vers la carte de l'établissement,
  consultable sur mobile, sans installation ni compte.
- **Back-office de gestion** — création et édition des catégories, produits, prix,
  descriptions et photos ; un produit en rupture peut être masqué en un clic.
- **Suivi de stock** — activable produit par produit, avec un seuil d'alerte et une page
  faite pour être tenue debout derrière le bar. Un produit épuisé quitte la carte des
  clients et y revient de lui-même au réapprovisionnement.
- **Commande au comptoir** — le client compose son panier depuis la carte scannée, laisse
  un prénom, et suit l'état de sa commande jusqu'à « prête ». Le bar la voit arriver dans
  une file qui se rafraîchit toute seule. **Sans paiement en ligne** : le règlement se fait
  au comptoir, et aucune donnée bancaire ne transite. Fermé par défaut sur chaque
  établissement, à ouvrir depuis l'écran des commandes.
- **Multi-établissements** — un même déploiement héberge plusieurs bars. Un gérant en
  possède autant qu'il veut, chacun avec sa carte, son adresse publique et son QR code.
  L'isolation est portée par Postgres : un gérant ne voit et ne modifie que ses
  établissements. Un établissement a en revanche **un seul propriétaire** — plusieurs
  comptes sur un même bar restent à faire.
- **Scan des codes-barres** — les entrées et sorties de stock se saisissent devant la
  caméra, depuis le téléphone. Fonctionne sur tous les navigateurs, iPhone compris.
- **Thème clair/sombre** — le thème « bar du soir » suit le réglage du téléphone qui scanne
  le QR code, sans interrupteur ni cookie. La personnalisation par établissement et la carte
  multilingue sont à la [roadmap](#roadmap), pas encore là.

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
> La persistance est un Postgres hébergé sur Supabase. Supabase a été retenu parce qu'il
> couvre aussi l'authentification du back-office et le stockage des photos produits.
> **Les requêtes applicatives partent du navigateur** via `supabase-js` (PostgREST) et c'est
> le RLS qui porte l'isolation entre établissements ; **Drizzle ne sert qu'au schéma et aux
> migrations**, jamais à l'exécution.

## Processus de développement

Tout le code vient de Claude Code, mais rien n'y arrive au hasard : chaque fonctionnalité
suit le même cycle, de l'idée au déploiement. Le dev décide et relit, Claude cadre, écrit
et vérifie.

| Étape                         | Qui    |
| ----------------------------- | ------ |
| Idée de fonctionnalité        | Le dev |
| Cadrage de l'idée             | À deux |
| Issue dans le backlog Linear  | Claude |
| Développement sur une branche | Claude |
| Vérifications                 | Claude |
| Pull request vers `develop`   | Claude |
| Revue de code                 | Le dev |
| Merge et déploiement          | Le dev |

1. **L'idée part du dev.** Un besoin du bar, un manque repéré à l'usage, une ligne de la
   [roadmap](#roadmap).
2. **Elle est développée avec Claude Code**, en conversation : périmètre, cas limites,
   conséquences sur le schéma et sur le RLS, alternatives écartées. C'est l'étape qui
   transforme une phrase en une fonctionnalité descriptible — et parfois celle qui la
   réduit, ou l'abandonne.
3. **Claude crée l'issue dans le backlog Linear**, avec ce que le cadrage a produit :
   intention, périmètre, critères d'acceptation.
4. **Claude développe.** L'issue passe en « In Progress », une branche `feat/<ID-de-issue>`
   (ou `fix/<ID>` pour une correction) part de `develop` — par exemple `feat/CLOCLO-5` — et
   les commits suivent la convention `type(scope): description`.
5. **Claude vérifie son travail** avant d'ouvrir quoi que ce soit. Le projet n'embarque
   pas de framework de test : la vérification, ce sont les [garde-fous
   automatiques](#garde-fous-automatiques) — Prettier, ESLint et `npx tsc --noEmit` — et
   un passage dans l'application réelle, au format mobile d'abord.
6. **Claude ouvre la pull request vers `develop`** (via `gh`) et passe l'issue en
   « In Review ».
7. **Le dev relit.** C'est le point de contrôle du projet : rien n'est fusionné sans avoir
   été lu. Les remarques repartent à Claude, qui corrige sur la même branche.
8. **Merge de la PR dans `develop`**, puis **merge de `develop` dans `main`**, qui déclenche
   le déploiement sur Vercel.

`develop` est la branche d'intégration, `main` est ce qui est en ligne. Aucun développement
ne se fait directement sur l'une ou l'autre.

### Garde-fous automatiques

Trois hooks tiennent la base sans dépendre de la mémoire de qui que ce soit — deux hooks
Claude Code (`.claude/settings.json` → `.claude/hooks/`) et un hook git (`.githooks/`,
activé par `postinstall`) :

| Hook                   | Quand                                       | Effet                                                            |
| ---------------------- | ------------------------------------------- | ---------------------------------------------------------------- |
| `hooks/format-file.sh` | après chaque écriture de fichier par Claude | `prettier --write`, puis `eslint --fix` sur le JS/TS             |
| `hooks/typecheck.sh`   | quand Claude termine son tour               | `npx tsc --noEmit` ; une erreur bloque et lui est renvoyée       |
| `.githooks/pre-commit` | à chaque `git commit`, celui du dev compris | Prettier `--check` + ESLint sur les fichiers indexés, puis `tsc` |

Le hook git ne regarde que les fichiers indexés, refuse le commit en cas d'échec, et
`git commit --no-verify` est la sortie de secours assumée. Le formatage, le lint et les
types sont donc garantis ; le reste — architecture, règles d'UI, conventions — reste tenu
par la revue.

## Structure du projet

Le code est groupé **par domaine métier**, pas par nature technique : une feature possède
ses écrans, ses requêtes et ses règles dans un même dossier.

```
src/
├── routes/          # Routes fichier-système (TanStack Router)
│   ├── __root.tsx   # Shell HTML, providers et devtools
│   ├── index.tsx    # Page d'accueil (vitrine, pas la carte)
│   ├── login.tsx    # Connexion
│   ├── m.$venueSlug.tsx        # Carte publique, en SSR
│   ├── _authenticated.tsx      # Garde d'auth + coquille du back-office
│   └── _authenticated/         # Écrans du back-office, en `ssr: false`
├── features/        # Un dossier par domaine : composants, `api.ts`, `mutations.ts`
│   ├── auth/        # Connexion et traduction des erreurs
│   ├── menu/        # Catégories, produits, prix, photos, stock, carte publique
│   ├── orders/      # Panier client, envoi, suivi, file du bar
│   └── venues/      # Établissements, corbeille, QR code
├── components/      # Partagé entre features : ui/ (shadcn), buttons/, form/,
│                    # back-office/ (coquille), home/ (vitrine)
├── db/
│   ├── schema.ts    # Modèle de données + policies RLS
│   ├── client.server.ts # Connexion Drizzle — migrations uniquement
│   └── migrations/  # Généré par drizzle-kit — ne pas éditer à la main
├── integrations/    # Providers (TanStack Query)
├── lib/             # Sans domaine : supabase.ts, money.ts, query-keys.ts,
│                    # postgrest-error.ts, product-photos.ts, public-menu-url.ts, utils.ts
├── env.ts           # Variables d'environnement client
├── env.server.ts    # Variables d'environnement serveur
├── router.tsx       # Configuration du router
├── routeTree.gen.ts # Généré — ne pas éditer à la main
├── styles.css       # Point d'entrée : n'assemble que des `@import`
└── styles/          # Thème, éléments nus, vocabulaire partagé, mouvement, impression

scripts/
└── seed-demo.ts     # Réinitialise et remplit l'établissement de démonstration
```

Les dépendances vont dans un seul sens — `routes/` → `features/` → `components/` et `lib/` —
et **une feature n'en importe pas une autre** : ce que deux features partagent descend d'un
cran. Quand deux domaines doivent être assemblés, c'est la route qui le fait. Un composant
n'appelle jamais `supabase` directement : tout passe par l'`api.ts` de sa feature.

Le CSS suit le même découpage que le code : `src/styles/` porte ce qui appartient à
l'application entière, et **le style d'un composant vit dans un `.css` à côté de lui**
(`components/nav-link.css`, `features/menu/components/public-menu.css`…). `src/styles.css`
n'en est que la table des matières, dans l'ordre de la cascade.

Les fichiers suffixés `.server.ts` sont refusés à la compilation s'ils sont importés depuis du
code client. C'est important ici : les `loader` de route sont **isomorphes** et s'exécutent
aussi dans le navigateur, donc tout accès aux données doit passer par un `createServerFn`.

L'alias `#/*` pointe vers `./src/*` : préférez `import { cn } from '#/lib/utils'` aux
chemins relatifs. Seul `scripts/` fait exception, et par contrainte : il est exécuté par
`node` seul, qui rejette un spécifieur commençant par `#/`.

## Sous le capot

Les trois surfaces du produit — ce qu'un gérant édite, ce qui est collé sur la table, ce
qu'un client lit — et les décisions derrière chacune.

### Back-office

Le back-office vit sous `/admin`, derrière une authentification Supabase (e-mail + mot de
passe). L'accès aux données se fait **depuis le navigateur** via `supabase-js`, et c'est le
RLS qui garantit qu'un gérant ne voit que ses établissements.

Les routes du back-office sont en `ssr: false` : la session Supabase est conservée dans le
navigateur, donc l'évaluer pendant le rendu serveur conclurait « non connecté » à chaque
requête. La carte publique, elle, est en SSR — c'est une page scannée au QR code, sa vitesse de
premier affichage compte.

| Route                          | Rôle                                                       |
| ------------------------------ | ---------------------------------------------------------- |
| `/login`                       | Connexion                                                  |
| `/admin`                       | Liste des établissements du gérant, et création            |
| `/admin/corbeille`             | Établissements supprimés, et restauration                  |
| `/admin/$venueSlug`            | Édition de la carte : catégories, produits, prix, ruptures |
| `/admin/$venueSlug/stock`      | Suivi de stock : niveaux, alertes, décompte                |
| `/admin/$venueSlug/stock/scan` | Mouvements de stock à la caméra, code-barres               |
| `/admin/$venueSlug/qr`         | Feuille de QR code à imprimer                              |
| `/admin/$venueSlug/commandes`  | File des commandes et historique                           |
| `/m/$venueSlug`                | **Carte publique** — la page que vise le QR code           |

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

La **taille** d'un produit — « 25cl », « 50cl », « au fût », « pichet » — est un champ libre,
facultatif lui aussi. Le formulaire propose les formats courants en une pastille, sans pour
autant fermer la liste : les formats d'un bar sont les siens. Deux tailles d'une même bière
sont **deux produits**, comme sur une carte imprimée, et le format se lit à la suite du nom,
avant la conduite qui mène au prix. Il est recopié sur la ligne de commande à l'envoi : deux
« Blonde » sur un ticket, l'une en 25cl et l'autre en 50cl, seraient sinon un ticket qu'il
faut deviner.

L'ordre des catégories et des produits est porté par une colonne `position`, avançant de 100
en 100 pour permettre d'insérer entre deux voisines sans réécrire la liste. Un produit en
rupture reste dans la carte du gérant, barré, et sera masqué côté client.

#### Suivi de stock

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

##### Scan des codes-barres

`/admin/<slug>/stock/scan` saisit les mouvements devant la caméra : on scanne, on choisit
« entrée » ou « sortie », la quantité s'applique au produit. Un code inconnu propose son
**appairage** au produit correspondant, une seule fois — après quoi la bouteille est
reconnue.

- **Tout code entrant est normalisé en GTIN-14** ([`src/features/menu/barcode.ts`](src/features/menu/barcode.ts)),
  chiffre de contrôle vérifié. La même canette porte un UPC-A à 12 chiffres aux États-Unis
  et un EAN-13 en Europe : stockées brutes, ces deux chaînes appaireraient deux fois le même
  produit. La saisie au clavier passe par le même chemin que la caméra — deux chemins qui
  ne s'accordent pas là-dessus ne s'accordent pas en production.
- **Deux décodeurs derrière une seule API.** Le `BarcodeDetector` du navigateur quand il
  existe ; sinon un ZXing-C++ compilé en WebAssembly, chargé **à la demande sur ce seul
  écran** (~430 Ko, jamais servi à la carte publique). C'est ce qui fait marcher l'écran sur
  iPhone, où WebKit n'a jamais implémenté la Shape Detection API.
- **Le `.wasm` est servi depuis notre propre origine**, pas depuis le CDN public que
  `zxing-wasm` vise par défaut : un tiers entre un gérant et son inventaire, sur le wifi
  d'une cave, est un mode de panne de plus.

#### Commande au comptoir

Le client ajoute des produits depuis la carte scannée, ouvre son panier dans une feuille
qui monte du bas de l'écran, donne un prénom et envoie. Il suit ensuite l'état de sa
commande sur la même page, sans compte : **reçue → en préparation → prête**. Le prénom est
la référence — c'est lui qu'on appelle au comptoir, ce qu'un numéro fait mal.

Le client peut **annuler lui-même**, tant que le bar n'a pas pris la commande en charge.
Passé ce point le stock est décompté et le verre est en préparation : l'annulation reste
possible, mais au comptoir. La commande annulée indique laquelle des deux parties l'a fait.

Côté bar, `/admin/$venueSlug/commandes` affiche la file, la plus ancienne en tête, et se
relève toutes les dix secondes. Trois gestes : **Accepter** (qui décompte le stock),
**Prête**, **Récupérée** — plus une annulation en deux temps. Le nombre de commandes non
encore acceptées apparaît dans le titre de l'onglet, seul endroit qu'un onglet en
arrière-plan peut faire voir.

Trois points de conception qui expliquent le reste :

- **La commande anonyme ne touche jamais la table.** Le client est `anon` et `orders` ne
  lui ouvre aucune policy, pas même en lecture. Tout passe par deux fonctions Postgres
  `security definer` (migration `0009`) : `place_order` valide et insère, `get_order`
  relit. **Rien de ce qui a une conséquence ne vient du navigateur** — le client envoie des
  identifiants de produits et des quantités, les prix et le total sont relus en base.
- **Le suivi tient à un jeton secret**, gardé dans le navigateur et transmis en corps de
  requête, jamais dans une URL. Sans lui, suivre une commande par son seul identifiant
  laisserait lire celle du voisin en changeant un chiffre. Le navigateur en garde **une
  liste** : commander une deuxième tournée pendant que la première arrive n'efface pas la
  première. Le suivi les range en deux onglets — « En cours » et « Historique » — pour
  qu'une commande déjà récupérée n'encombre pas ce qu'on attend encore.
- **Le stock descend à l'acceptation, pas à l'envoi.** Une commande arrive anonymement
  depuis un QR code affiché en salle : décompter à l'envoi laisserait vider un inventaire
  depuis le trottoir. En contrepartie, deux clients peuvent commander la dernière bouteille
  avant que le bar n'arbitre.

Une limite connue : **`place_order` n'est pas limitée en débit**. C'est un point d'entrée
d'écriture non authentifié, ouvert sur Internet. Les plafonds par ligne (20) et par
commande (40 lignes) bornent ce qu'un appel peut écrire, rien ne borne le nombre d'appels.

#### Création des comptes

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

#### Supprimer un établissement

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

### QR code

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
  disparaissent (`.no-print` dans `src/styles/print.css`, `.print-sheet` à côté de l'écran,
  dans `src/features/venues/components/venue-qr.css`).

### Carte publique

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

## Roadmap

- [x] Socle technique : TanStack Start, Tailwind, shadcn/ui, validation d'environnement
- [x] Choix et mise en place de la persistance des données (Supabase + Drizzle)
- [x] Authentification du back-office (Supabase Auth, comptes créés par l'administrateur)
- [x] CRUD des établissements
- [x] CRUD de la carte (catégories, produits, prix, photos)
- [x] Carte publique
- [x] Génération du QR code (un par établissement)
- [x] Taille du produit : format servi (25cl, 50cl, au fût…), sur la carte comme sur les
      tickets de commande
- [x] Thème : variantes jour et nuit suivant le système
- [x] Suppression d'un établissement (logique, avec corbeille et restauration)
- [x] Gestion des ruptures de stock
- [x] Gestion de l'inventaire : niveaux de stock activables par produit, seuils d'alerte,
      décompte manuel et passage automatique en rupture
- [x] Commande au comptoir : panier côté client, envoi au bar depuis la carte scannée,
      suivi de l'état par le client, file et historique dans le back-office, décompte du
      stock à l'acceptation. **Sans paiement en ligne** — le règlement se fait au comptoir,
      la commande ne transporte aucune donnée bancaire
- [x] Scan du code-barres pour les mouvements de stock : entrées et sorties saisies devant
      la caméra depuis `/admin/<slug>/stock/scan`, avec appairage du code au premier scan.
      Fonctionne sur tous les navigateurs, iOS compris : `BarcodeDetector` natif quand il
      existe, sinon un décodeur ZXing en WebAssembly chargé à la demande sur ce seul écran
- [ ] Tableau de bord : nouvelle page d'accueil du back-office, à la place de la simple
      liste des établissements — chiffres de la journée, alertes (stocks bas, ruptures,
      commandes en attente) et accès direct à chaque carte
- [ ] Personnalisation du thème de la carte par établissement
- [ ] Internationalisation
- [ ] Accès partagés : plusieurs comptes sur un même établissement, rôles, transfert de
      propriété

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
| `npm run db:seed:demo`    | Réinitialise et remplit l'établissement de démo      |
| `npm run lint`            | ESLint                                               |
| `npm run format`          | Prettier `--write` puis `eslint --fix`               |
| `npm run check`           | Vérifie le formatage sans modifier les fichiers      |

Il n'y a pas de script de typecheck : c'est `npx tsc --noEmit`. Le projet n'embarque pas non
plus de framework de test pour l'instant.

`db:seed:demo` exécute `scripts/seed-demo.ts` : il supprime les catégories, les produits et
les commandes de `chez-lambert`, puis réécrit une carte de sept catégories, une quarantaine
de produits (avec stocks, seuils d'alerte et codes-barres) et une quinzaine de commandes
réparties entre la file en cours et l'historique. Il est **rejouable** — le relancer redonne
exactement le même état. Avant la moindre suppression, il vérifie que l'établissement visé
porte bien le slug de la démo **et** appartient à `demo@cbm.be` ; sinon il s'arrête sans rien
écrire. Il se connecte par `DATABASE_URL`, donc en propriétaire de la base : c'est le seul
moyen d'écrire dans `orders`, table sur laquelle personne n'a de droit d'insertion.
