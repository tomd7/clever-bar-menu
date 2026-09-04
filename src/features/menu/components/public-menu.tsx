import { formatPrice } from '#/features/menu/price'
import { productPhotoUrl } from '#/features/menu/photo'

import type { Menu } from '#/features/menu/api'
import type { Product } from '#/lib/supabase'

/**
 * La carte telle qu'un client la lit, après avoir scanné le QR code de sa table.
 *
 * Rien n'anime à l'entrée, contrairement au reste de l'application. Cette page
 * est rendue au serveur : son contenu est déjà dans le HTML au premier octet,
 * et le faire apparaître en fondu ne ferait que retarder une lecture que le
 * client a demandée en scannant. L'animation se justifie quand elle explique un
 * changement d'état ; ici il n'y en a aucun.
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
      <main className="page-wrap flex-1 py-10 sm:max-w-2xl sm:py-14">
        <header>
          <h1 className="display-title text-3xl leading-tight sm:text-4xl">
            {venue.name}
          </h1>
          {venue.description ? (
            <p className="mt-3 text-base leading-relaxed text-ink-soft">
              {venue.description}
            </p>
          ) : null}
        </header>

        {categories.length === 0 ? (
          <p className="mt-12 text-ink-soft">
            La carte n’est pas encore en ligne. Demandez-la au comptoir.
          </p>
        ) : (
          <div className="mt-10 space-y-10 sm:mt-12 sm:space-y-12">
            {categories.map((category) => (
              <section key={category.id}>
                <h2 className="display-title border-b border-line pb-2 text-xl sm:text-2xl">
                  {category.name}
                </h2>

                <ul className="divide-y divide-line">
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
    <li className="flex items-start gap-3 py-4 sm:gap-4">
      {product.image_path ? (
        <img
          src={productPhotoUrl(product.image_path)}
          alt=""
          /*
            `alt` vide : la photo illustre un produit dont le nom est juste à
            côté. La décrire ferait annoncer deux fois la même chose à un
            lecteur d'écran.
          */
          loading="lazy"
          className="size-16 shrink-0 rounded-lg border border-line object-cover sm:size-20"
        />
      ) : null}

      <div className="min-w-0 flex-1">
        <p className="font-medium">{product.name}</p>
        {product.description ? (
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">
            {product.description}
          </p>
        ) : null}
      </div>

      {/*
        Un produit sans prix n'affiche rien du tout, là où le back-office
        écrivait « Prix non renseigné ». C'est ce que fait une vraie carte pour
        un plat du jour : le client demande. Annoncer l'absence au client
        exposerait un oubli du gérant plutôt qu'une information.
      */}
      {product.price_cents === null ? null : (
        <p className="shrink-0 pt-0.5 font-semibold tabular-nums">
          {formatPrice(product.price_cents, currency)}
        </p>
      )}
    </li>
  )
}
