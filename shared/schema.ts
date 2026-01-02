import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, decimal, boolean, jsonb, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  role: text("role").notNull().default("customer"), // 'admin' or 'customer'
  name: text("name").notNull(),
  phone: text("phone"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const tours = pgTable("tours", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  price: text("price").notNull(),
  childPrice: text("child_price"),
  duration: text("duration").notNull(),
  minPax: text("min_pax"),
  image: text("image").notNull(),
  description: text("description").array().notNull(),
  category: text("category").notNull(), // 'tour', 'transfer', or 'vehicle'
  defaultCapacity: integer("default_capacity").notNull().default(20),
  vehicleDetails: jsonb("vehicle_details"), // { make, model, seats, transmission, features[] }
});

export const tourInstances = pgTable("tour_instances", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tourId: varchar("tour_id").notNull().references(() => tours.id),
  serviceDate: text("service_date").notNull(),
  timeSlot: text("time_slot"), // optional time slot
  totalCapacity: integer("total_capacity").notNull(),
  confirmedCount: integer("confirmed_count").notNull().default(0),
  heldCount: integer("held_count").notNull().default(0),
  blockedCount: integer("blocked_count").notNull().default(0),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  instanceUniqueIdx: index("idx_tour_instances_unique")
    .on(table.tourId, table.serviceDate, table.timeSlot)
}));

export const availabilityHolds = pgTable("availability_holds", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tourInstanceId: varchar("tour_instance_id").notNull().references(() => tourInstances.id),
  quantity: integer("quantity").notNull(),
  status: text("status").notNull().default("ACTIVE"), // 'ACTIVE', 'EXPIRED', 'CONFIRMED', 'RELEASED'
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  bookingSessionId: text("booking_session_id").notNull(),
});

export const bookings = pgTable("bookings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  bookingSessionId: text("booking_session_id").notNull().default(""),
  tourId: varchar("tour_id").notNull().references(() => tours.id),
  tourInstanceId: varchar("tour_instance_id").references(() => tourInstances.id),
  holdId: varchar("hold_id").references(() => availabilityHolds.id),
  date: text("date").notNull(),
  guests: integer("guests").notNull(),
  amount: text("amount").notNull(),
  status: text("status").notNull().default("pending"), // 'pending', 'confirmed', 'completed', 'cancelled'
  paymentReference: text("payment_reference"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull().default(""),
  customerPhone: text("customer_phone"),
  tourName: text("tour_name").notNull(),
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
  credentials: jsonb("credentials"), // Encrypted credentials stored as JSON
  supportedCurrencies: text("supported_currencies").array().default(sql`ARRAY['VUV']::text[]`),
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

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  bookings: many(bookings),
}));

export const toursRelations = relations(tours, ({ many }) => ({
  bookings: many(bookings),
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
}));

export const tourInstancesRelations = relations(tourInstances, ({ one, many }) => ({
  tour: one(tours, {
    fields: [tourInstances.tourId],
    references: [tours.id],
  }),
  bookings: many(bookings),
  holds: many(availabilityHolds),
}));

export const availabilityHoldsRelations = relations(availabilityHolds, ({ one }) => ({
  tourInstance: one(tourInstances, {
    fields: [availabilityHolds.tourInstanceId],
    references: [tourInstances.id],
  }),
  booking: one(bookings), // This might need a field if it's 1:1, but many bookings could technically exist for a hold if we failed something? Usually 1:1.
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
  role: true,
  createdAt: true,
});

export const insertTourSchema = createInsertSchema(tours).omit({
  id: true,
});

export const insertBookingSchema = createInsertSchema(bookings).omit({
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

export const insertPaymentGatewaySchema = createInsertSchema(paymentGateways).omit({
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
export type Booking = typeof bookings.$inferSelect;
export type InsertContentBlock = z.infer<typeof insertContentBlockSchema>;
export type ContentBlock = typeof contentBlocks.$inferSelect;
export type InsertSiteSetting = z.infer<typeof insertSiteSettingSchema>;
export type SiteSetting = typeof siteSettings.$inferSelect;
export type InsertPaymentGateway = z.infer<typeof insertPaymentGatewaySchema>;
export type PaymentGateway = typeof paymentGateways.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof payments.$inferSelect;
export type PublicPaymentDTO = z.infer<typeof selectPublicPaymentSchema>;
export type InsertWishlistItem = z.infer<typeof insertWishlistItemSchema>;
export type WishlistItem = typeof wishlistItems.$inferSelect;
export type InsertNewsletterSubscriber = z.infer<typeof insertNewsletterSubscriberSchema>;
export type NewsletterSubscriber = typeof newsletterSubscribers.$inferSelect;
export type InsertCmsContent = z.infer<typeof insertCmsContentSchema>;
export type CmsContent = typeof cmsContent.$inferSelect;
