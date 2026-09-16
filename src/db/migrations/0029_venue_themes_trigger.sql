-- Custom menu colours, second half: what drizzle-kit cannot describe.
--
-- `0028_venue_themes.sql` creates `venue_themes` with its check and
-- its four policies. This file assumes it has already run — the same split as
-- `0012`/`0013` and `0025`/`0026`, and for the same reason: drizzle-kit
-- describes neither triggers nor grants, so they are written by hand next to
-- the `alter table` rather than inside a file it regenerates.
--
-- `updated_at` on `venue_themes`, like the six tables before it. The
-- `$onUpdate` in `schema.ts`'s `timestamps` helper fills Drizzle's own writes
-- only, and every application write here goes through PostgREST — so without
-- this trigger the stamp would freeze at insert time on every palette the back
-- office edits. `before update` only, never insert. Nothing adds it
-- automatically: a new table spreading `...timestamps` needs its own.

drop trigger if exists venue_themes_set_updated_at on public.venue_themes;--> statement-breakpoint
create trigger venue_themes_set_updated_at
  before update on public.venue_themes
  for each row
  execute function public.set_updated_at();--> statement-breakpoint

-- PostgREST caches the schema it exposes. A new table and a new foreign key
-- are exactly what it has to re-read: without this, `venues?select=…,
-- venue_themes(…)` answers `PGRST200` — "could not find a relationship" —
-- until the API restarts on its own.

notify pgrst, 'reload schema';
