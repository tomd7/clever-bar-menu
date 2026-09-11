ALTER TABLE "venues" ADD COLUMN "logo_path" text;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "logo_plate" boolean DEFAULT false NOT NULL;