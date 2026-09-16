CREATE TABLE "venue_themes" (
	"venue_id" uuid PRIMARY KEY NOT NULL,
	"ground_day" text NOT NULL,
	"ground_night" text NOT NULL,
	"board_day" text NOT NULL,
	"board_night" text NOT NULL,
	"on_board_day" text NOT NULL,
	"on_board_night" text NOT NULL,
	"ink_day" text NOT NULL,
	"ink_night" text NOT NULL,
	"ink_soft_day" text NOT NULL,
	"ink_soft_night" text NOT NULL,
	"accent_day" text NOT NULL,
	"accent_night" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "venue_themes_colors_format" CHECK ("venue_themes"."ground_day" ~ '^#[0-9a-f]{6}$'
        and "venue_themes"."ground_night" ~ '^#[0-9a-f]{6}$'
        and "venue_themes"."board_day" ~ '^#[0-9a-f]{6}$'
        and "venue_themes"."board_night" ~ '^#[0-9a-f]{6}$'
        and "venue_themes"."on_board_day" ~ '^#[0-9a-f]{6}$'
        and "venue_themes"."on_board_night" ~ '^#[0-9a-f]{6}$'
        and "venue_themes"."ink_day" ~ '^#[0-9a-f]{6}$'
        and "venue_themes"."ink_night" ~ '^#[0-9a-f]{6}$'
        and "venue_themes"."ink_soft_day" ~ '^#[0-9a-f]{6}$'
        and "venue_themes"."ink_soft_night" ~ '^#[0-9a-f]{6}$'
        and "venue_themes"."accent_day" ~ '^#[0-9a-f]{6}$'
        and "venue_themes"."accent_night" ~ '^#[0-9a-f]{6}$')
);
--> statement-breakpoint
ALTER TABLE "venue_themes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "venue_themes" ADD CONSTRAINT "venue_themes_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "venue_themes_public_read" ON "venue_themes" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "venue_themes_owner_insert" ON "venue_themes" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (exists (
        select 1 from "venues"
        where "venues"."id" = "venue_themes"."venue_id"
          and "venues"."owner_id" = (select auth.uid())
      ));--> statement-breakpoint
CREATE POLICY "venue_themes_owner_update" ON "venue_themes" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (exists (
        select 1 from "venues"
        where "venues"."id" = "venue_themes"."venue_id"
          and "venues"."owner_id" = (select auth.uid())
      )) WITH CHECK (exists (
        select 1 from "venues"
        where "venues"."id" = "venue_themes"."venue_id"
          and "venues"."owner_id" = (select auth.uid())
      ));--> statement-breakpoint
CREATE POLICY "venue_themes_owner_delete" ON "venue_themes" AS PERMISSIVE FOR DELETE TO "authenticated" USING (exists (
        select 1 from "venues"
        where "venues"."id" = "venue_themes"."venue_id"
          and "venues"."owner_id" = (select auth.uid())
      ));