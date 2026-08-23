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
  // T-029 : secret TOTP base32 (stocké en clair — voir ADR-008 pour
  // le compromis "chiffrer avec master key" reporté).
  twoFactorSecret: varchar("two_factor_secret", { length: 64 }),
  // T-026 : code de parrainage personnel auto-généré
  referralCode: varchar("referral_code", { length: 12 }).unique(),
  // T-026 : préférences alertes prix
  priceAlertEnabled: boolean("price_alert_enabled").default(false),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
});

// T-026 : Alertes prix — Un user peut suivre une property et un prix
// max, on notifie si le tarif descend en-dessous (job cron futur).
export const priceAlerts = pgTable("price_alerts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  propertyId: uuid("property_id").references(() => properties.id).notNull(),
  maxPrice: decimal("max_price", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("EUR"),
  checkIn: date("check_in"),
  checkOut: date("check_out"),
  numAdults: smallint("num_adults"),
  numChildren: smallint("num_children"),
  active: boolean("active").default(true),
  // Un cron idempotent ne renvoie pas la même alerte au même tarif à
  // chaque exécution. Null = aucune notification encore envoyée.
  lastNotifiedAt: timestamp("last_notified_at"),
  lastNotifiedPrice: decimal("last_notified_price", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("uidx_price_alert_user_prop").on(table.userId, table.propertyId),
]);

// ═══════════════════════════════════════════════
// REVIEW_VOTES (T-105) — vote utile persistant, au plus un/user/avis.
// ═══════════════════════════════════════════════
export const reviewVotes = pgTable("review_votes", {
  id: uuid("id").defaultRandom().primaryKey(),
  reviewId: uuid("review_id").references(() => reviews.id).notNull(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("uniq_review_votes_review_user").on(table.reviewId, table.userId),
]);

// ═══════════════════════════════════════════════
// UPLOAD_OBJECTS (T-105) — suit les uploads privés temporaires/rattachés.
// ═══════════════════════════════════════════════
export const uploadObjects = pgTable("upload_objects", {
  key: varchar("key", { length: 500 }).primaryKey(),
  ownerId: uuid("owner_id").references(() => users.id).notNull(),
  mimeType: varchar("mime_type", { length: 100 }).notNull(),
  size: integer("size").notNull(),
  attachedAt: timestamp("attached_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ═══════════════════════════════════════════════
// EMAIL_OUTBOX (T-105) — effet externe idempotent/retryable.
// ═══════════════════════════════════════════════
export const emailOutbox = pgTable("email_outbox", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventKey: varchar("event_key", { length: 160 }).unique().notNull(),
  to: varchar("to", { length: 255 }).notNull(),
  subject: varchar("subject", { length: 255 }).notNull(),
  html: text("html").notNull(),
  text: text("text").notNull(),
  status: varchar("status", { length: 20 }).default("pending").notNull(),
  attempts: integer("attempts").default(0).notNull(),
  sentAt: timestamp("sent_at"),
  lastError: text("last_error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ═══════════════════════════════════════════════
// PROVIDER_TEST_LOGS (T-105) — historique sans secret.
// ═══════════════════════════════════════════════
export const providerTestLogs = pgTable("provider_test_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  provider: varchar("provider", { length: 32 }).notNull(),
  actorId: uuid("actor_id").references(() => users.id),
  status: varchar("status", { length: 20 }).notNull(),
  message: varchar("message", { length: 500 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [index("idx_provider_test_logs_provider_created").on(table.provider, table.createdAt)]);

// ═══════════════════════════════════════════════
// VERIFICATION_TOKENS (T-013)
// email_verification + password_reset — hashés SHA-256.
// ═══════════════════════════════════════════════
export const verificationTokens = pgTable("verification_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  tokenHash: varchar("token_hash", { length: 64 }).unique().notNull(),
  purpose: varchar("purpose", { length: 30 }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
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
  paymentIntentId: varchar("payment_intent_id", { length: 255 }),
  confirmationEmailSentAt: timestamp("confirmation_email_sent_at"),
  refundProviderId: varchar("refund_provider_id", { length: 255 }),
  // Snapshot du rate plan choisi : les modifications ultérieures d'un plan
  // ne modifient jamais une réservation déjà vendue.
  ratePlanId: uuid("rate_plan_id"),
  ratePlanName: varchar("rate_plan_name", { length: 100 }),
  ratePlanSnapshot: jsonb("rate_plan_snapshot"),
  commissionRate: decimal("commission_rate", { precision: 4, scale: 2 }).notNull(),
  commissionAmount: decimal("commission_amount", { precision: 10, scale: 2 }).notNull(),
  netToHost: decimal("net_to_host", { precision: 10, scale: 2 }).notNull(),
  cancelledAt: timestamp("cancelled_at"),
  cancellationReason: text("cancellation_reason"),
  cancellationFee: decimal("cancellation_fee", { precision: 10, scale: 2 }).default("0"),
  // Etats financiers additifs : une annulation peut être valide alors que
  // son remboursement PSP est encore en cours ou échoué.
  refundAmount: decimal("refund_amount", { precision: 10, scale: 2 }).default("0"),
  refundStatus: varchar("refund_status", { length: 20 }).default("none"),
  refundedAt: timestamp("refunded_at"),
  // Une attribution de fidélité doit être exactement une fois, après séjour.
  loyaltyAwardedAt: timestamp("loyalty_awarded_at"),
  cashbackAmount: decimal("cashback_amount", { precision: 10, scale: 2 }).default("0"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_bookings_user").on(table.userId, table.status),
  index("idx_bookings_property").on(table.propertyId, table.checkIn, table.checkOut),
  // T-012 : index dédié aux vérifications de disponibilité par chambre.
  index("idx_bookings_room_dates").on(table.roomId, table.checkIn, table.checkOut),
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
  // attachmentUrl est conservé pour les messages historiques ; les nouveaux
  // messages utilisent attachmentKey via le handler participant protégé.
  attachmentUrl: varchar("attachment_url", { length: 500 }),
  attachmentKey: varchar("attachment_key", { length: 500 }),
  attachmentMimeType: varchar("attachment_mime_type", { length: 100 }),
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

// ═══════════════════════════════════════════════
// PROVIDER_CREDENTIALS (T-103)
// Overrides de providers chiffrés AES-256-GCM. La clé maître ne vit jamais
// en DB : elle reste dans CREDENTIALS_ENCRYPTION_KEY côté environnement.
// ═══════════════════════════════════════════════
export const providerCredentials = pgTable("provider_credentials", {
  id: uuid("id").defaultRandom().primaryKey(),
  provider: varchar("provider", { length: 32 }).notNull(),
  name: varchar("name", { length: 64 }).notNull(),
  ciphertext: text("ciphertext").notNull(),
  iv: varchar("iv", { length: 32 }).notNull(),
  authTag: varchar("auth_tag", { length: 32 }).notNull(),
  updatedBy: uuid("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("uniq_provider_credentials_provider_name").on(table.provider, table.name),
  index("idx_provider_credentials_provider").on(table.provider),
]);

// ═══════════════════════════════════════════════
// APP_SETTINGS (T-021, ADR-007)
// Réglages runtime éditables par un admin sans redéploiement.
// key = identifiant de section (billing, bestrewards, cancellation, ...)
// value = objet JSONB validé côté application par un schéma Zod
//         dans src/lib/settings.ts. La table est délibérément clef/valeur
//         pour rester agnostique aux évolutions de structure.
// ═══════════════════════════════════════════════
export const appSettings = pgTable("app_settings", {
  key: varchar("key", { length: 64 }).primaryKey(),
  value: jsonb("value").notNull(),
  updatedBy: uuid("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ═══════════════════════════════════════════════
// AUDIT_LOG (T-024)
// Journal centralisé des actions admin sensibles (settings, modération
// d'avis, suspend user, validation property). Écrit en best-effort via
// `src/lib/audit.ts`. Conservé même si l'acteur est supprimé
// (actor_email copié + FK ON DELETE SET NULL).
// ═══════════════════════════════════════════════
export const auditLog = pgTable("audit_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  actorId: uuid("actor_id"),
  actorEmail: varchar("actor_email", { length: 255 }),
  action: varchar("action", { length: 64 }).notNull(),
  entityType: varchar("entity_type", { length: 32 }),
  entityId: varchar("entity_id", { length: 64 }),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_audit_log_created").on(table.createdAt),
  index("idx_audit_log_action").on(table.action, table.createdAt),
]);

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
export type AppSetting = typeof appSettings.$inferSelect;
export type NewAppSetting = typeof appSettings.$inferInsert;
export type AuditLog = typeof auditLog.$inferSelect;
export type NewAuditLog = typeof auditLog.$inferInsert;
export type PriceAlert = typeof priceAlerts.$inferSelect;
export type NewPriceAlert = typeof priceAlerts.$inferInsert;
export type ReviewVote = typeof reviewVotes.$inferSelect;
export type UploadObject = typeof uploadObjects.$inferSelect;
export type EmailOutbox = typeof emailOutbox.$inferSelect;
export type ProviderTestLog = typeof providerTestLogs.$inferSelect;
export type ProviderCredential = typeof providerCredentials.$inferSelect;
export type NewProviderCredential = typeof providerCredentials.$inferInsert;
