import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, decimal, boolean, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
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
  category: text("category").notNull(), // 'tour' or 'transfer'
});

export const bookings = pgTable("bookings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  tourId: varchar("tour_id").notNull().references(() => tours.id),
  date: text("date").notNull(),
  guests: integer("guests").notNull(),
  amount: text("amount").notNull(),
  status: text("status").notNull().default("pending"), // 'pending', 'confirmed', 'completed', 'cancelled'
  createdAt: timestamp("created_at").notNull().defaultNow(),
  customerName: text("customer_name").notNull(),
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
  createdAt: timestamp("created_at").notNull().defaultNow(),
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
  payments: many(payments),
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

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertTour = z.infer<typeof insertTourSchema>;
export type Tour = typeof tours.$inferSelect;
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
export type InsertWishlistItem = z.infer<typeof insertWishlistItemSchema>;
export type WishlistItem = typeof wishlistItems.$inferSelect;
export type InsertNewsletterSubscriber = z.infer<typeof insertNewsletterSubscriberSchema>;
export type NewsletterSubscriber = typeof newsletterSubscribers.$inferSelect;
export type InsertCmsContent = z.infer<typeof insertCmsContentSchema>;
export type CmsContent = typeof cmsContent.$inferSelect;
