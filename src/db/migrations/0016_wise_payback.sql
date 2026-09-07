CREATE TABLE "drink_catalog" (
	"gtin" text PRIMARY KEY NOT NULL,
	"name" text,
	"brand" text,
	"quantity" text,
	"photo_url" text,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "drink_catalog_gtin_format" CHECK ("drink_catalog"."gtin" ~ '^[0-9]{14}$')
);
--> statement-breakpoint
ALTER TABLE "drink_catalog" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "photo_credit" text;