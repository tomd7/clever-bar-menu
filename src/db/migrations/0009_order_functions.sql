-- Prise de commande au comptoir : les trois fonctions qui l'encadrent.
--
-- Migration écrite à la main (drizzle-kit generate --custom) : drizzle-kit ne
-- décrit pas les fonctions Postgres. Même raison qu'en 0004 et 0007.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- Pourquoi des fonctions plutôt que des policies
--
-- Le client qui commande est `anon`. Lui ouvrir `orders` en écriture
-- reviendrait à publier un `insert` libre sur Internet : la clé publiable est
-- dans le bundle, et une policy `with check (true)` laisserait écrire
-- n'importe quel total, n'importe quel statut, dans n'importe quel
-- établissement. Lui ouvrir la lecture serait pire — la commande du voisin se
-- lirait en changeant un chiffre.
--
-- `orders` et `order_items` n'ont donc **aucune policy pour `anon`**. Le client
-- passe par deux fonctions `security definer`, qui sont la seule porte et qui
-- valident tout ce qui entre. C'est le choix inverse de
-- `adjust_product_stock` (0007), volontairement : là il fallait que le RLS
-- s'applique à un compte identifié, ici il faut une porte étroite pour
-- quelqu'un qui n'a aucun droit et ne doit pas en recevoir.
--
-- `set search_path = ''` sur chacune : sans lui, un schéma placé en tête du
-- `search_path` de l'appelant pourrait fournir sa propre table `orders`. Le
-- prix est que tout est qualifié, `public.` compris.
--
-- Les paramètres portent des noms qu'aucune colonne ne porte (`guest_name` et
-- non `customer_name`, `lookup_id` et non `order_id`). Ce n'est pas du style :
-- en plpgsql, un paramètre homonyme d'une colonne visible dans la requête lève
-- une ambiguïté à l'exécution, c'est-à-dire au moment le plus tardif possible.
-- ─────────────────────────────────────────────────────────────────────────────

-- Dépose une commande. Appelée par le client, sans compte.
--
-- Rien de ce qui a une conséquence n'est repris du navigateur : ni le prix, ni
-- le nom du produit, ni le total. Le client envoie des identifiants de produits
-- et des quantités ; tout le reste est relu en base. Un total transmis par le
-- client est un total négociable.
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
    select p.id, p.name, p.price_cents,
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
  insert into public.order_items (order_id, product_id, name, unit_price_cents, quantity)
  select new_order_id, o.id, o.name, o.price_cents, o.quantity
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

-- Relit une commande, pour le client qui la suit.
--
-- Le couple identifiant + jeton fait toute la sécurité : sans le jeton, la
-- fonction ne renvoie rien — `null`, et pas une erreur. Une erreur qui dirait
-- « mauvais jeton » confirmerait que la commande existe.
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

-- Le bar prend la commande à son compte : elle passe en préparation et le
-- stock descend.
--
-- `security invoker`, contrairement aux deux précédentes : l'appelant est le
-- gérant connecté, et c'est justement le RLS qui doit vérifier que la commande
-- et les produits sont les siens. Aucune vérification de propriété n'est
-- écrite ici — les policies `orders_owner_update` et `products_owner_update`
-- la font, et une commande qui n'appartient pas à l'appelant ressort
-- simplement introuvable.
--
-- Les deux écritures sont dans la même fonction, donc dans la même
-- transaction : on ne peut pas se retrouver avec une commande acceptée dont le
-- stock n'a pas bougé, ni l'inverse. C'est aussi ce qui évite un aller-retour
-- réseau par ligne de commande.
create or replace function public.accept_order(target_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- `status = 'received'` dans le `where` et non dans un test préalable : deux
  -- écrans du bar qui acceptent la même commande en même temps ne peuvent pas
  -- décompter le stock deux fois, c'est la ligne verrouillée qui arbitre.
  update public.orders o
     set status = 'preparing',
         updated_at = now()
   where o.id = target_id
     and o.status = 'received';

  if not found then
    raise exception 'Cette commande n''est plus en attente.';
  end if;

  -- `greatest(..., 0)` : le même plancher que `adjust_product_stock`. Une
  -- commande acceptée alors qu'il ne restait pas de quoi la servir descend à
  -- zéro, elle ne passe pas en négatif — la contrainte
  -- `products_stock_quantity_non_negative` ferait sinon échouer l'acceptation
  -- entière, et le bar se retrouverait bloqué sur une commande qu'il a bien
  -- l'intention de servir.
  --
  -- Les produits sans suivi (`stock_quantity is null`) sont ignorés : ils ne
  -- se comptent pas.
  update public.products p
     set stock_quantity = greatest(p.stock_quantity - i.quantity, 0),
         updated_at = now()
    from public.order_items i
   where i.order_id = target_id
     and p.id = i.product_id
     and p.stock_quantity is not null;
end;
$$;
--> statement-breakpoint

-- Postgres accorde `execute` à `public` sur toute nouvelle fonction : le
-- révoquer est le geste qui compte, la suite ne fait que rouvrir pour les rôles
-- attendus.
revoke execute on function public.place_order(text, text, text, jsonb) from public;--> statement-breakpoint
revoke execute on function public.get_order(uuid, uuid) from public;--> statement-breakpoint
revoke execute on function public.accept_order(uuid) from public;--> statement-breakpoint

-- Les deux fonctions du client sont ouvertes à `anon` : c'est tout l'objet.
grant execute on function public.place_order(text, text, text, jsonb) to anon, authenticated;--> statement-breakpoint
grant execute on function public.get_order(uuid, uuid) to anon, authenticated;--> statement-breakpoint
-- Celle du bar ne l'est pas.
grant execute on function public.accept_order(uuid) to authenticated;--> statement-breakpoint

notify pgrst, 'reload schema';
