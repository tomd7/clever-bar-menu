ALTER TABLE "products" ADD COLUMN "stock_quantity" integer;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "low_stock_threshold" integer;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_stock_quantity_non_negative" CHECK ("products"."stock_quantity" is null or "products"."stock_quantity" >= 0);--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_low_stock_threshold_non_negative" CHECK ("products"."low_stock_threshold" is null or "products"."low_stock_threshold" >= 0);