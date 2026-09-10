ALTER TABLE "bookings" ADD COLUMN "request_expires_at" timestamp;
CREATE INDEX "idx_bookings_request_expires" ON "bookings" USING btree ("status", "request_expires_at");
