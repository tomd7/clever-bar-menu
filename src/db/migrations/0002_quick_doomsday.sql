ALTER TABLE "venues" ALTER COLUMN "owner_id" SET DEFAULT auth.uid();--> statement-breakpoint
CREATE POLICY "categories_owner_insert" ON "categories" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (exists (
        select 1 from "venues"
        where "venues"."id" = "categories"."venue_id"
          and "venues"."owner_id" = (select auth.uid())
      ));--> statement-breakpoint
CREATE POLICY "categories_owner_update" ON "categories" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (exists (
        select 1 from "venues"
        where "venues"."id" = "categories"."venue_id"
          and "venues"."owner_id" = (select auth.uid())
      )) WITH CHECK (exists (
        select 1 from "venues"
        where "venues"."id" = "categories"."venue_id"
          and "venues"."owner_id" = (select auth.uid())
      ));--> statement-breakpoint
CREATE POLICY "categories_owner_delete" ON "categories" AS PERMISSIVE FOR DELETE TO "authenticated" USING (exists (
        select 1 from "venues"
        where "venues"."id" = "categories"."venue_id"
          and "venues"."owner_id" = (select auth.uid())
      ));--> statement-breakpoint
CREATE POLICY "products_owner_insert" ON "products" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (exists (
        select 1 from "categories"
        join "venues" on "venues"."id" = "categories"."venue_id"
        where "categories"."id" = "products"."category_id"
          and "venues"."owner_id" = (select auth.uid())
      ));--> statement-breakpoint
CREATE POLICY "products_owner_update" ON "products" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (exists (
        select 1 from "categories"
        join "venues" on "venues"."id" = "categories"."venue_id"
        where "categories"."id" = "products"."category_id"
          and "venues"."owner_id" = (select auth.uid())
      )) WITH CHECK (exists (
        select 1 from "categories"
        join "venues" on "venues"."id" = "categories"."venue_id"
        where "categories"."id" = "products"."category_id"
          and "venues"."owner_id" = (select auth.uid())
      ));--> statement-breakpoint
CREATE POLICY "products_owner_delete" ON "products" AS PERMISSIVE FOR DELETE TO "authenticated" USING (exists (
        select 1 from "categories"
        join "venues" on "venues"."id" = "categories"."venue_id"
        where "categories"."id" = "products"."category_id"
          and "venues"."owner_id" = (select auth.uid())
      ));--> statement-breakpoint
CREATE POLICY "venues_owner_insert" ON "venues" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((select auth.uid()) = "venues"."owner_id");--> statement-breakpoint
CREATE POLICY "venues_owner_update" ON "venues" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((select auth.uid()) = "venues"."owner_id") WITH CHECK ((select auth.uid()) = "venues"."owner_id");--> statement-breakpoint
CREATE POLICY "venues_owner_delete" ON "venues" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((select auth.uid()) = "venues"."owner_id");