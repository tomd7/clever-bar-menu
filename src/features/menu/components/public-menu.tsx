import { ArrowUp } from 'lucide-react'

import { MenuNav, sectionId } from '#/features/menu/components/menu-nav'
import { ProductSize } from '#/components/product-size'
import { formatPrice } from '#/lib/money'
import { productPhotoUrl } from '#/features/menu/photo'

import type { CategoryWithProducts, Menu } from '#/features/menu/api'
import type { Product } from '#/lib/supabase'
import type { ReactNode } from 'react'

/**
 * Ce que la carte accepte de poser en bout de ligne, sans savoir ce que c'est.
 *
 * C'est la prise de commande qui la remplit, et `features/menu` ne doit rien
 * savoir de `features/orders` — la règle du projet interdit l'import. La route,
 * elle, a le droit de connaître les deux : c'est exactement le montage que
 * `_authenticated.tsx` fait déjà en passant `<VenueNav>` à `BackOfficeShell`.
 *
 * `undefined` est le cas normal : une carte dont l'établissement n'a pas ouvert
 * la commande n'affiche rien de plus qu'avant.
 */
export type ProductAction = (product: Product) => ReactNode

/**
 * Seuil à partir duquel le sommaire collant gagne sa place.
 *
 * Deux sections tiennent dans un écran : le rail ne serait qu'un bandeau de
 * plus à faire défiler pour une navigation que le pouce fait déjà.
 */
const NAV_MIN_CATEGORIES = 3

/** Ancre du haut de la carte, visée par le lien de retour en fin de page. */
const MENU_TOP_ID = 'carte'

/**
 * La carte telle qu'un client la lit, après avoir scanné le QR code de sa table.
 *
 * Elle est dessinée comme un objet — une carte posée sur la table — et non
 * comme une page de données : une feuille opaque (`.island-shell`, la surface
 * vitrine du thème) coiffée d'un panneau d'ardoise qui porte le nom de
 * l'établissement à la craie. C'est le seul endroit de l'application où le
 * thème donne à voir ce qui lui a donné son nom, et c'est ce qui distingue une
 * carte d'une liste : le client reconnaît un support avant de lire un contenu.
 *
 * La feuille est à fond perdu sur téléphone et ne devient un objet posé qu'à
 * partir de `sm`. Sur l'écran où cette page est réellement lue, un cadre et
 * deux marges ne feraient que rogner la largeur de lecture ; sur un écran
 * large, sans cadre, la carte se dissoudrait dans le fond.
 *
 * Rien n'anime à l'entrée, contrairement au reste de l'application. Cette page
 * est rendue au serveur : son contenu est déjà dans le HTML au premier octet,
 * et le faire apparaître en fondu ne ferait que retarder une lecture que le
 * client a demandée en scannant. L'animation se justifie quand elle explique un
 * changement d'état ; ici il n'y en a aucun. Les seuls mouvements de la page
 * sont le surlignement du rail et l'enfoncement d'une pastille — deux réponses
 * à une action.
 *
 * Le composant ne charge rien : la route s'en charge, ce qui la laisse préparer
 * les données côté serveur.
 */
export function PublicMenu({
  menu,
  productAction,
}: {
  menu: Menu
  productAction?: ProductAction
}) {
  const { venue, categories } = menu
  const hasNav = categories.length >= NAV_MIN_CATEGORIES

  /*
    Les crédits dus par cette carte, dédoublonnés.

    Une photo issue du catalogue vient d'Open Food Facts et est sous CC-BY-SA :
    l'afficher ici est une republication, et l'attribution est due à l'endroit
    où l'œuvre est publiée — cette page, pas l'écran de scan où le gérant l'a
    choisie. Une carte dont toutes les photos ont été prises au comptoir
    n'affiche donc rien, ce qui est le cas le plus courant.
  */
  const photoCredits = [
    ...new Set(
      categories.flatMap((category) =>
        category.products
          .map((product) => product.photo_credit)
          .filter((credit) => credit !== null),
      ),
    ),
  ]

  return (
    /*
      La réserve du bas n'existe que lorsqu'une action est posée : c'est la
      barre de commande, fixée au bord bas, qui recouvrirait sinon le dernier
      produit de la carte — celui qu'on vient d'ajouter.

      Elle est dimensionnée pour la barre à **deux lignes** — suivi de commande
      *et* panier —, pas pour le cas courant à une seule. Cette page ne peut pas
      savoir laquelle des deux est affichée, et se tromper par excès met un peu
      de vide après la dernière catégorie, là où se tromper par défaut cache un
      produit derrière un bandeau opaque.
    */
    <div
      className={
        productAction
          ? 'flex min-h-dvh flex-col pb-36'
          : 'flex min-h-dvh flex-col'
      }
    >
      {/*
        Largeur de lecture bornée, et non la pleine largeur de `page-wrap` :
        une carte est une colonne qui se parcourt du nom vers le prix. Étirée
        sur un écran large, la ligne sépare les deux par vingt centimètres de
        vide.

        The value is `--menu-column` (`styles/vocabulary.css`), which widens at
        `md` and `lg` and which the order bar and the cart sheet read too — the
        three are centred on the same axis and must not drift apart.
      */}
      <main className="mx-auto w-full max-w-(--menu-column) flex-1 sm:px-6 sm:py-10">
        {/*
          `.island-shell` fournit la surface, le filet et l'élévation ; les
          trois sont retirés à la base et rendus à partir de `sm`. L'ordre est
          bien mobile d'abord : le téléphone reçoit la feuille nue, le grand
          écran y ajoute le cadre.

          Pas d'`overflow-hidden` sur ce conteneur, si tentant soit-il pour
          rogner les coins du panneau d'ardoise : il ferait de la carte un
          conteneur de défilement et le sommaire collant à l'intérieur ne
          collerait plus à rien.
        */}
        <article
          id={MENU_TOP_ID}
          className="island-shell rounded-none border-x-0 shadow-none sm:rounded-3xl sm:border-x sm:shadow-[var(--shadow-2)]"
        >
          {/*
            Le panneau d'ardoise. C'est le seul endroit où cette page hausse la
            voix : le nom de l'établissement en Archivo large sur fond sombre,
            comme sur le tableau à l'entrée. Tout ce qui suit se lit, donc tout
            ce qui suit reste calme.

            Il reste compact — une bonne moitié d'écran, pas la totalité. Le
            client vient de scanner pour lire une carte : lui imposer une
            bannière pleine page avant la première catégorie retarderait ce
            qu'il a demandé, exactement comme le ferait une animation d'entrée.

            Le rayon est celui de la feuille moins son filet d'un pixel, sans
            quoi l'angle du panneau déborderait d'un cheveu de la courbe
            intérieure du cadre.
          */}
          <header className="bg-board px-5 pt-11 pb-12 text-on-board sm:rounded-t-[calc(1.5rem-1px)] sm:px-9 sm:pt-14 sm:pb-16">
            {/*
              Le libellé reprend le rôle de `.island-kicker` sans sa classe :
              celle-ci impose `--bottle-deep`, le vert sombre, illisible sur
              l'ardoise — et comme elle est déclarée hors calque, un utilitaire
              de couleur posé ici perdrait contre elle.
            */}
            <p className="text-[0.8125rem] font-semibold text-bottle-chalk">
              La carte
            </p>

            <h1 className="display-title mt-2 text-4xl leading-[1.02] text-balance sm:text-5xl">
              {venue.name}
            </h1>

            {venue.description ? (
              <p className="mt-4 max-w-prose text-base leading-relaxed text-on-board-soft">
                {venue.description}
              </p>
            ) : null}
          </header>

          {categories.length === 0 ? (
            <p className="px-5 py-16 text-center leading-relaxed text-ink-soft sm:px-9">
              La carte n’est pas encore en ligne. Demandez-la au comptoir.
            </p>
          ) : (
            <>
              {/*
                Le sommaire est un enfant direct de la feuille, et non du bloc
                de contenu : un élément collant ne colle que tant que son parent
                défile. Posé dans une section, il décrocherait à la fin de
                celle-ci.
              */}
              {hasNav ? <MenuNav categories={categories} /> : null}

              <div className="px-5 sm:px-9">
                {categories.map((category, index) => (
                  <MenuSection
                    key={category.id}
                    category={category}
                    currency={venue.currency}
                    isFirst={index === 0}
                    productAction={productAction}
                  />
                ))}
              </div>

              {/*
                Une carte longue se termine à dix écrans du nom de
                l'établissement. Le rail ramène en haut d'une section, pas en
                haut de la carte, et le geste de défilement inverse est long.
                Le lien n'apparaît donc que là où le rail apparaît : en dessous,
                le pouce remonte plus vite que lui.
              */}
              {hasNav || photoCredits.length > 0 ? (
                <footer className="border-t border-line px-5 py-6 text-center sm:px-9">
                  {hasNav ? (
                    <a
                      href={`#${MENU_TOP_ID}`}
                      className="inline-flex min-h-11 items-center gap-1.5 text-sm text-ink-soft no-underline"
                    >
                      <ArrowUp className="size-4" aria-hidden="true" />
                      Haut de la carte
                    </a>
                  ) : null}

                  {photoCredits.length > 0 ? (
                    <p className="text-xs text-ink-soft">
                      Certaines photos proviennent de {photoCredits.join(', ')}{' '}
                      et sont sous licence CC-BY-SA.
                    </p>
                  ) : null}
                </footer>
              ) : null}
            </>
          )}
        </article>
      </main>
    </div>
  )
}

function MenuSection({
  category,
  currency,
  isFirst,
  productAction,
}: {
  category: CategoryWithProducts
  currency: string
  isFirst: boolean
  productAction?: ProductAction
}) {
  /*
    La colonne d'image est réservée pour toute la section dès qu'un seul de ses
    produits porte une photo, plutôt que ligne par ligne.

    C'est ce qui tient les deux bords de la liste. Une vignette posée à gauche
    décalait le nom des seuls produits illustrés : le bord gauche de la carte
    devenait un escalier. Une vignette posée à droite sans colonne réservée
    raccourcit la conduite de ces lignes-là, et les prix cessent de s'aligner
    entre eux — or c'est la colonne des prix qu'un client parcourt.

    Réservée à la section, la place vide à droite d'un produit sans photo ne se
    voit pas : rien ne la dessine. Un cadre vide à gauche, si.
  */
  const hasPhotos = category.products.some(
    (product) => product.image_path !== null,
  )

  return (
    <section
      id={sectionId(category.id)}
      /*
        L'ancre doit s'arrêter *sous* le rail collant, sinon le titre de
        section atterrit derrière lui. 6rem couvre les 44px de pastille et ses
        marges.

        Le filet de séparation est celui des sections, pas celui des produits :
        il ferme la section précédente, là où le titre ouvre la suivante. La
        première n'en a pas — elle est déjà fermée par l'ardoise.

        L'air est réparti de façon dissymétrique autour de ce trait : moins en
        dessous du dernier produit, plus au-dessus du titre suivant. C'est ce
        qui rattache le trait à la section qu'il ouvre plutôt que d'en faire
        une barre flottant entre deux blocs équidistants.
      */
      className={
        isFirst
          ? 'scroll-mt-24 pt-8'
          : 'scroll-mt-24 border-t border-line pt-10'
      }
    >
      <h2 className="display-title text-2xl sm:text-[1.75rem]">
        {category.name}
      </h2>

      {/*
        Le chapô d'une catégorie — « Brassées à moins de trente kilomètres » —
        est le seul texte éditorial que le gérant puisse écrire sur cette page.
        Il n'était pas affiché alors que la colonne existe en base : une carte
        qui ne rend que des noms et des prix ne peut, par construction, que
        paraître brute.
      */}
      {category.description ? (
        <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
          {category.description}
        </p>
      ) : null}

      {/*
        Un filet plus léger que `--line` entre les produits : ces séparateurs se
        répètent douze fois et n'ont pas à peser autant qu'une bordure de
        section. Le titre, lui, n'a pas de trait sous lui — sa taille suffit à
        ouvrir la section, et le trait la refermerait aussitôt.
      */}
      <ul className="mt-2 divide-y divide-line-soft pb-6">
        {category.products.map((product) => (
          <MenuItem
            key={product.id}
            product={product}
            currency={currency}
            withPhotoColumn={hasPhotos}
            action={productAction?.(product)}
          />
        ))}
      </ul>
    </section>
  )
}

function MenuItem({
  product,
  currency,
  withPhotoColumn,
  action,
}: {
  product: Product
  currency: string
  withPhotoColumn: boolean
  action?: ReactNode
}) {
  return (
    <li
      /*
        Grille à colonne fixe plutôt que `flex` : c'est la largeur déclarée —
        et non celle que chaque image arrive à occuper — qui garantit que deux
        lignes voisines cadrent au même endroit. Les valeurs sont celles de
        `size-16` / `sm:size-20`, en face desquelles la vignette est posée.

        Alignement centré et non sur le haut : sur cette carte, la plupart des
        produits n'ont ni prix ni description, et une ligne calée en haut
        laissait le nom seul en haut d'une vignette de 80px — un trou dont
        l'œil ne comprend pas la cause. Centré, le nom fait face à sa photo, et
        un produit qui gagne trois lignes de description reste centré lui aussi.
      */
      className={itemLayout(withPhotoColumn, action !== undefined)}
    >
      <div className="min-w-0">
        <p className="flex items-baseline gap-2">
          {/*
            Le format est dans la boîte du nom, avant la conduite : « Blonde
            50cl ······ 5,50 € », comme sur une carte imprimée. Posé en frère
            du nom, il aurait été un troisième objet à aligner sur une ligne
            qui en compte déjà trois, et la conduite serait partie avant lui.
          */}
          <span className="min-w-0 font-semibold">
            {product.name}
            <ProductSize size={product.size} />
          </span>

          {/*
            Un produit sans prix n'affiche rien du tout — ni prix, ni filet —
            là où le back-office écrivait « Prix non renseigné ». C'est ce que
            fait une vraie carte pour un plat du jour : le client demande.
            Annoncer l'absence au client exposerait un oubli du gérant plutôt
            qu'une information.
          */}
          {product.price_cents === null ? null : (
            <>
              <span className="menu-leader" aria-hidden="true" />
              <span className="shrink-0 font-semibold tabular-nums">
                {formatPrice(product.price_cents, currency)}
              </span>
            </>
          )}
        </p>

        {product.description ? (
          <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
            {product.description}
          </p>
        ) : null}
      </div>

      {/*
        Un placeholder explicite, et non `null`, quand la section réserve une
        colonne d'image que ce produit ne remplit pas.

        Ce n'est pas cosmétique : `null` ne produit aucun élément, et le
        placement automatique de la grille ferait alors glisser l'action dans
        la colonne de l'image. Les prix cesseraient de s'aligner sur les lignes
        sans photo — c'est-à-dire exactement ce que la colonne réservée existe
        pour empêcher.
      */}
      {withPhotoColumn && !product.image_path ? (
        <div aria-hidden="true" />
      ) : null}

      {withPhotoColumn && product.image_path ? (
        <img
          src={productPhotoUrl(product.image_path)}
          alt=""
          /*
            `alt` vide : la photo illustre un produit dont le nom est juste à
            côté. La décrire ferait annoncer deux fois la même chose à un
            lecteur d'écran.

            Un fond derrière la photo : beaucoup de clichés de bouteilles sont
            détourés sur blanc, et posés à nu sur la feuille ils la perçaient de
            timbres clairs. C'est `--surface-raised` et non `--surface` depuis
            que la carte est une feuille opaque : sur la surface même, un
            détourage blanc redeviendrait invisible.
          */
          loading="lazy"
          className="size-16 rounded-xl border border-line bg-surface-raised object-cover sm:size-20"
        />
      ) : null}
      {action ? <div className="justify-self-end">{action}</div> : null}
    </li>
  )
}

/**
 * La grille d'une ligne de produit, selon ce qu'elle doit loger.
 *
 * Quatre cas plutôt qu'un ternaire imbriqué à la volée : c'est la seule règle
 * de mise en page de cette carte qui dépende de deux conditions, et l'écrire à
 * plat rend visible qu'aucune n'est oubliée. Les largeurs de la colonne
 * d'image sont celles de `size-16` / `sm:size-20`, en face desquelles la
 * vignette est posée ; celle de l'action est `auto`, un bouton rond de 44px
 * n'ayant pas de raison d'être déclaré deux fois.
 *
 * L'action est **toujours en dernière colonne**, au bord droit : c'est le
 * pouce qui la vise, et la déplacer selon la présence d'une photo obligerait la
 * main à chercher.
 */
function itemLayout(withPhotoColumn: boolean, withAction: boolean): string {
  const base = 'items-center gap-4 py-4 sm:gap-5'

  if (withPhotoColumn && withAction) {
    return `grid grid-cols-[minmax(0,1fr)_4rem_auto] sm:grid-cols-[minmax(0,1fr)_5rem_auto] ${base}`
  }
  if (withPhotoColumn) {
    return `grid grid-cols-[minmax(0,1fr)_4rem] sm:grid-cols-[minmax(0,1fr)_5rem] ${base}`
  }
  if (withAction) {
    return `grid grid-cols-[minmax(0,1fr)_auto] ${base}`
  }
  return 'py-4'
}
