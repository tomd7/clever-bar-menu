-- Ordering by table (CLOCLO-32): `place_order` learns tables, `get_order`
-- hands them back, and `venue_tables` gets the `updated_at` trigger every table
-- spreading `timestamps` needs.
--
-- Hand-written (drizzle-kit generate --custom): drizzle-kit describes neither
-- functions nor triggers. The columns and the table are added by the previous
-- migration (`order_by_table`) — this file assumes they already exist, and the
-- order of the two files is what guarantees it. Same split as 0012/0013.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- Based on the live `place_order`, not on 0013
--
-- The `orderable` filter below carries `p.is_visible`, from CLOCLO-59
-- (`product_visibility` / `product_visibility_rules`), which the live database
-- already runs. Writing this function from 0013 would silently undo that rule
-- the minute it is applied. The consequence: this migration must run after
-- those two, and on a database without `products.is_visible` it would create
-- the function fine and fail on the first order.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- Live-deploy compatibility
--
-- The migration runs before the front end that uses it is deployed, so for a
-- while the deployed client keeps calling
-- `place_order(venue_slug, guest_name, guest_note, items)` by name. The new
-- parameter is last and defaulted, so that call still resolves, and on a venue
-- in name mode — every venue, until a manager switches — it behaves exactly as
-- before, messages included. `get_order` keeps its signature and every key it
-- returned; it only adds three.

-- 1. `updated_at` on `venue_tables`, like the five tables of 0018. `before
-- update` only: an insert already gets `now()` from the column default.
drop trigger if exists venue_tables_set_updated_at on public.venue_tables;--> statement-breakpoint
create trigger venue_tables_set_updated_at
  before update on public.venue_tables
  for each row
  execute function public.set_updated_at();--> statement-breakpoint

-- 2. `place_order` gains `guest_table`.
--
-- Not a `create or replace`: the signature changes, and Postgres would create a
-- second overload next to the first. PostgREST resolves a function by its
-- argument names, and the old four-argument call would then match both —
-- `PGRST203`, ambiguous. The old one goes first. drizzle-kit applies pending
-- migrations in one transaction, so no caller ever sees the gap.
drop function if exists public.place_order(text, text, text, jsonb);--> statement-breakpoint

-- Parameter names stay clear of every column name (`guest_table`, not
-- `table_id` nor `public_id`): in plpgsql a homonym raises an ambiguity at run
-- time. The variables follow the same rule (`chosen_number`, not `number`).
create function public.place_order(
  venue_slug text,
  guest_name text,
  guest_note text,
  items jsonb,
  guest_table text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_venue uuid;
  venue_reference text;
  venue_service text;
  venue_first_name text;
  clean_name text;
  clean_note text;
  clean_table text;
  chosen_table uuid;
  chosen_number integer;
  chosen_label text;
  wanted_lines integer;
  placed_lines integer;
  new_order_id uuid;
  new_token uuid;
  order_total integer;
begin
  clean_name := nullif(btrim(coalesce(guest_name, '')), '');
  clean_note := nullif(btrim(coalesce(guest_note, '')), '');
  clean_table := nullif(btrim(coalesce(guest_table, '')), '');

  if length(clean_note) > 300 then
    raise exception 'Ce message est trop long.';
  end if;

  -- L'établissement doit exister, ne pas être archivé, **et** avoir ouvert la
  -- prise de commande. Le drapeau est vérifié ici et pas seulement à
  -- l'affichage : cacher un bouton n'a jamais fermé une API.
  select v.id, v.order_reference, v.service_mode, v.first_name_mode
    into target_venue, venue_reference, venue_service, venue_first_name
    from public.venues v
   where v.slug = venue_slug
     and v.deleted_at is null
     and v.orders_enabled;

  if target_venue is null then
    raise exception 'Cet établissement ne prend pas de commande.';
  end if;

  -- The reference rules, per mode, re-checked here: the URL and the form are
  -- the customer's, and hiding a field closes nothing.
  if venue_reference = 'table' then
    if clean_table is null then
      raise exception 'Choisissez votre table.';
    end if;

    -- The table must belong to this venue. The public id is opaque but not a
    -- secret — the list is public, for the picker — so this is the whole
    -- guarantee: the table exists, and it is one of this venue's.
    select t.id, t.number, t.label
      into chosen_table, chosen_number, chosen_label
      from public.venue_tables t
     where t.public_id = clean_table
       and t.venue_id = target_venue;

    if chosen_table is null then
      raise exception 'Cette table n''existe pas dans cet établissement. Choisissez votre table.';
    end if;

    -- A name the venue did not ask for is dropped, not refused: a page left
    -- open from before the switch may still send one, and it harms nothing.
    if venue_first_name is distinct from 'optional' then
      clean_name := null;
    end if;
  else
    if clean_table is not null then
      raise exception 'Cet établissement ne prend pas les commandes par table.';
    end if;

    if clean_name is null then
      raise exception 'Indiquez un prénom pour qu''on vous appelle.';
    end if;
  end if;

  if length(clean_name) > 60 then
    raise exception 'Ce prénom est trop long.';
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

  -- The table's number and label are **copied**, like a line's name and
  -- price: the table will be renumbered or removed, and the order must keep
  -- saying where it went. So is the service — a name-mode order is always
  -- collected at the counter, whatever `venues.service_mode` holds.
  --
  -- Cible aliasée pour que le `returning` désigne des colonnes sans ambiguïté
  -- possible avec les variables du bloc.
  insert into public.orders as o (
    venue_id, customer_name, note, table_id, table_number, table_label, service_mode
  )
  values (
    target_venue,
    clean_name,
    clean_note,
    chosen_table,
    chosen_number,
    chosen_label,
    case when venue_reference = 'table' then venue_service else 'counter' end
  )
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

-- A new function gets `execute` from the project's default privileges, granted
-- to `anon`, `authenticated` and `service_role` **by name** — revoking `public`
-- alone would close nothing (see `src/db/CLAUDE.md`). Revoke all three API-side
-- grantees by name, then open the door to the two roles it is meant for: the
-- customer is `anon`, and a signed-in manager testing their own menu is
-- `authenticated`.
revoke execute on function public.place_order(text, text, text, jsonb, text) from public, anon, authenticated;--> statement-breakpoint
grant execute on function public.place_order(text, text, text, jsonb, text) to anon, authenticated;--> statement-breakpoint

-- 3. `get_order` hands back the table and the service. Same signature, so a
-- `create or replace` keeps the owner and the grants of 0009 — re-granting
-- here would mask a revocation made since. Every key it returned before is
-- still there: the deployed client reads them until the new one ships.
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
    'table_number', o.table_number,
    'table_label', o.table_label,
    'service_mode', o.service_mode,
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

notify pgrst, 'reload schema';
