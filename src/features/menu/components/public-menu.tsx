import { MenuNav, sectionId } from '#/features/menu/components/menu-nav'
import { formatPrice } from '#/features/menu/price'
import { productPhotoUrl } from '#/features/menu/photo'

import type { Menu } from '#/features/menu/api'
import type { Product } from '#/lib/supabase'

/**
 * Seuil à partir duquel le sommaire collant gagne sa place.
 *
 * Deux sections tiennent dans un écran : le rail ne serait qu'un bandeau de
 * plus à faire défiler pour une navigation que le pouce fait déjà.
 */
const NAV_MIN_CATEGORIES = 3

/**
 * La carte telle qu'un client la lit, après avoir scanné le QR code de sa table.
 *
 * Rien n'anime à l'entrée, contrairement au reste de l'application. Cette page
 * est rendue au serveur : son contenu est déjà dans le HTML au premier octet,
 * et le faire apparaître en fondu ne ferait que retarder une lecture que le
 * client a demandée en scannant. L'animation se justifie quand elle explique un
 * changement d'état ; ici il n'y en a aucun. Le seul mouvement de la page est
 * le surlignement du rail, qui répond au défilement — donc à une action.
 *
 * Le composant ne charge rien : la route s'en charge, ce qui la laisse préparer
 * les données côté serveur.
 */
export function PublicMenu({ menu }: { menu: Menu }) {
  const { venue, categories } = menu

  return (
    <div className="flex min-h-dvh flex-col">
      {/*
        Largeur de lecture bornée, et non la pleine largeur de `page-wrap` :
        une carte est une colonne qui se parcourt du nom vers le prix. Étirée
        sur un écran large, la ligne sépare les deux par vingt centimètres de
        vide. Ce n'est pas un layout desktop — sur téléphone, où cette page est
        réellement lue, la contrainte ne s'applique jamais.
      */}
      <main className="mx-auto w-full max-w-[34rem] flex-1 px-4 pb-16 sm:px-6">
        {/*
          La couverture occupe le premier écran à elle seule. C'est le seul
          endroit où cette page hausse la voix : le nom de l'établissement en
          Archivo large, comme sur l'ardoise à l'entrée. Tout ce qui suit se
          lit, donc tout ce qui suit reste calme.
        */}
        <header className="pt-12 pb-2 sm:pt-16">
          <h1 className="display-title text-4xl leading-[1.02] text-balance sm:text-5xl">
            {venue.name}
          </h1>
          {venue.description ? (
            <p className="mt-4 text-base leading-relaxed text-ink-soft">
              {venue.description}
            </p>
          ) : null}
        </header>

        {categories.length === 0 ? (
          <p className="mt-12 text-ink-soft">
            La carte n’est pas encore en ligne. Demandez-la au comptoir.
          </p>
        ) : (
          <>
            {categories.length >= NAV_MIN_CATEGORIES ? (
              <MenuNav categories={categories} />
            ) : null}

            <div className="mt-4">
              {categories.map((category) => (
                <section
                  key={category.id}
                  id={sectionId(category.id)}
                  /*
                    L'ancre doit s'arrêter *sous* le rail collant, sinon le
                    titre de section atterrit derrière lui. 6rem couvre les
                    44px de pastille et ses marges.
                  */
                  className="scroll-mt-24 pt-10"
                >
                  <h2 className="display-title text-2xl sm:text-3xl">
                    {category.name}
                  </h2>

                  {/*
                    Un filet plus léger que `--line` entre les produits : ces
                    séparateurs se répètent douze fois et n'ont pas à peser
                    autant qu'une bordure de section. Le titre, lui, n'a plus
                    de trait sous lui — sa taille suffit à ouvrir la section, et
                    le trait la refermait aussitôt.
                  */}
                  <ul className="mt-3 divide-y divide-line-soft">
                    {category.products.map((product) => (
                      <MenuItem
                        key={product.id}
                        product={product}
                        currency={venue.currency}
                      />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  )
}

function MenuItem({
  product,
  currency,
}: {
  product: Product
  currency: string
}) {
  return (
    <li className="flex items-start gap-4 py-4">
      {product.image_path ? (
        <img
          src={productPhotoUrl(product.image_path)}
          alt=""
          /*
            `alt` vide : la photo illustre un produit dont le nom est juste à
            côté. La décrire ferait annoncer deux fois la même chose à un
            lecteur d'écran.

            Un fond `--surface` derrière la photo : beaucoup de clichés de
            bouteilles sont détourés sur blanc, et posés à nu sur l'ardoise ils
            perçaient la page de timbres clairs. Le filet est celui de `--line`
            et non `--line-soft` : de jour, une photo détourée sur blanc posée
            sur une surface blanche n'a plus de contour du tout, et la vignette
            se lit alors comme une case vide.
          */
          loading="lazy"
          className="size-14 shrink-0 rounded-lg border border-line bg-surface object-cover sm:size-16"
        />
      ) : null}

      <div className="min-w-0 flex-1">
        <p className="flex items-baseline gap-2">
          <span className="min-w-0 font-semibold">{product.name}</span>

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
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">
            {product.description}
          </p>
        ) : null}
      </div>
    </li>
  )
}
