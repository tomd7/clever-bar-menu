-- Actually close `execute` on `set_updated_at()`.
--
-- 0018 ends with `revoke execute ... from public` and a comment calling that
-- "the whole gesture". It is not, on Supabase. The project's default privileges
-- (`pg_default_acl`, set by both `postgres` and `supabase_admin`) grant
-- `execute` on every new function in `public` to `anon`, `authenticated` and
-- `service_role` **by name**. Revoking the `public` pseudo-role never touches
-- those grants, so after 0018 both API roles could still execute it.
--
-- For a function returning `trigger` the exposure is nil — Postgres refuses to
-- call one outside a trigger — so this changes no behaviour. It exists so the
-- grants say what 0018 claimed, and because the pattern is the trap: the same
-- `revoke ... from public` is relied on elsewhere to *restrict* functions that
-- can be called. 0018 is already applied and is not edited; history stays true.
--
-- Revoking `execute` does not stop the trigger from firing: Postgres checks
-- that privilege when the trigger is created, not each time it runs. That is
-- asserted against the live database in the same change, not assumed.
revoke execute on function public.set_updated_at() from anon, authenticated;--> statement-breakpoint

notify pgrst, 'reload schema';
