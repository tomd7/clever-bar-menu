ALTER TABLE "venues" ADD COLUMN "font_title" text DEFAULT 'archivo' NOT NULL;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "font_category" text DEFAULT 'archivo' NOT NULL;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "font_product" text DEFAULT 'archivo' NOT NULL;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "font_description" text DEFAULT 'archivo' NOT NULL;--> statement-breakpoint
ALTER TABLE "venues" ADD CONSTRAINT "venues_font_title_allowed" CHECK ("venues"."font_title" in ('archivo', 'playfair-display', 'newsreader', 'fredoka', 'courier-prime', 'oswald', 'caveat', 'cormorant-garamond', 'big-shoulders-display'));--> statement-breakpoint
ALTER TABLE "venues" ADD CONSTRAINT "venues_font_category_allowed" CHECK ("venues"."font_category" in ('archivo', 'playfair-display', 'newsreader', 'fredoka', 'courier-prime', 'oswald', 'caveat', 'cormorant-garamond', 'big-shoulders-display'));--> statement-breakpoint
ALTER TABLE "venues" ADD CONSTRAINT "venues_font_product_allowed" CHECK ("venues"."font_product" in ('archivo', 'playfair-display', 'newsreader', 'fredoka', 'courier-prime', 'oswald', 'caveat'));--> statement-breakpoint
ALTER TABLE "venues" ADD CONSTRAINT "venues_font_description_allowed" CHECK ("venues"."font_description" in ('archivo', 'playfair-display', 'newsreader', 'fredoka', 'courier-prime'));