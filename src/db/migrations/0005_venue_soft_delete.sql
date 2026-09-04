ALTER TABLE "venues" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
CREATE POLICY "venues_owner_read" ON "venues" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "venues"."owner_id");--> statement-breakpoint
ALTER POLICY "venues_public_read" ON "venues" TO anon,authenticated USING ("venues"."deleted_at" is null);