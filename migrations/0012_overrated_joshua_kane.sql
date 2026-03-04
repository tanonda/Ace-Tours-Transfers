ALTER TABLE "tours" RENAME TO "products";--> statement-breakpoint
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_tour_id_tours_id_fk";
--> statement-breakpoint
ALTER TABLE "pricing_versions" DROP CONSTRAINT "pricing_versions_product_id_tours_id_fk";
--> statement-breakpoint
ALTER TABLE "product_blackout_dates" DROP CONSTRAINT "product_blackout_dates_product_id_tours_id_fk";
--> statement-breakpoint
ALTER TABLE "resources" DROP CONSTRAINT "resources_product_id_tours_id_fk";
--> statement-breakpoint
ALTER TABLE "reviews" DROP CONSTRAINT "reviews_tour_id_tours_id_fk";
--> statement-breakpoint
ALTER TABLE "tour_instances" DROP CONSTRAINT "tour_instances_tour_id_tours_id_fk";
--> statement-breakpoint
ALTER TABLE "wishlist_items" DROP CONSTRAINT "wishlist_items_tour_id_tours_id_fk";
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "infant_price_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "pet_price_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_tour_id_products_id_fk" FOREIGN KEY ("tour_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pricing_versions" ADD CONSTRAINT "pricing_versions_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_blackout_dates" ADD CONSTRAINT "product_blackout_dates_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_tour_id_products_id_fk" FOREIGN KEY ("tour_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tour_instances" ADD CONSTRAINT "tour_instances_tour_id_products_id_fk" FOREIGN KEY ("tour_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_tour_id_products_id_fk" FOREIGN KEY ("tour_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;