CREATE TABLE "email_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_key" varchar(160) NOT NULL,
	"to" varchar(255) NOT NULL,
	"subject" varchar(255) NOT NULL,
	"html" text NOT NULL,
	"text" text NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"sent_at" timestamp,
	"last_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "email_outbox_event_key_unique" UNIQUE("event_key")
);
--> statement-breakpoint
CREATE TABLE "provider_test_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" varchar(32) NOT NULL,
	"actor_id" uuid,
	"status" varchar(20) NOT NULL,
	"message" varchar(500),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"review_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "upload_objects" (
	"key" varchar(500) PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"size" integer NOT NULL,
	"attached_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "price_alerts" ADD COLUMN "check_in" date;--> statement-breakpoint
ALTER TABLE "price_alerts" ADD COLUMN "check_out" date;--> statement-breakpoint
ALTER TABLE "price_alerts" ADD COLUMN "num_adults" smallint;--> statement-breakpoint
ALTER TABLE "price_alerts" ADD COLUMN "num_children" smallint;--> statement-breakpoint
ALTER TABLE "provider_test_logs" ADD CONSTRAINT "provider_test_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_votes" ADD CONSTRAINT "review_votes_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_votes" ADD CONSTRAINT "review_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upload_objects" ADD CONSTRAINT "upload_objects_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_provider_test_logs_provider_created" ON "provider_test_logs" USING btree ("provider","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_review_votes_review_user" ON "review_votes" USING btree ("review_id","user_id");