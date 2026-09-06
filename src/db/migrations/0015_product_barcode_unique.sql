-- Un code-barres ne désigne qu'un produit, par établissement.
--
-- Migration écrite à la main (drizzle-kit generate --custom), même raison qu'en
-- 0007 : drizzle-kit ne décrit ni les fonctions ni les triggers, et
-- src/db/schema.ts n'a donc rien à en dire.
--
-- Pourquoi un trigger et pas un index unique. La règle voulue est « unique par
-- établissement », or `products` ne porte pas `venue_id` : il faut remonter par
-- `categories`. Une expression d'index doit être `IMMUTABLE`, et toute fonction
-- qui fait cette remontée est `STABLE` au mieux — Postgres refuse l'index, ce
-- n'est pas un compromis mais une impossibilité. Les deux replis ne valent pas
-- mieux : un unique global interdirait à deux bars du même déploiement de
-- vendre la même bière, et `unique (category_id, barcode)` laisserait passer
-- justement le doublon qui gêne, celui d'une catégorie à l'autre.
--
-- Pourquoi en base plutôt que dans l'écran de scan. L'écran vérifie déjà, sur
-- la carte qu'il a en cache — et cette vérification est fausse par
-- construction : le cache d'un appareil ignore l'appairage que l'autre vient de
-- faire. Deux téléphones derrière le même bar suffisent à créer un code porté
-- par deux produits, après quoi la résolution rend le premier venu. La panne
-- est silencieuse, permanente, et rien dans l'interface ne la montre : le
-- scanner crédite l'autre bière. C'est la doctrine du fichier CLAUDE.md de ce
-- dossier — un guard protège un écran, pas les données.
--
-- `security invoker` et `set search_path = ''` : mêmes raisons qu'en 0007, et
-- la première mérite un mot de plus ici. La policy `products_public_read` est
-- `using true` : le `select` ci-dessous voit donc tous les produits sans avoir
-- besoin de `security definer`. Un contrôle d'unicité aveuglé par le RLS serait
-- pire qu'aucun contrôle — il laisserait passer le doublon qu'il ne voit pas.
create or replace function public.check_product_barcode_unique()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  conflicting_name text;
begin
  -- Rien à vérifier sur un produit sans code, ni sur un `update` qui ne touche
  -- pas la colonne : le trigger est appelé à chaque enregistrement d'une fiche
  -- produit, et une jointure sur trois tables à chaque frappe de description
  -- serait un coût pour rien.
  if new.barcode is null then
    return new;
  end if;

  if tg_op = 'UPDATE' and new.barcode is not distinct from old.barcode then
    return new;
  end if;

  select p.name
    into conflicting_name
    from public.products as p
    join public.categories as c on c.id = p.category_id
   where p.barcode = new.barcode
     and p.id <> new.id
     -- L'établissement du produit visé, atteint par le même chemin.
     and c.venue_id = (
       select c2.venue_id
         from public.categories as c2
        where c2.id = new.category_id
     )
   limit 1;

  if found then
    -- Le message part tel quel dans l'interface : `describeError` laisse passer
    -- ce qu'il ne sait pas traduire. Nommer le produit fautif est l'essentiel —
    -- « déjà associé » sans dire à quoi obligerait à parcourir la carte.
    raise exception 'Ce code-barres est déjà associé à « % ».', conflicting_name;
  end if;

  return new;
end;
$$;
--> statement-breakpoint

-- `before` et non `after` : le refus doit empêcher l'écriture, pas la défaire.
drop trigger if exists products_barcode_unique on public.products;--> statement-breakpoint
create trigger products_barcode_unique
  before insert or update of barcode, category_id on public.products
  for each row
  execute function public.check_product_barcode_unique();--> statement-breakpoint

-- Un trigger ne s'appelle pas depuis PostgREST ; sa fonction n'a donc aucune
-- raison d'être exécutable par qui que ce soit. Postgres accorde `execute` à
-- `public` sur toute nouvelle fonction : le révoquer est ici le seul geste, il
-- n'y a rien à rouvrir derrière.
revoke execute on function public.check_product_barcode_unique() from public;--> statement-breakpoint

notify pgrst, 'reload schema';
