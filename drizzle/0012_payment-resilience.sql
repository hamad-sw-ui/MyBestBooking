CREATE TABLE "payment_event_inbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_event_id" varchar(255) NOT NULL,
	"type" varchar(100) NOT NULL,
	"payment_intent_id" varchar(255) NOT NULL,
	"refund_id" varchar(255),
	"status" varchar(32) NOT NULL,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payment_event_inbox_provider_event_id_unique" UNIQUE("provider_event_id")
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "payment_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "promotion_id" uuid;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "wallet_credits_used" numeric(10, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "email_outbox" ADD COLUMN "claimed_at" timestamp;--> statement-breakpoint
ALTER TABLE "email_outbox" ADD COLUMN "failed_at" timestamp;--> statement-breakpoint
ALTER TABLE "upload_objects" ADD COLUMN "message_id" uuid;