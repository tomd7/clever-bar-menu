-- `products.is_visible` splits « hidden » from « out of stock ». Until now the
-- one switch did both: a product unavailable by hand, or at zero stock, was
-- simply gone from the customer's menu. From here on, hidden means gone, and
-- out of stock means listed, marked « épuisé », not orderable.
--
-- Hand-written migration (drizzle-kit generate --custom): drizzle-kit describes
-- neither data backfills nor Postgres functions. The column itself is added by
-- 0022 — this file assumes it already exists, and the order of the two files is
-- what guarantees it. Same split as 0012/0013 and 0014/0015.

-- 1. What a customer sees must not change the minute this runs.
--
-- The « Rupture » switch was the only way to take a product off a menu, and
-- managers used it for both reasons — a pierced keg and a drink out of season.
-- Every product unavailable by hand was hidden, as far as a customer could
-- tell, so it stays hidden. `is_available` is left untouched: putting one back
-- on the menu shows it sold out until it is put back on sale, which loses
-- nothing either flag said.
--
-- Products at zero stock are deliberately **not** hidden here. Their sold-out
-- state is derived, and hiding them would keep them off the menu after the
-- next delivery — the one thing the derivation exists to avoid. They now show
-- as « épuisé » instead of vanishing; that is the change this migration ships.
--
-- The `before update` trigger of 0018 stamps `updated_at` on these rows, which
-- is accurate: their visibility did change.
update public.products
   set is_visible = false
 where not is_available;
--> statement-breakpoint

-- 2. `place_order` refuses a hidden product too.
--
-- Identical to the version of 0013, except for `and p.is_visible` in
-- `orderable`. Checked in SQL and not only by the menu's filter: a menu left
-- open in a tab can be older than the manager's gesture, and hiding a line
-- from a page never closed an API. Same signature, so a `create or replace`
-- keeps the owner and the grants of 0009 — re-granting here would mask a
-- revocation made since.
create or replace function public.place_order(
  venue_slug text,
  guest_name text,
  guest_note text,
  items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_venue uuid;
  clean_name text;
  clean_note text;
  wanted_lines integer;
  placed_lines integer;
  new_order_id uuid;
  new_token uuid;
  order_total integer;
begin
  clean_name := nullif(btrim(coalesce(guest_name, '')), '');
  if clean_name is null then
    raise exception 'Indiquez un prénom pour qu''on vous appelle.';
  end if;
  if length(clean_name) > 60 then
    raise exception 'Ce prénom est trop long.';
  end if;

  clean_note := nullif(btrim(coalesce(guest_note, '')), '');
  if length(clean_note) > 300 then
    raise exception 'Ce message est trop long.';
  end if;

  -- L'établissement doit exister, ne pas être archivé, **et** avoir ouvert la
  -- prise de commande. Le drapeau est vérifié ici et pas seulement à
  -- l'affichage : cacher un bouton n'a jamais fermé une API.
  select v.id into target_venue
    from public.venues v
   where v.slug = venue_slug
     and v.deleted_at is null
     and v.orders_enabled;

  if target_venue is null then
    raise exception 'Cet établissement ne prend pas de commande.';
  end if;

  if jsonb_typeof(items) is distinct from 'array' or jsonb_array_length(items) = 0 then
    raise exception 'Votre commande est vide.';
  end if;
  if jsonb_array_length(items) > 40 then
    raise exception 'Cette commande est trop longue. Passez-la en deux fois.';
  end if;

  -- Les types sont vérifiés avant d'être convertis : un `::int` sur du texte
  -- lèverait une erreur Postgres en anglais, qui remonterait telle quelle dans
  -- l'interface via `describeError`.
  if exists (
    select 1 from jsonb_array_elements(items) as line
     where jsonb_typeof(line->'product_id') is distinct from 'string'
        or jsonb_typeof(line->'quantity') is distinct from 'number'
  ) then
    raise exception 'Commande illisible.';
  end if;

  -- Cible aliasée pour que le `returning` désigne des colonnes sans ambiguïté
  -- possible avec les variables du bloc.
  insert into public.orders as o (venue_id, customer_name, note)
  values (target_venue, clean_name, clean_note)
  returning o.id, o.access_token into new_order_id, new_token;

  -- Les lignes sont regroupées par produit : deux entrées pour la même
  -- référence deviennent une ligne de quantité 2, jamais deux lignes. Le
  -- décompte du stock, plus tard, fait un `update ... from` qui ne verrait
  -- qu'une des deux.
  --
  -- La quantité est bornée en SQL et pas seulement dans le formulaire : 20
  -- pintes du même fût est déjà généreux, et c'est ce plafond qui limite ce
  -- qu'un envoi malveillant peut inscrire.
  with requested as (
    select (line->>'product_id')::uuid as product_id,
           sum(least(greatest((line->>'quantity')::int, 1), 20)) as quantity
      from jsonb_array_elements(items) as line
     group by 1
  ),
  orderable as (
    select p.id, p.name, p.size, p.price_cents,
           least(r.quantity, 20)::smallint as quantity
      from requested r
      join public.products p on p.id = r.product_id
      join public.categories c on c.id = p.category_id
     where c.venue_id = target_venue
       -- A hidden product is not on the menu, so it is not orderable: the
       -- same filter as `fetchPublicMenu`.
       and p.is_visible
       -- And a listed one must not be sold out — by hand, or at zero stock.
       -- The same rule as `isSoldOut` (`features/menu/stock.ts`); the two
       -- change together. Repeating both here is the only way to be sure: the
       -- menu on the customer's screen may be ten minutes old.
       and p.is_available
       and (p.stock_quantity is null or p.stock_quantity > 0)
  )
  insert into public.order_items (order_id, product_id, name, size, unit_price_cents, quantity)
  select new_order_id, o.id, o.name, o.size, o.price_cents, o.quantity
    from orderable o;

  get diagnostics placed_lines = row_count;

  select count(distinct (line->>'product_id')::uuid) into wanted_lines
    from jsonb_array_elements(items) as line;

  -- Une ligne perdue en route ne passe pas en silence. Entre le moment où la
  -- carte s'est affichée et l'envoi, un produit a pu être retiré ou vidé ;
  -- servir la commande amputée ferait découvrir le manque au comptoir, ce qui
  -- est exactement le moment où il est le plus pénible.
  if placed_lines <> wanted_lines then
    raise exception 'Un produit de votre commande vient de partir. Rechargez la carte.';
  end if;

  -- Les lignes sans prix ne pèsent rien dans le total : la carte les affiche
  -- déjà sans prix (plat du jour, suggestion), et elles s'ajustent au comptoir.
  select coalesce(sum(coalesce(i.unit_price_cents, 0) * i.quantity), 0)
    into order_total
    from public.order_items i
   where i.order_id = new_order_id;

  update public.orders o
     set total_cents = order_total
   where o.id = new_order_id;

  -- Le jeton ne repart qu'ici, une seule fois : c'est ce qui permettra au
  -- téléphone de relire sa commande, et il ne transite par aucune URL.
  return jsonb_build_object('id', new_order_id, 'access_token', new_token);
end;
$$;
--> statement-breakpoint

notify pgrst, 'reload schema';
