import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  decimal,
  smallint,
  integer,
  date,
  time,
  jsonb,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ═══════════════════════════════════════════════
// USERS
// ═══════════════════════════════════════════════
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).unique().notNull(),
  passwordHash: varchar("password_hash", { length: 255 }),
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  phone: varchar("phone", { length: 20 }),
  phoneVerified: boolean("phone_verified").default(false),
  avatarUrl: varchar("avatar_url", { length: 500 }),
  role: varchar("role", { length: 20 }).default("customer").notNull(),
  bestrewardsLevel: smallint("bestrewards_level").default(1),
  bestrewardsBookingsCount: integer("bestrewards_bookings_count").default(0),
  walletBalance: decimal("wallet_balance", { precision: 10, scale: 2 }).default("0.00"),
  emailVerified: boolean("email_verified").default(false),
  language: varchar("language", { length: 5 }).default("fr"),
  currency: varchar("currency", { length: 3 }).default("EUR"),
  country: varchar("country", { length: 2 }),
  timezone: varchar("timezone", { length: 50 }).default("UTC"),
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
});

// ═══════════════════════════════════════════════
// SESSIONS
// ═══════════════════════════════════════════════
export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  token: varchar("token", { length: 255 }).unique().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ═══════════════════════════════════════════════
// PROPERTIES (HÉBERGEMENTS)
// ═══════════════════════════════════════════════
export const properties = pgTable("properties", {
  id: uuid("id").defaultRandom().primaryKey(),
  hostId: uuid("host_id").references(() => users.id).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).unique().notNull(),
  type: varchar("type", { length: 50 }).notNull(),
  description: text("description"),
  descriptionEn: text("description_en"),
  starRating: smallint("star_rating"),
  addressLine: varchar("address_line", { length: 255 }),
  city: varchar("city", { length: 100 }).notNull(),
  state: varchar("state", { length: 100 }),
  country: varchar("country", { length: 2 }).notNull(),
  postalCode: varchar("postal_code", { length: 20 }),
  latitude: decimal("latitude", { precision: 10, scale: 8 }),
  longitude: decimal("longitude", { precision: 11, scale: 8 }),
  timezone: varchar("timezone", { length: 50 }).default("UTC").notNull(),
  checkInFrom: time("check_in_from").default("14:00"),
  checkInUntil: time("check_in_until").default("23:00"),
  checkOutUntil: time("check_out_until").default("11:00"),
  cancellationPolicy: varchar("cancellation_policy", { length: 20 }).default("flexible"),
  petsAllowed: boolean("pets_allowed").default(false),
  smokingAllowed: boolean("smoking_allowed").default(false),
  isBestrewards: boolean("is_bestrewards").default(false),
  isPreferred: boolean("is_preferred").default(false),
  isEcoCertified: boolean("is_eco_certified").default(false),
  averageRating: decimal("average_rating", { precision: 3, scale: 1 }),
  totalReviews: integer("total_reviews").default(0),
  commissionRate: decimal("commission_rate", { precision: 4, scale: 2 }).default("15.00"),
  status: varchar("status", { length: 20 }).default("pending"),
  validatedAt: timestamp("validated_at"),
  validatedBy: uuid("validated_by").references(() => users.id),
  amenities: jsonb("amenities").$type<string[]>().default([]),
  images: jsonb("images").$type<string[]>().default([]),
  mainImage: varchar("main_image", { length: 500 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_properties_city").on(table.city, table.status),
  index("idx_properties_country").on(table.country, table.status),
]);

// ═══════════════════════════════════════════════
// ROOMS (CHAMBRES)
// ═══════════════════════════════════════════════
export const rooms = pgTable("rooms", {
  id: uuid("id").defaultRandom().primaryKey(),
  propertyId: uuid("property_id").references(() => properties.id).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  roomType: varchar("room_type", { length: 20 }).notNull(),
  bedConfiguration: jsonb("bed_configuration").$type<{ type: string; count: number }[]>(),
  maxOccupancy: smallint("max_occupancy").notNull(),
  maxAdults: smallint("max_adults").notNull(),
  maxChildren: smallint("max_children").default(0),
  sizeSqm: decimal("size_sqm", { precision: 6, scale: 2 }),
  quantity: smallint("quantity").default(1).notNull(),
  basePrice: decimal("base_price", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("EUR"),
  amenities: jsonb("amenities").$type<string[]>().default([]),
  images: jsonb("images").$type<string[]>().default([]),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ═══════════════════════════════════════════════
// RATE PLANS (PLANS TARIFAIRES)
// ═══════════════════════════════════════════════
export const ratePlans = pgTable("rate_plans", {
  id: uuid("id").defaultRandom().primaryKey(),
  roomId: uuid("room_id").references(() => rooms.id).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  type: varchar("type", { length: 30 }).notNull(),
  discountPercentage: decimal("discount_percentage", { precision: 5, scale: 2 }).default("0"),
  includesBreakfast: boolean("includes_breakfast").default(false),
  cancellationPolicy: varchar("cancellation_policy", { length: 20 }).notNull(),
  cancellationFreeDays: integer("cancellation_free_days").default(0),
  isActive: boolean("is_active").default(true),
  conditions: jsonb("conditions"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ═══════════════════════════════════════════════
// ROOM AVAILABILITY
// ═══════════════════════════════════════════════
export const roomAvailability = pgTable("room_availability", {
  id: uuid("id").defaultRandom().primaryKey(),
  roomId: uuid("room_id").references(() => rooms.id).notNull(),
  date: date("date").notNull(),
  availableCount: smallint("available_count").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }),
  stopSell: boolean("stop_sell").default(false),
  minStay: smallint("min_stay").default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  // T-006 (BUG-013) : un unique record par (room, date) — calendrier
  // d'inventaire journalier.
  uniqueIndex("uniq_room_availability_room_date").on(table.roomId, table.date),
]);

// ═══════════════════════════════════════════════
// BOOKINGS (RÉSERVATIONS)
// ═══════════════════════════════════════════════
export const bookings = pgTable("bookings", {
  id: uuid("id").defaultRandom().primaryKey(),
  bookingReference: varchar("booking_reference", { length: 20 }).unique().notNull(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  propertyId: uuid("property_id").references(() => properties.id).notNull(),
  roomId: uuid("room_id").references(() => rooms.id).notNull(),
  status: varchar("status", { length: 20 }).default("pending").notNull(),
  checkIn: date("check_in").notNull(),
  checkOut: date("check_out").notNull(),
  numNights: smallint("num_nights").notNull(),
  numAdults: smallint("num_adults").notNull(),
  numChildren: smallint("num_children").default(0),
  guestFirstName: varchar("guest_first_name", { length: 100 }).notNull(),
  guestLastName: varchar("guest_last_name", { length: 100 }).notNull(),
  guestEmail: varchar("guest_email", { length: 255 }).notNull(),
  guestPhone: varchar("guest_phone", { length: 20 }),
  guestCountry: varchar("guest_country", { length: 2 }),
  tripPurpose: varchar("trip_purpose", { length: 20 }),
  specialRequests: text("special_requests"),
  estimatedArrival: time("estimated_arrival"),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  taxes: decimal("taxes", { precision: 10, scale: 2 }).default("0"),
  fees: decimal("fees", { precision: 10, scale: 2 }).default("0"),
  discount: decimal("discount", { precision: 10, scale: 2 }).default("0"),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  paymentStatus: varchar("payment_status", { length: 20 }).default("pending"),
  paymentMethod: varchar("payment_method", { length: 20 }),
  commissionRate: decimal("commission_rate", { precision: 4, scale: 2 }).notNull(),
  commissionAmount: decimal("commission_amount", { precision: 10, scale: 2 }).notNull(),
  netToHost: decimal("net_to_host", { precision: 10, scale: 2 }).notNull(),
  cancelledAt: timestamp("cancelled_at"),
  cancellationReason: text("cancellation_reason"),
  cancellationFee: decimal("cancellation_fee", { precision: 10, scale: 2 }).default("0"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_bookings_user").on(table.userId, table.status),
  index("idx_bookings_property").on(table.propertyId, table.checkIn, table.checkOut),
  // T-006 (BUG-011) : garantit une réservation d'au moins 1 nuit.
  check("bookings_dates_check", sql`${table.checkOut} > ${table.checkIn}`),
  check("bookings_nights_positive", sql`${table.numNights} > 0`),
]);

// ═══════════════════════════════════════════════
// REVIEWS (AVIS VÉRIFIÉS)
// ═══════════════════════════════════════════════
export const reviews = pgTable("reviews", {
  id: uuid("id").defaultRandom().primaryKey(),
  bookingId: uuid("booking_id").references(() => bookings.id).unique(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  propertyId: uuid("property_id").references(() => properties.id).notNull(),
  overallRating: decimal("overall_rating", { precision: 3, scale: 1 }).notNull(),
  cleanlinessRating: smallint("cleanliness_rating"),
  comfortRating: smallint("comfort_rating"),
  locationRating: smallint("location_rating"),
  facilitiesRating: smallint("facilities_rating"),
  staffRating: smallint("staff_rating"),
  valueRating: smallint("value_rating"),
  wifiRating: smallint("wifi_rating"),
  positiveComment: text("positive_comment"),
  negativeComment: text("negative_comment"),
  travelerType: varchar("traveler_type", { length: 20 }),
  isVerified: boolean("is_verified").default(true),
  status: varchar("status", { length: 20 }).default("approved"),
  hostReply: text("host_reply"),
  hostReplyAt: timestamp("host_reply_at"),
  helpfulCount: integer("helpful_count").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_reviews_property").on(table.propertyId, table.status),
]);

// ═══════════════════════════════════════════════
// FAVORITES / WISHLISTS
// ═══════════════════════════════════════════════
export const wishlists = pgTable("wishlists", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  isPublic: boolean("is_public").default(false),
  shareToken: varchar("share_token", { length: 100 }).unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const wishlistItems = pgTable("wishlist_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  wishlistId: uuid("wishlist_id").references(() => wishlists.id).notNull(),
  propertyId: uuid("property_id").references(() => properties.id).notNull(),
  addedAt: timestamp("added_at").defaultNow().notNull(),
  priceAlertEnabled: boolean("price_alert_enabled").default(false),
}, (table) => [
  // T-006 (BUG-012) : un hébergement au plus une fois par wishlist.
  uniqueIndex("uniq_wishlist_items_wishlist_property").on(table.wishlistId, table.propertyId),
]);

// ═══════════════════════════════════════════════
// MESSAGES
// ═══════════════════════════════════════════════
export const conversations = pgTable("conversations", {
  id: uuid("id").defaultRandom().primaryKey(),
  bookingId: uuid("booking_id").references(() => bookings.id),
  userId: uuid("user_id").references(() => users.id).notNull(),
  propertyId: uuid("property_id").references(() => properties.id).notNull(),
  lastMessageAt: timestamp("last_message_at"),
  unreadByUser: integer("unread_by_user").default(0),
  unreadByHost: integer("unread_by_host").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const messages = pgTable("messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  conversationId: uuid("conversation_id").references(() => conversations.id).notNull(),
  senderId: uuid("sender_id").references(() => users.id).notNull(),
  senderType: varchar("sender_type", { length: 10 }).notNull(),
  content: text("content").notNull(),
  attachmentUrl: varchar("attachment_url", { length: 500 }),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ═══════════════════════════════════════════════
// PROMOTIONS
// ═══════════════════════════════════════════════
export const promotions = pgTable("promotions", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: varchar("code", { length: 50 }).unique().notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  type: varchar("type", { length: 20 }).notNull(),
  value: decimal("value", { precision: 10, scale: 2 }).notNull(),
  minBookingAmount: decimal("min_booking_amount", { precision: 10, scale: 2 }).default("0"),
  maxDiscount: decimal("max_discount", { precision: 10, scale: 2 }),
  validFrom: timestamp("valid_from").notNull(),
  validUntil: timestamp("valid_until").notNull(),
  maxUses: integer("max_uses"),
  currentUses: integer("current_uses").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Type exports
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Property = typeof properties.$inferSelect;
export type NewProperty = typeof properties.$inferInsert;
export type Room = typeof rooms.$inferSelect;
export type NewRoom = typeof rooms.$inferInsert;
export type Booking = typeof bookings.$inferSelect;
export type NewBooking = typeof bookings.$inferInsert;
export type Review = typeof reviews.$inferSelect;
export type NewReview = typeof reviews.$inferInsert;
