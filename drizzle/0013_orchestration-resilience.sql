ALTER TABLE "bookings" ADD COLUMN "benefits_released_at" timestamp;
--> statement-breakpoint
ALTER TABLE "email_outbox" ADD COLUMN "provider_message_id" varchar(255);
--> statement-breakpoint
ALTER TABLE "review_votes" DROP CONSTRAINT "review_votes_review_id_reviews_id_fk";
--> statement-breakpoint
ALTER TABLE "review_votes" ADD CONSTRAINT "review_votes_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "review_votes" DROP CONSTRAINT "review_votes_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "review_votes" ADD CONSTRAINT "review_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
