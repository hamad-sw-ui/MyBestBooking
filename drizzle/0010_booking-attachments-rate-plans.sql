ALTER TABLE "bookings" ADD COLUMN "confirmation_email_sent_at" timestamp;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "refund_provider_id" varchar(255);--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "rate_plan_id" uuid;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "rate_plan_name" varchar(100);--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "rate_plan_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "attachment_key" varchar(500);--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "attachment_mime_type" varchar(100);