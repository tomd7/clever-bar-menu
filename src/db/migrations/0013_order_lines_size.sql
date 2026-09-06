-- Le format servi suit la commande : `place_order` le recopie, `get_order` le
-- rend au client qui suit sa commande.
--
-- Migration écrite à la main (drizzle-kit generate --custom) : drizzle-kit ne
-- décrit pas les fonctions Postgres. Même raison qu'en 0004, 0007, 0009 et 0011.
-- La colonne `order_items.size`, elle, est ajoutée par la migration 0012 —
-- celle-ci suppose donc qu'elle existe déjà, et l'ordre des deux fichiers est
-- ce qui le garantit.
--
-- Pourquoi le format est recopié dans la ligne plutôt que relu par
-- `product_id` : la ligne est une trace, comme le nom et le prix unitaire, et
-- le produit sera renommé, reformaté, retiré. Mais la raison pour laquelle il
-- est recopié *tout court* est le comptoir — deux lignes « Blonde » sur un
-- ticket, l'une en 25cl et l'autre en 50cl, forment un ticket qu'il faut
-- deviner. Dès que la carte porte un format, il fait la moitié de ce qui
-- identifie une ligne.
--
-- Les deux fonctions gardent leur signature : un `create or replace` suffit, et
-- rien de ce qui les appelle ne change de forme.

-- Dépose une commande. Identique à la version de 0009, à ceci près que
-- `orderable` remonte aussi `p.size` et que l'insertion le recopie.
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
       -- Les deux mêmes conditions que la carte publique : un produit retiré à
       -- la main ou épuisé n'est pas commandable. Les répéter ici est le seul
       -- moyen d'être sûr — la carte affichée peut dater de dix minutes.
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

-- Relit une commande, pour le client qui la suit. Identique à la version de
-- 0009, augmentée du format de chaque ligne — sans lui, le suivi afficherait
-- « Blonde » là où le panier disait « Blonde 50cl ».
create or replace function public.get_order(
  lookup_id uuid,
  lookup_token uuid
)
returns jsonb
language sql
security definer
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', o.id,
    'customer_name', o.customer_name,
    'note', o.note,
    'status', o.status,
    'total_cents', o.total_cents,
    'created_at', o.created_at,
    'updated_at', o.updated_at,
    'items', coalesce(
      (
        select jsonb_agg(
                 jsonb_build_object(
                   'id', i.id,
                   'name', i.name,
                   'size', i.size,
                   'unit_price_cents', i.unit_price_cents,
                   'quantity', i.quantity
                 )
                 order by i.created_at, i.name
               )
          from public.order_items i
         where i.order_id = o.id
      ),
      '[]'::jsonb
    )
  )
  from public.orders o
  where o.id = lookup_id
    and o.access_token = lookup_token;
$$;
--> statement-breakpoint

-- Les droits ne sont pas repris : `create or replace` conserve le
-- propriétaire et les `grant` posés en 0009. Les redonner ici masquerait une
-- révocation faite entre-temps.

notify pgrst, 'reload schema';
