CREATE UNIQUE INDEX "uniq_room_availability_room_date" ON "room_availability" USING btree ("room_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_wishlist_items_wishlist_property" ON "wishlist_items" USING btree ("wishlist_id","property_id");--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_dates_check" CHECK ("bookings"."check_out" > "bookings"."check_in");--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_nights_positive" CHECK ("bookings"."num_nights" > 0);