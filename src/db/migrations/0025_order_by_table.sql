CREATE TABLE "venue_tables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"venue_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"label" text,
	"public_id" text DEFAULT substr(translate(encode(decode(replace(gen_random_uuid()::text, '-', ''), 'hex'), 'base64'), '+/0123456789', '-_abcdefghij'), 1, 8) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "venue_tables_number_range" CHECK ("venue_tables"."number" between 1 and 9999),
	CONSTRAINT "venue_tables_label_length" CHECK ("venue_tables"."label" is null or char_length("venue_tables"."label") between 1 and 40),
	CONSTRAINT "venue_tables_public_id_format" CHECK ("venue_tables"."public_id" ~ '^[A-Za-z_-]{8}$')
);
--> statement-breakpoint
ALTER TABLE "venue_tables" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "customer_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "table_id" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "table_number" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "table_label" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "service_mode" text DEFAULT 'counter' NOT NULL;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "order_reference" text DEFAULT 'name' NOT NULL;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "service_mode" text DEFAULT 'counter' NOT NULL;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "first_name_mode" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "venue_tables" ADD CONSTRAINT "venue_tables_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "venue_tables_venue_id_number_unique" ON "venue_tables" USING btree ("venue_id","number");--> statement-breakpoint
CREATE UNIQUE INDEX "venue_tables_public_id_unique" ON "venue_tables" USING btree ("public_id");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_table_id_venue_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."venue_tables"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_reference_present" CHECK ("orders"."customer_name" is not null or "orders"."table_number" is not null);--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_service_mode_valid" CHECK ("orders"."service_mode" in ('counter', 'table'));--> statement-breakpoint
ALTER TABLE "venues" ADD CONSTRAINT "venues_order_reference_allowed" CHECK ("venues"."order_reference" in ('name', 'table'));--> statement-breakpoint
ALTER TABLE "venues" ADD CONSTRAINT "venues_service_mode_allowed" CHECK ("venues"."service_mode" in ('counter', 'table'));--> statement-breakpoint
ALTER TABLE "venues" ADD CONSTRAINT "venues_first_name_mode_allowed" CHECK ("venues"."first_name_mode" in ('none', 'optional'));--> statement-breakpoint
CREATE POLICY "venue_tables_public_read" ON "venue_tables" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "venue_tables_owner_insert" ON "venue_tables" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (exists (
        select 1 from "venues"
        where "venues"."id" = "venue_tables"."venue_id"
          and "venues"."owner_id" = (select auth.uid())
      ));--> statement-breakpoint
CREATE POLICY "venue_tables_owner_update" ON "venue_tables" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (exists (
        select 1 from "venues"
        where "venues"."id" = "venue_tables"."venue_id"
          and "venues"."owner_id" = (select auth.uid())
      )) WITH CHECK (exists (
        select 1 from "venues"
        where "venues"."id" = "venue_tables"."venue_id"
          and "venues"."owner_id" = (select auth.uid())
      ));--> statement-breakpoint
CREATE POLICY "venue_tables_owner_delete" ON "venue_tables" AS PERMISSIVE FOR DELETE TO "authenticated" USING (exists (
        select 1 from "venues"
        where "venues"."id" = "venue_tables"."venue_id"
          and "venues"."owner_id" = (select auth.uid())
      ));