CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_reference" varchar(20) NOT NULL,
	"user_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"room_id" uuid NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"check_in" date NOT NULL,
	"check_out" date NOT NULL,
	"num_nights" smallint NOT NULL,
	"num_adults" smallint NOT NULL,
	"num_children" smallint DEFAULT 0,
	"guest_first_name" varchar(100) NOT NULL,
	"guest_last_name" varchar(100) NOT NULL,
	"guest_email" varchar(255) NOT NULL,
	"guest_phone" varchar(20),
	"guest_country" varchar(2),
	"trip_purpose" varchar(20),
	"special_requests" text,
	"estimated_arrival" time,
	"subtotal" numeric(10, 2) NOT NULL,
	"taxes" numeric(10, 2) DEFAULT '0',
	"fees" numeric(10, 2) DEFAULT '0',
	"discount" numeric(10, 2) DEFAULT '0',
	"total" numeric(10, 2) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"payment_status" varchar(20) DEFAULT 'pending',
	"payment_method" varchar(20),
	"commission_rate" numeric(4, 2) NOT NULL,
	"commission_amount" numeric(10, 2) NOT NULL,
	"net_to_host" numeric(10, 2) NOT NULL,
	"cancelled_at" timestamp,
	"cancellation_reason" text,
	"cancellation_fee" numeric(10, 2) DEFAULT '0',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_booking_reference_unique" UNIQUE("booking_reference")
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid,
	"user_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"last_message_at" timestamp,
	"unread_by_user" integer DEFAULT 0,
	"unread_by_host" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"sender_id" uuid NOT NULL,
	"sender_type" varchar(10) NOT NULL,
	"content" text NOT NULL,
	"attachment_url" varchar(500),
	"is_read" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promotions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(100) NOT NULL,
	"type" varchar(20) NOT NULL,
	"value" numeric(10, 2) NOT NULL,
	"min_booking_amount" numeric(10, 2) DEFAULT '0',
	"max_discount" numeric(10, 2),
	"valid_from" timestamp NOT NULL,
	"valid_until" timestamp NOT NULL,
	"max_uses" integer,
	"current_uses" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "promotions_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "properties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"host_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"type" varchar(50) NOT NULL,
	"description" text,
	"description_en" text,
	"star_rating" smallint,
	"address_line" varchar(255),
	"city" varchar(100) NOT NULL,
	"state" varchar(100),
	"country" varchar(2) NOT NULL,
	"postal_code" varchar(20),
	"latitude" numeric(10, 8),
	"longitude" numeric(11, 8),
	"timezone" varchar(50) DEFAULT 'UTC' NOT NULL,
	"check_in_from" time DEFAULT '14:00',
	"check_in_until" time DEFAULT '23:00',
	"check_out_until" time DEFAULT '11:00',
	"cancellation_policy" varchar(20) DEFAULT 'flexible',
	"pets_allowed" boolean DEFAULT false,
	"smoking_allowed" boolean DEFAULT false,
	"is_bestrewards" boolean DEFAULT false,
	"is_preferred" boolean DEFAULT false,
	"is_eco_certified" boolean DEFAULT false,
	"average_rating" numeric(3, 1),
	"total_reviews" integer DEFAULT 0,
	"commission_rate" numeric(4, 2) DEFAULT '15.00',
	"status" varchar(20) DEFAULT 'pending',
	"validated_at" timestamp,
	"validated_by" uuid,
	"amenities" jsonb DEFAULT '[]'::jsonb,
	"images" jsonb DEFAULT '[]'::jsonb,
	"main_image" varchar(500),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "properties_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "rate_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"type" varchar(30) NOT NULL,
	"discount_percentage" numeric(5, 2) DEFAULT '0',
	"includes_breakfast" boolean DEFAULT false,
	"cancellation_policy" varchar(20) NOT NULL,
	"cancellation_free_days" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"conditions" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid,
	"user_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"overall_rating" numeric(3, 1) NOT NULL,
	"cleanliness_rating" smallint,
	"comfort_rating" smallint,
	"location_rating" smallint,
	"facilities_rating" smallint,
	"staff_rating" smallint,
	"value_rating" smallint,
	"wifi_rating" smallint,
	"positive_comment" text,
	"negative_comment" text,
	"traveler_type" varchar(20),
	"is_verified" boolean DEFAULT true,
	"status" varchar(20) DEFAULT 'approved',
	"host_reply" text,
	"host_reply_at" timestamp,
	"helpful_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "reviews_booking_id_unique" UNIQUE("booking_id")
);
--> statement-breakpoint
CREATE TABLE "room_availability" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"date" date NOT NULL,
	"available_count" smallint NOT NULL,
	"price" numeric(10, 2),
	"stop_sell" boolean DEFAULT false,
	"min_stay" smallint DEFAULT 1,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"room_type" varchar(20) NOT NULL,
	"bed_configuration" jsonb,
	"max_occupancy" smallint NOT NULL,
	"max_adults" smallint NOT NULL,
	"max_children" smallint DEFAULT 0,
	"size_sqm" numeric(6, 2),
	"quantity" smallint DEFAULT 1 NOT NULL,
	"base_price" numeric(10, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'EUR',
	"amenities" jsonb DEFAULT '[]'::jsonb,
	"images" jsonb DEFAULT '[]'::jsonb,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" varchar(255) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255),
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"phone" varchar(20),
	"phone_verified" boolean DEFAULT false,
	"avatar_url" varchar(500),
	"role" varchar(20) DEFAULT 'customer' NOT NULL,
	"bestrewards_level" smallint DEFAULT 1,
	"bestrewards_bookings_count" integer DEFAULT 0,
	"wallet_balance" numeric(10, 2) DEFAULT '0.00',
	"email_verified" boolean DEFAULT false,
	"language" varchar(5) DEFAULT 'fr',
	"currency" varchar(3) DEFAULT 'EUR',
	"country" varchar(2),
	"timezone" varchar(50) DEFAULT 'UTC',
	"two_factor_enabled" boolean DEFAULT false,
	"last_login_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "wishlist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wishlist_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"added_at" timestamp DEFAULT now() NOT NULL,
	"price_alert_enabled" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "wishlists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"is_public" boolean DEFAULT false,
	"share_token" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "wishlists_share_token_unique" UNIQUE("share_token")
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_host_id_users_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_validated_by_users_id_fk" FOREIGN KEY ("validated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_plans" ADD CONSTRAINT "rate_plans_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_availability" ADD CONSTRAINT "room_availability_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_wishlist_id_wishlists_id_fk" FOREIGN KEY ("wishlist_id") REFERENCES "public"."wishlists"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlists" ADD CONSTRAINT "wishlists_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_bookings_user" ON "bookings" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "idx_bookings_property" ON "bookings" USING btree ("property_id","check_in","check_out");--> statement-breakpoint
CREATE INDEX "idx_properties_city" ON "properties" USING btree ("city","status");--> statement-breakpoint
CREATE INDEX "idx_properties_country" ON "properties" USING btree ("country","status");--> statement-breakpoint
CREATE INDEX "idx_reviews_property" ON "reviews" USING btree ("property_id","status");