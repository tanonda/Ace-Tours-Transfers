import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, decimal, boolean, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  role: text("role").notNull().default("customer"), // 'admin', 'field_service', 'customer'
  name: text("name").notNull(),
  phone: text("phone"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  isActive: boolean("is_active").notNull().default(true),
  passwordResetToken: text("password_reset_token"),
  passwordResetTokenExpiry: timestamp("password_reset_token_expiry", { withTimezone: true }),
});

export const tours = pgTable("tours", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  price: text("price").notNull(), // DEPRECATED: use adultPriceCents
  childPrice: text("child_price"), // DEPRECATED: use childPriceCents
  adultPriceCents: integer("adult_price_cents").notNull().default(0),
  childPriceCents: integer("child_price_cents").notNull().default(0),
  // Group / package pricing (added in migration 0013)
  pricingType: text("pricing_type").notNull().default("per_person"), // 'per_person' | 'group'
  groupPriceCents: integer("group_price_cents").notNull().default(0), // flat rate for group bookings
  groupMaxPax: integer("group_max_pax"), // optional display hint — max guests included in package
  duration: text("duration").notNull(),
  minPax: text("min_pax"),
  image: text("image").notNull(),
  description: text("description").array().notNull(),
  category: text("category").notNull(), // 'tour', 'transfer', or 'vehicle'
  isActive: boolean("is_active").notNull().default(true),
  // DEPRECATED: Use defaultCapacity instead. This column will be removed in v2.0
  // Keeping for backward compatibility only. Do not use in new code.
  capacity: integer("capacity").notNull().default(999),
  defaultCapacity: integer("default_capacity").notNull().default(20),
  vehicleDetails: jsonb("vehicle_details"), // { make, model, seats, transmission, features[] }
});

export const tourInstances = pgTable("tour_instances", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tourId: varchar("tour_id").notNull().references(() => tours.id),
  serviceDate: text("service_date").notNull(),
  timeSlot: text("time_slot"), // optional time slot
  startTime: text("start_time"), // HH:MM format, null = full day (Phase 2)
  endTime: text("end_time"),     // HH:MM format, null = full day (Phase 2)
  totalCapacity: integer("total_capacity").notNull(),
  confirmedCount: integer("confirmed_count").notNull().default(0),
  heldCount: integer("held_count").notNull().default(0),
  blockedCount: integer("blocked_count").notNull().default(0),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  // Unique constraint expanded to include start/end times so multiple
  // sessions per day can be represented without relying solely on `timeSlot`.
  instanceUniqueIdx: uniqueIndex("idx_tour_instances_unique")
    .on(table.tourId, table.serviceDate, table.timeSlot, table.startTime, table.endTime)
}));

// Phase 1: Resources table for asset-allocated products (vehicles, specific transfer buses)
export const resources = pgTable("resources", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").notNull().references(() => tours.id),
  name: text("name").notNull(), // e.g. "Toyota Hilux #1", "Airport Bus A"
  seatCapacity: integer("seat_capacity").notNull(), // vehicle seats or bus capacity
  status: text("status").notNull().default("active"), // 'active', 'maintenance'
  metadata: jsonb("metadata"), // { licensePlate, color, etc. }
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const availabilityHolds = pgTable("availability_holds", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tourInstanceId: varchar("tour_instance_id").notNull().references(() => tourInstances.id),
  resourceId: varchar("resource_id").references(() => resources.id), // Phase 1: tracks specific vehicle/asset
  quantity: integer("quantity").notNull(),
  status: text("status").notNull().default("ACTIVE"), // 'ACTIVE', 'EXPIRED', 'CONFIRMED', 'RELEASED'
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  bookingSessionId: text("booking_session_id").notNull(),
}, (table) => ({
  expiryIdx: index("idx_availability_holds_expiry").on(table.status, table.expiresAt),
}));

// CRIT-3 DOCUMENTATION:
// For multi-item bookings, `tourId`, `date`, `tourName`, and `holdId` reflect the FIRST ITEM only.
// The authoritative source of item-level data is the `bookingItems` table.
// All hold IDs for the order are tracked via `bookingSessionId`, not `holdId`.
// These top-level fields exist for quick display/admin reference, NOT for business logic.
export const bookings = pgTable("bookings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  bookingSessionId: text("booking_session_id").notNull().default(""), // Authoritative: links ALL holds for this booking
  idempotencyKey: varchar("idempotency_key").unique(), // Phase 6: prevents double-booking
  tourId: varchar("tour_id").notNull().references(() => tours.id), // CRIT-3: Display-only, first item's product
  tourInstanceId: varchar("tour_instance_id").references(() => tourInstances.id),
  holdId: varchar("hold_id").references(() => availabilityHolds.id), // CRIT-3: Display-only, first item's hold
  date: text("date").notNull(), // CRIT-3: Display-only, first item's date
  startTime: text("start_time"), // Phase 2: HH:MM format
  endTime: text("end_time"),     // Phase 2: HH:MM format
  guests: integer("guests").notNull(),
  amount: text("amount").notNull(), // @deprecated MED-2: Use totalAmountCents instead. Kept for backward compat.
  totalAmountCents: integer("total_amount_cents").notNull().default(0), // AUTHORITATIVE price field
  currency: varchar("currency", { length: 3 }).notNull().default("VUV"),
  adultPaxTotal: integer("adult_pax_total").notNull().default(0),
  childPaxTotal: integer("child_pax_total").notNull().default(0),
  infantPaxTotal: integer("infant_pax_total").notNull().default(0),  // Infants under 2 — no pricing impact
  petPaxTotal: integer("pet_pax_total").notNull().default(0),     // Pets — no pricing impact
  status: text("status").notNull().default("pending"), // 'pending', 'confirmed', 'completed', 'cancelled', 'failed'
  paymentReference: text("payment_reference"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull().default(""),
  customerPhone: text("customer_phone"),
  tourName: text("tour_name").notNull(),
  pickupLocation: text("pickup_location"), // Phase 4 readiness: stores customer pickup details
  confirmedAt: timestamp("confirmed_at"),  // Phase 4 readiness: tracked for production reporting
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  archivedAt: timestamp("archived_at"),    // Used for soft deletion of bookings
  notes: text("notes"),
  // Fraud detection fields (added in migration 0005)
  fraudScore: integer("fraud_score"),                 // 0–100 risk score
  fraudLevel: varchar("fraud_level", { length: 10 }), // 'low' | 'medium' | 'high' | 'critical'
  fraudSignals: jsonb("fraud_signals"),               // string[] of signal codes
  fraudReviewedAt: timestamp("fraud_reviewed_at"),    // when an admin approved/dismissed
  fraudReviewedBy: varchar("fraud_reviewed_by").references(() => users.id),
}, (table) => ({
  holdUniqueIdx: uniqueIndex("idx_bookings_hold_unique").on(table.holdId),
}));

export const bookingItems = pgTable("booking_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bookingId: varchar("booking_id").notNull().references(() => bookings.id, { onDelete: "cascade" }),
  productType: text("product_type").notNull(), // 'tour', 'transfer', 'vehicle'
  productId: varchar("product_id").notNull(),
  productName: text("product_name").notNull(),
  quantity: integer("quantity").notNull().default(1),
  unitPriceCents: integer("unit_price_cents").notNull(),
  subtotalCents: integer("subtotal_cents").notNull(),
  adultPax: integer("adult_pax").notNull().default(0),
  childPax: integer("child_pax").notNull().default(0),
  infantPax: integer("infant_pax").notNull().default(0),  // Infants under 2 — manifesting only
  petPax: integer("pet_pax").notNull().default(0),     // Pets — manifesting only
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// CMS Content Blocks - for toggling site sections on/off
export const contentBlocks = pgTable("content_blocks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  slug: text("slug").notNull().unique(), // e.g., 'hero', 'featured-tours', 'promotions'
  label: text("label").notNull(),
  description: text("description"),
  enabled: boolean("enabled").notNull().default(true),
  config: jsonb("config"), // Additional configuration options
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Site Settings - for WhatsApp, general configs
export const siteSettings = pgTable("site_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(), // e.g., 'whatsapp_number', 'whatsapp_greeting'
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Payment Gateways - ANZ, BRED, BSP configurations
export const paymentGateways = pgTable("payment_gateways", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  slug: text("slug").notNull().unique(), // 'anz-egate', 'bred', 'bsp'
  displayName: text("display_name").notNull(),
  description: text("description"),
  active: boolean("active").notNull().default(false),
  isDefault: boolean("is_default").notNull().default(false),
  priority: integer("priority").notNull().default(0), // NEW: Priority for failover logic
  credentials: jsonb("credentials"), // Encrypted credentials stored as JSON
  supportedCurrencies: jsonb("supported_currencies").default(sql`'["VUV"]'`),
  config: jsonb("config"), // Gateway-specific configuration
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Wishlist Items - for saving tours/transfers
export const wishlistItems = pgTable("wishlist_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  tourId: varchar("tour_id").notNull().references(() => tours.id),
  addedAt: timestamp("added_at").notNull().defaultNow(),
});

// Add-on Products (e.g., lunch, snorkeling gear, insurance)
export const addons = pgTable("addons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  priceCents: integer("price_cents").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Link between bookings and addons
export const bookingAddons = pgTable("booking_addons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bookingId: varchar("booking_id").notNull().references(() => bookings.id, { onDelete: "cascade" }),
  addonId: varchar("addon_id").notNull().references(() => addons.id),
  unitPriceCents: integer("unit_price_cents").notNull(),
  quantity: integer("quantity").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Newsletter Subscribers
export const newsletterSubscribers = pgTable("newsletter_subscribers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  name: text("name"),
  locale: text("locale").default("en"),
  source: text("source").default("website"), // 'website', 'footer', 'popup'
  subscribedAt: timestamp("subscribed_at").notNull().defaultNow(),
  confirmed: boolean("confirmed").notNull().default(false),
  unsubscribedAt: timestamp("unsubscribed_at"),
});

// CMS Content Entries - for editable content with descriptions and images
export const cmsContent = pgTable("cms_content", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  blockSlug: text("block_slug").notNull(), // references content_blocks slug
  contentKey: text("content_key").notNull(), // e.g., 'heading', 'description', 'image'
  contentType: text("content_type").notNull().default("text"), // 'text', 'image', 'richtext'
  value: text("value"), // The actual content or image URL
  locale: text("locale").default("en"), // For i18n support
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Payment Transactions
export const payments = pgTable("payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bookingId: varchar("booking_id").notNull().references(() => bookings.id),
  gatewayId: varchar("gateway_id").notNull().references(() => paymentGateways.id),
  amount: integer("amount").notNull(), // Amount in smallest currency unit (e.g., cents/vatu)
  currency: text("currency").notNull().default("VUV"),
  status: text("status").notNull().default("pending"), // 'pending', 'processing', 'completed', 'failed', 'refunded'
  gatewayReference: text("gateway_reference"), // External reference from bank
  gatewayResponse: jsonb("gateway_response"), // Full response from gateway
  metadata: jsonb("metadata"), // Additional payment data
  expiresAt: timestamp("expires_at"),
  failureReason: text("failure_reason"),
  reconciledBy: varchar("reconciled_by").references(() => users.id),
  reconciliationNote: text("reconciliation_note"),
  lastReconciledAt: timestamp("last_reconciled_at"),
  reconciliationAttempts: integer("reconciliation_attempts").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  reconciliationStaleIdx: index("idx_payments_reconciliation_stale")
    .on(table.status, table.lastReconciledAt, table.createdAt)
    .where(sql`status = 'processing'`),
  pendingExpiryIdx: index("idx_payments_pending_expiry")
    .on(table.status, table.expiresAt)
    .where(sql`status IN ('pending', 'processing')`),
}));

export const featureFlags = pgTable("feature_flags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  slug: text("slug").notNull().unique(), // e.g., 'client-dashboard', 'reviews-system'
  enabled: boolean("enabled").notNull().default(false),
  displayName: text("display_name").notNull(),
  description: text("description"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// PROJECTIONS (Read Models)

export const bookingSummaries = pgTable("booking_summaries", {
  bookingId: varchar("booking_id").primaryKey(),
  customerEmail: text("customer_email").notNull(),
  customerName: text("customer_name").notNull(),
  totalAmount: integer("total_amount").notNull(),
  currency: text("currency").notNull(),
  status: text("status").notNull(),
  createdAt: timestamp("created_at").notNull(),
  confirmedAt: timestamp("confirmed_at"),
});

export const revenueDaily = pgTable("revenue_daily", {
  date: text("date").primaryKey(), // YYYY-MM-DD
  totalGross: integer("total_gross").notNull().default(0),
  totalVat: integer("total_vat").notNull().default(0),
  currency: text("currency").notNull().default("VUV"),
});

export const paymentOverviews = pgTable("payment_overviews", {
  paymentId: varchar("payment_id").primaryKey(),
  bookingId: varchar("booking_id").notNull(),
  method: text("method").notNull(),
  status: text("status").notNull(),
  amount: integer("amount").notNull(),
  currency: text("currency").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Phase 4: Blackout dates per product (tours, transfers, vehicles)
export const productBlackoutDates = pgTable("product_blackout_dates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").notNull().references(() => tours.id),
  date: text("date").notNull(),       // YYYY-MM-DD
  reason: text("reason"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  uniqueIdx: index("idx_blackout_unique").on(table.productId, table.date),
}));

// Phase 5: Pricing version history
export const pricingVersions = pgTable("pricing_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").notNull().references(() => tours.id),
  effectiveFrom: text("effective_from").notNull(), // YYYY-MM-DD
  adultPriceCents:  integer("adult_price_cents").notNull().default(0),
  childPriceCents:  integer("child_price_cents").notNull().default(0),
  // Extended pricing fields (added in migration 0013)
  infantPriceCents: integer("infant_price_cents").notNull().default(0),
  petPriceCents:    integer("pet_price_cents").notNull().default(0),
  pricingType:      text("pricing_type").notNull().default("per_person"), // 'per_person' | 'group'
  groupPriceCents:  integer("group_price_cents").notNull().default(0),
  ruleMetadata: jsonb("rule_metadata"), // { groupDiscountThreshold, seasonalRules, etc. }
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: varchar("created_by").references(() => users.id),
}, (table) => ({
  effectiveIdx: index("idx_pricing_effective").on(table.productId, table.effectiveFrom),
}));

// Phase 7: Capacity audit log
export const capacityAuditLog = pgTable("capacity_audit_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tourInstanceId: varchar("tour_instance_id").references(() => tourInstances.id),
  productId: varchar("product_id").notNull(),
  action: text("action").notNull(), // 'hold_created', 'hold_expired', 'booking_confirmed', 'booking_cancelled', 'manual_adjustment'
  quantity: integer("quantity"),
  previousState: jsonb("previous_state"), // { confirmedCount, heldCount, blockedCount }
  newState: jsonb("new_state"),
  performedBy: varchar("performed_by"), // userId or 'system'
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Admin Action Audit Log — tracks sensitive admin mutations for compliance/paper trail
export const adminAuditLog = pgTable("admin_audit_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  action: text("action").notNull(),       // e.g. 'gateway.update', 'flag.toggle', 'booking.confirm'
  entityType: text("entity_type").notNull(), // 'payment_gateway' | 'feature_flag' | 'booking' | 'site_settings' | 'system'
  entityId: text("entity_id"),            // gateway slug / flag key / booking id / etc.
  entityName: text("entity_name"),        // human-readable label
  performedBy: text("performed_by"),      // userId
  previousValue: jsonb("previous_value"), // before snapshot (credentials redacted)
  newValue: jsonb("new_value"),           // after snapshot  (credentials redacted)
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type AdminAuditLog = typeof adminAuditLog.$inferSelect;
export type InsertAdminAuditLog = typeof adminAuditLog.$inferInsert;


// Relations
export const usersRelations = relations(users, ({ many }) => ({
  bookings: many(bookings),
}));

export const toursRelations = relations(tours, ({ many }) => ({
  bookings: many(bookings),
  resources: many(resources),
  blackoutDates: many(productBlackoutDates),
  pricingVersions: many(pricingVersions),
}));

export const resourcesRelations = relations(resources, ({ one, many }) => ({
  product: one(tours, {
    fields: [resources.productId],
    references: [tours.id],
  }),
  holds: many(availabilityHolds),
}));

export const bookingsRelations = relations(bookings, ({ one, many }) => ({
  user: one(users, {
    fields: [bookings.userId],
    references: [users.id],
  }),
  tour: one(tours, {
    fields: [bookings.tourId],
    references: [tours.id],
  }),
  tourInstance: one(tourInstances, {
    fields: [bookings.tourInstanceId],
    references: [tourInstances.id],
  }),
  hold: one(availabilityHolds, {
    fields: [bookings.holdId],
    references: [availabilityHolds.id],
  }),
  payments: many(payments),
  items: many(bookingItems),
  addons: many(bookingAddons),
}));

export const bookingItemsRelations = relations(bookingItems, ({ one }) => ({
  booking: one(bookings, {
    fields: [bookingItems.bookingId],
    references: [bookings.id],
  }),
}));

export const tourInstancesRelations = relations(tourInstances, ({ one, many }) => ({
  tour: one(tours, {
    fields: [tourInstances.tourId],
    references: [tours.id],
  }),
  bookings: many(bookings),
  holds: many(availabilityHolds),
}));

export const addonsRelations = relations(addons, ({ many }) => ({
  bookingAddons: many(bookingAddons),
}));

export const bookingAddonsRelations = relations(bookingAddons, ({ one }) => ({
  booking: one(bookings, {
    fields: [bookingAddons.bookingId],
    references: [bookings.id],
  }),
  addon: one(addons, {
    fields: [bookingAddons.addonId],
    references: [addons.id],
  }),
}));

export const availabilityHoldsRelations = relations(availabilityHolds, ({ one }) => ({
  tourInstance: one(tourInstances, {
    fields: [availabilityHolds.tourInstanceId],
    references: [tourInstances.id],
  }),
  resource: one(resources, {
    fields: [availabilityHolds.resourceId],
    references: [resources.id],
  }),
  booking: one(bookings),
}));

export const productBlackoutDatesRelations = relations(productBlackoutDates, ({ one }) => ({
  product: one(tours, {
    fields: [productBlackoutDates.productId],
    references: [tours.id],
  }),
  creator: one(users, {
    fields: [productBlackoutDates.createdBy],
    references: [users.id],
  }),
}));

export const pricingVersionsRelations = relations(pricingVersions, ({ one }) => ({
  product: one(tours, {
    fields: [pricingVersions.productId],
    references: [tours.id],
  }),
  creator: one(users, {
    fields: [pricingVersions.createdBy],
    references: [users.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  booking: one(bookings, {
    fields: [payments.bookingId],
    references: [bookings.id],
  }),
  gateway: one(paymentGateways, {
    fields: [payments.gatewayId],
    references: [paymentGateways.id],
  }),
}));

export const paymentGatewaysRelations = relations(paymentGateways, ({ many }) => ({
  payments: many(payments),
}));

export const wishlistItemsRelations = relations(wishlistItems, ({ one }) => ({
  user: one(users, {
    fields: [wishlistItems.userId],
    references: [users.id],
  }),
  tour: one(tours, {
    fields: [wishlistItems.tourId],
    references: [tours.id],
  }),
}));

export const cmsContentRelations = relations(cmsContent, ({ one }) => ({
  block: one(contentBlocks, {
    fields: [cmsContent.blockSlug],
    references: [contentBlocks.slug],
  }),
}));

// Insert Schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  passwordResetToken: true,
  passwordResetTokenExpiry: true,
  isActive: true, // DB default (true) handles this — omitting prevents staff creation failures
});

export const adminInsertUserSchema = insertUserSchema.extend({
  role: z.enum(['admin', 'field_service', 'customer']).default('customer'),
});

export const insertTourSchema = createInsertSchema(tours).omit({
  id: true,
});

export const insertBookingSchema = createInsertSchema(bookings, {
  id: z.string().optional(),
  userId: z.string().optional(),
}).omit({
  createdAt: true,
});

export const insertBookingItemSchema = createInsertSchema(bookingItems).omit({
  id: true,
  createdAt: true,
});

export const insertAddonSchema = createInsertSchema(addons).omit({
  id: true,
  createdAt: true,
});

export const insertBookingAddonSchema = createInsertSchema(bookingAddons).omit({
  id: true,
  createdAt: true,
});

export const insertContentBlockSchema = createInsertSchema(contentBlocks).omit({
  id: true,
  updatedAt: true,
});

export const insertSiteSettingSchema = createInsertSchema(siteSettings).omit({
  id: true,
  updatedAt: true,
});

// Add this new schema
export const MastercardGatewayCredentialsSchema = z.object({
  merchantId: z.string(),
  accessCode: z.string(),
  secureHashSecret: z.string(),
  apiEndpoint: z.string().url(),
  version: z.string().optional(), // API Version if required
});

// Placeholder for Stripe Credentials Schema
export const StripeCredentialsSchema = z.object({
  secretKey: z.string(),
  publishableKey: z.string().optional(),
  webhookSecret: z.string(),
});

// Refined: Google Pay Credentials Schema
export const GooglePayCredentialsSchema = z.object({
  merchantId: z.string(),
  gateway: z.string(), // e.g., "paypal" or "bred"
  gatewayMerchantId: z.string().optional(),
});

// Refined: Apple Pay Credentials Schema
export const ApplePayCredentialsSchema = z.object({
  merchantIdentifier: z.string(),
  domainName: z.string().url(),
  paymentProcessingCertificateUrl: z.string().url().optional(), // URL to uploaded cert
  gateway: z.string(), // e.g., "paypal" or "bred"
});

// Refined: PayPal Credentials Schema
export const PayPalCredentialsSchema = z.object({
  clientId: z.string(),
  clientSecret: z.string(),
  mode: z.enum(["sandbox", "live"]),
  merchantAccountType: z.enum(["BUSINESS_VERIFIED", "PERSONAL_UNVERIFIED"]).optional(),
  ipnWebhookUrl: z.string().url().optional(),
  settlementCurrency: z.string().optional(),
  checkoutExperience: z.enum(["PAY_WITH_PAYPAL", "PAY_WITH_CARD_OR_PAYPAL"]).optional(),
});

// Placeholder for E-Wallet Credentials Schema (generic)
export const EWalletCredentialsSchema = z.object({
  apiKey: z.string(),
  apiSecret: z.string(),
}).partial();

// Placeholder for Generic Local Bank Credentials Schema
export const GenericLocalBankCredentialsSchema = z.object({
  bankName: z.string(),
  accountName: z.string(),
  accountNumber: z.string(),
  swiftCode: z.string().optional(),
  instructions: z.string().optional(),
});


// NEW: WanTok Credentials Schema
export const WanTokCredentialsSchema = z.object({
  merchantId: z.string(),
  apiKey: z.string(),
  apiSecret: z.string(),
  integrationType: z.enum(["API", "USSD", "QR"]),
});

// NEW: Digicel Mobile Money Credentials Schema
export const DigicelMobileMoneyCredentialsSchema = z.object({
  merchantId: z.string(),
  apiKey: z.string(),
  apiSecret: z.string(),
  ussdCode: z.string().optional(),
  paymentBusinessNumber: z.string().optional(),
  integrationType: z.enum(["API", "USSD", "QR"]),
});

// NEW: KwikPay Credentials Schema
export const KwikPayCredentialsSchema = z.object({
  merchantId: z.string(),
  apiKey: z.string(),
  apiSecret: z.string(),
  integrationType: z.enum(["API", "USSD", "QR"]),
});

// NEW: Generic Local E-Wallet Config Schema
export const LocalEWalletConfigSchema = z.object({
  webhookUrl: z.string().url().optional(),
  signatureVerificationKey: z.string().optional(),
  transactionExpiryMinutes: z.number().int().positive().optional(),
  transactionFeeRate: z.union([z.number(), z.string()]).optional(),
  dailyLimit: z.number().positive().optional(),
  monthlyLimit: z.number().positive().optional(),
  customerPromptText: z.string().optional(),
  logoUrl: z.string().url().optional(),
});


// NEW: Local Bank Common Config Schema
export const LocalBankConfigSchema = z.object({
  terminalId: z.string().optional(),
  integrationType: z.enum(["HOSTED_REDIRECT", "DIRECT_API_POST"]),
  bankApiEndpointUrl: z.string().url(),
  settlementAccountId: z.string(),
  supportedCurrencies: z.array(z.string()).min(1),
  defaultDisplayCurrency: z.string(),
  merchantDiscountRate: z.union([z.number(), z.string()]).optional(),
  enforce3DSecure: z.boolean(),
  threeDSecureThreshold: z.number().positive().optional(),
  callbackWebhookUrl: z.string().url().optional(),
  checkoutLogoUrl: z.string().url().optional(),
  nameOnCheckout: z.string().optional(),
});

// Refined: ANZ eGate Credentials Schema - extends Mastercard Gateway with optional specific fields
export const AnzEGateCredentialsSchema = MastercardGatewayCredentialsSchema;

// Refined: Bred Bank Credentials Schema
export const BredBankCredentialsSchema = z.object({
  merchantId: z.string(),
  accessCode: z.string(),
  secureHashSecret: z.string(),
  apiEndpoint: z.string().url(),
  integrationType: z.enum(["HOSTED_REDIRECT", "DIRECT_API_POST"]),
  terminalId: z.string().optional(),
});

// Refined: BSP Bank Credentials Schema
export const BspBankCredentialsSchema = z.object({
  merchantId: z.string(),
  password: z.string(),
  apiEndpoint: z.string().url(),
  integrationType: z.enum(["HOSTED_REDIRECT", "DIRECT_API_POST"]),
  terminalId: z.string().optional(),
});

// NEW: Digital Wallet Common Config Schema (for Apple Pay/Google Pay specifically)
export const DigitalWalletConfigSchema = z.object({
  paymentProcessorSelector: z.enum(["PAYPAL", "BRED", "BSP"]).optional(), // The underlying processor
  applePayMerchantId: z.string().optional(),
  applePayCertificate: z.string().url().optional(), // URL or identifier for the certificate
  googlePayMerchantId: z.string().optional(),
});

// NEW: International Fallback Config Schema
export const InternationalFallbackConfigSchema = z.object({
  primaryFallbackGatewaySlug: z.string().optional(), // Slug of the chosen international processor
  geoIpTargetingEnabled: z.boolean().optional(),
});


// Placeholder for Stripe Config Schema (no change here, still relevant if configured)
export const StripeConfigSchema = z.object({
  currency: z.string(),
});




// Update insertPaymentGatewaySchema - significantly updated to reflect new schemas
export const insertPaymentGatewaySchema = createInsertSchema(paymentGateways, {
  priority: z.number().int().default(0), // Allow setting priority on insert
  credentials: z.union([
    MastercardGatewayCredentialsSchema,
    StripeCredentialsSchema,
    GooglePayCredentialsSchema,
    ApplePayCredentialsSchema,
    PayPalCredentialsSchema,
    EWalletCredentialsSchema,
    AnzEGateCredentialsSchema,
    BredBankCredentialsSchema,
    BspBankCredentialsSchema,
    GenericLocalBankCredentialsSchema,
    WanTokCredentialsSchema,       // NEW
    DigicelMobileMoneyCredentialsSchema, // NEW
    KwikPayCredentialsSchema,       // NEW
    z.record(z.any()), // Fallback for truly unknown credentials
  ]).optional(),
  config: z.union([
    StripeConfigSchema,
    LocalEWalletConfigSchema,      // NEW
    LocalBankConfigSchema,         // NEW
    DigitalWalletConfigSchema,     // NEW
    InternationalFallbackConfigSchema, // NEW
    z.record(z.any()), // Fallback for unknown config
  ]).optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPaymentSchema = createInsertSchema(payments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const selectPublicPaymentSchema = createSelectSchema(payments).pick({
  id: true,
  status: true,
  amount: true,
  currency: true,
  createdAt: true,
});

export const insertWishlistItemSchema = createInsertSchema(wishlistItems).omit({
  id: true,
  addedAt: true,
});

export const insertNewsletterSubscriberSchema = createInsertSchema(newsletterSubscribers).omit({
  id: true,
  subscribedAt: true,
  unsubscribedAt: true,
});

export const insertCmsContentSchema = createInsertSchema(cmsContent).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTourInstanceSchema = createInsertSchema(tourInstances).omit({
  id: true,
  updatedAt: true,
});

export const insertAvailabilityHoldSchema = createInsertSchema(availabilityHolds).omit({
  id: true,
  createdAt: true,
});

export const insertFeatureFlagSchema = createInsertSchema(featureFlags).omit({
  id: true,
  updatedAt: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertTour = z.infer<typeof insertTourSchema>;
export type Tour = typeof tours.$inferSelect;
export type InsertTourInstance = z.infer<typeof insertTourInstanceSchema>;
export type TourInstance = typeof tourInstances.$inferSelect;
export type InsertAvailabilityHold = z.infer<typeof insertAvailabilityHoldSchema>;
export type AvailabilityHold = typeof availabilityHolds.$inferSelect;
export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type Booking = typeof bookings.$inferSelect & { customerEmail?: string, customerName?: string, confirmedAt?: Date | null, pickupLocation?: string | null, paymentMethod?: string | null };
export type InsertContentBlock = z.infer<typeof insertContentBlockSchema>;
export type ContentBlock = typeof contentBlocks.$inferSelect;
export type InsertSiteSetting = z.infer<typeof insertSiteSettingSchema>;
export type SiteSetting = typeof siteSettings.$inferSelect;
export type InsertPaymentGateway = z.infer<typeof insertPaymentGatewaySchema>;
export type PaymentGateway = typeof paymentGateways.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof payments.$inferSelect;
export type InsertBookingItem = z.infer<typeof insertBookingItemSchema>;
export type BookingItem = typeof bookingItems.$inferSelect;
export type InsertAddon = z.infer<typeof insertAddonSchema>;
export type Addon = typeof addons.$inferSelect;
export type InsertBookingAddon = z.infer<typeof insertBookingAddonSchema>;
export type BookingAddon = typeof bookingAddons.$inferSelect;
export type PublicPaymentDTO = z.infer<typeof selectPublicPaymentSchema>;
export type InsertWishlistItem = z.infer<typeof insertWishlistItemSchema>;
export type WishlistItem = typeof wishlistItems.$inferSelect;
export type InsertNewsletterSubscriber = z.infer<typeof insertNewsletterSubscriberSchema>;
export type NewsletterSubscriber = typeof newsletterSubscribers.$inferSelect;
export type InsertCmsContent = z.infer<typeof insertCmsContentSchema>;
export type CmsContent = typeof cmsContent.$inferSelect;
export type InsertFeatureFlag = z.infer<typeof insertFeatureFlagSchema>;
export type FeatureFlag = typeof featureFlags.$inferSelect;
export type BookingStatus = "pending" | "confirmed" | "completed" | "cancelled" | "inventory_conflict" | "price_mismatch";

// Phase 1: Resource types
export const insertResourceSchema = createInsertSchema(resources).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertResource = z.infer<typeof insertResourceSchema>;
export type Resource = typeof resources.$inferSelect;

// Phase 4: Blackout date types
export const insertBlackoutDateSchema = createInsertSchema(productBlackoutDates).omit({
  id: true,
  createdAt: true,
});
export type InsertBlackoutDate = z.infer<typeof insertBlackoutDateSchema>;
export type BlackoutDate = typeof productBlackoutDates.$inferSelect;

// Phase 5: Pricing version types
export const insertPricingVersionSchema = createInsertSchema(pricingVersions).omit({
  id: true,
  createdAt: true,
});
export type InsertPricingVersion = z.infer<typeof insertPricingVersionSchema>;
export type PricingVersion = typeof pricingVersions.$inferSelect;

// Phase 7: Audit log types
export const insertCapacityAuditLogSchema = createInsertSchema(capacityAuditLog).omit({
  id: true,
  createdAt: true,
});
export type InsertCapacityAuditLog = z.infer<typeof insertCapacityAuditLogSchema>;
export type CapacityAuditLog = typeof capacityAuditLog.$inferSelect;

// Notifications
export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id), // Optional: if null, it's a system/admin notification
  type: text("type").notNull().default("info"), // 'info', 'success', 'warning', 'error'
  title: text("title").notNull(),
  message: text("message").notNull(),
  read: boolean("read").notNull().default(false),
  link: text("link"), // Optional link to redirect to
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

export const reviews = pgTable("reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id), // nullable — guests have no user account
  tourId: varchar("tour_id").notNull().references(() => tours.id),
  bookingId: varchar("booking_id").references(() => bookings.id), // nullable — guests may not have a booking ref
  rating: integer("rating").notNull(), // 1 to 5
  comment: text("comment"),
  // Moderation
  status: varchar("status", { length: 20 }).notNull().default("approved"), // 'pending' | 'approved' | 'rejected'
  // Guest reviewer fields (populated when userId is null)
  guestName: varchar("guest_name", { length: 200 }),
  guestEmail: varchar("guest_email", { length: 300 }),
  isGuest: boolean("is_guest").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const reviewsRelations = relations(reviews, ({ one }) => ({
  user: one(users, {
    fields: [reviews.userId],
    references: [users.id],
  }),
  tour: one(tours, {
    fields: [reviews.tourId],
    references: [tours.id],
  }),
  booking: one(bookings, {
    fields: [reviews.bookingId],
    references: [bookings.id],
  }),
}));

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});

export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;

export const insertReviewSchema = createInsertSchema(reviews).omit({
  id: true,
  createdAt: true,
}).partial({
  userId: true,
  bookingId: true,
  status: true,
  guestName: true,
  guestEmail: true,
  isGuest: true,
});

export type InsertReview = z.infer<typeof insertReviewSchema>;
export type Review = typeof reviews.$inferSelect;

export const session = pgTable("session", {
  sid: varchar("sid").primaryKey(),
  sess: jsonb("sess").notNull(),
  expire: timestamp("expire", { mode: 'date', precision: 6 }).notNull(),
});

// Promotions & Discount Codes
export const promotions = pgTable("promotions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  description: text("description").notNull().default(""),
  discountType: text("discount_type").notNull().default("percentage"), // 'percentage' | 'fixed'
  discountValue: integer("discount_value").notNull().default(0),       // percent (0-100) or VUV cents
  minPurchaseCents: integer("min_purchase_cents").notNull().default(0),
  maxUses: integer("max_uses").notNull().default(0),   // 0 = unlimited
  usedCount: integer("used_count").notNull().default(0),
  validFrom: text("valid_from").notNull(),             // YYYY-MM-DD
  validTo: text("valid_to").notNull(),                 // YYYY-MM-DD
  applicableTo: text("applicable_to").notNull().default("all"), // 'all' | 'tours' | 'transfers'
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: varchar("created_by").references(() => users.id),
});

export const insertPromotionSchema = createInsertSchema(promotions).omit({
  id: true, usedCount: true, createdAt: true,
});
export type InsertPromotion = z.infer<typeof insertPromotionSchema>;
export type Promotion = typeof promotions.$inferSelect;
