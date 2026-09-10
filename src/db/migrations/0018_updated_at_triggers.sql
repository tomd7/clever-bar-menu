-- Keep `updated_at` true for every write, not only Drizzle's.
--
-- Hand-written (drizzle-kit generate --custom), for the reason given in 0015:
-- drizzle-kit describes neither functions nor triggers.
--
-- Why this exists. The five tables carry `updated_at default now()`, and the
-- `timestamps` helper in src/db/schema.ts adds `$onUpdate(() => new Date())`.
-- That `$onUpdate` is a Drizzle feature: it fills the value in *Drizzle's own*
-- update statements, and Drizzle is migrations-only here. Every application
-- write goes through PostgREST, which knows nothing of it — so `updated_at`
-- froze at insert time on every row the back office ever edited. Found on the
-- venue settings screen: a theme changed, its `updated_at` did not move.
--
-- The workarounds this replaces, one per author who noticed: `setOrderStatus`
-- sent the browser's clock (removed in the same change), and `accept_order`
-- (0009) and `cancel_order` (0011) set `updated_at = now()` by hand. Those two
-- are left as they are: redundant now, identical in value, and replacing a
-- `security definer`-adjacent function for no behavioural gain is the wrong
-- trade.
--
-- `before update` only, never `before insert`: an insert already gets `now()`
-- from the column default, and scripts/seed-demo.ts inserts a back-dated order
-- history on purpose — a trigger on insert would flatten it to a single instant.
--
-- A write that changes nothing does not count as a change: comparing `new` to
-- `old` before the assignment keeps `updated_at` meaning "last real change"
-- rather than "last time someone pressed Enregistrer on an untouched form".
--
-- `security invoker` and `set search_path = ''`, as in 0007 and 0015. `now()`
-- resolves regardless: `pg_catalog` is always searched.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new is not distinct from old then
    return new;
  end if;

  new.updated_at := now();
  return new;
end;
$$;
--> statement-breakpoint

drop trigger if exists venues_set_updated_at on public.venues;--> statement-breakpoint
create trigger venues_set_updated_at
  before update on public.venues
  for each row
  execute function public.set_updated_at();--> statement-breakpoint

drop trigger if exists categories_set_updated_at on public.categories;--> statement-breakpoint
create trigger categories_set_updated_at
  before update on public.categories
  for each row
  execute function public.set_updated_at();--> statement-breakpoint

drop trigger if exists products_set_updated_at on public.products;--> statement-breakpoint
create trigger products_set_updated_at
  before update on public.products
  for each row
  execute function public.set_updated_at();--> statement-breakpoint

drop trigger if exists orders_set_updated_at on public.orders;--> statement-breakpoint
create trigger orders_set_updated_at
  before update on public.orders
  for each row
  execute function public.set_updated_at();--> statement-breakpoint

drop trigger if exists order_items_set_updated_at on public.order_items;--> statement-breakpoint
create trigger order_items_set_updated_at
  before update on public.order_items
  for each row
  execute function public.set_updated_at();--> statement-breakpoint

-- A trigger function is never called through PostgREST, so nobody needs
-- `execute` on it. Postgres grants it to `public` on every new function; revoking
-- it is the whole gesture, as in 0015.
revoke execute on function public.set_updated_at() from public;--> statement-breakpoint

notify pgrst, 'reload schema';
