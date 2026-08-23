ALTER TABLE "conversations" ADD COLUMN "conversation_key" varchar(160);
--> statement-breakpoint
UPDATE "conversations"
SET "conversation_key" = CASE
  WHEN "booking_id" IS NOT NULL THEN 'booking:' || "booking_id"::text
  ELSE 'property:' || "property_id"::text || ':user:' || "user_id"::text
END;
--> statement-breakpoint
ALTER TABLE "conversations" ALTER COLUMN "conversation_key" SET NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_conversations_conversation_key" ON "conversations" USING btree ("conversation_key");
