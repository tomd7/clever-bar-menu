CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" uuid,
	"name" text NOT NULL,
	"unit_price_cents" integer,
	"quantity" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_items_quantity_positive" CHECK ("order_items"."quantity" > 0),
	CONSTRAINT "order_items_unit_price_cents_non_negative" CHECK ("order_items"."unit_price_cents" is null or "order_items"."unit_price_cents" >= 0)
);
--> statement-breakpoint
ALTER TABLE "order_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"venue_id" uuid NOT NULL,
	"customer_name" text NOT NULL,
	"note" text,
	"status" text DEFAULT 'received' NOT NULL,
	"total_cents" integer DEFAULT 0 NOT NULL,
	"access_token" uuid DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_status_valid" CHECK ("orders"."status" in ('received', 'preparing', 'ready', 'collected', 'cancelled')),
	CONSTRAINT "orders_total_cents_non_negative" CHECK ("orders"."total_cents" >= 0)
);
--> statement-breakpoint
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "orders_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_items_order_id_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "orders_venue_id_created_at_idx" ON "orders" USING btree ("venue_id","created_at");--> statement-breakpoint
CREATE POLICY "order_items_owner_read" ON "order_items" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (
        select 1 from "orders"
        join "venues" on "venues"."id" = "orders"."venue_id"
        where "orders"."id" = "order_items"."order_id"
          and "venues"."owner_id" = (select auth.uid())
      ));--> statement-breakpoint
CREATE POLICY "orders_owner_read" ON "orders" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (
        select 1 from "venues"
        where "venues"."id" = "orders"."venue_id"
          and "venues"."owner_id" = (select auth.uid())
      ));--> statement-breakpoint
CREATE POLICY "orders_owner_update" ON "orders" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (exists (
        select 1 from "venues"
        where "venues"."id" = "orders"."venue_id"
          and "venues"."owner_id" = (select auth.uid())
      )) WITH CHECK (exists (
        select 1 from "venues"
        where "venues"."id" = "orders"."venue_id"
          and "venues"."owner_id" = (select auth.uid())
      ));