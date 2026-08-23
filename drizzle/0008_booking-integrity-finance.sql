ALTER TABLE "bookings" ADD COLUMN "refund_amount" numeric(10, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "refund_status" varchar(20) DEFAULT 'none';--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "refunded_at" timestamp;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "loyalty_awarded_at" timestamp;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "cashback_amount" numeric(10, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "price_alerts" ADD COLUMN "last_notified_at" timestamp;--> statement-breakpoint
ALTER TABLE "price_alerts" ADD COLUMN "last_notified_price" numeric(10, 2);