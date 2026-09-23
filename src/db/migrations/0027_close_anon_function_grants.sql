-- Close `execute` to `anon` on the functions that were never meant for it.
--
-- Hand-written (drizzle-kit generate --custom): drizzle-kit describes no
-- grants on functions. Self-contained — it depends on nothing CLOCLO-32 added,
-- and can be dropped or moved without touching the two migrations before it.
--
-- Why now. Table ordering changes who may call what, and its acceptance
-- criterion is that `anon` can execute only the intended functions, checked
-- with `has_function_privilege`. Checked against the live database before this
-- file was written, `anon` could still execute `accept_order`,
-- `adjust_product_stock` and the trigger function
-- `check_product_barcode_unique` — the `revoke ... from public` of 0007, 0009
-- and 0015 closed nothing on Supabase, whose default privileges grant
-- `execute` on every new function to `anon`, `authenticated` and
-- `service_role` **by name** (`src/db/CLAUDE.md`).
--
-- No behaviour changes. `accept_order` and `adjust_product_stock` are
-- `security invoker`, so RLS already refused `anon` everything they touch; the
-- back office calls them signed in, as `authenticated`, which keeps its grant.
-- A trigger function cannot be called outside a trigger, and revoking
-- `execute` does not stop the trigger from firing — Postgres checks that
-- privilege when a trigger is created, not when it runs (verified for
-- `set_updated_at` in 0019).
--
-- What stays open to `anon`, on purpose: `place_order`, `get_order` and
-- `cancel_order`, the customer's three doors.
revoke execute on function public.accept_order(uuid) from anon;--> statement-breakpoint
revoke execute on function public.adjust_product_stock(uuid, integer) from anon;--> statement-breakpoint
revoke execute on function public.check_product_barcode_unique() from anon, authenticated;--> statement-breakpoint

notify pgrst, 'reload schema';
