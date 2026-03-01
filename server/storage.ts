import {
  users,
  tours,
  bookings,
  contentBlocks,
  siteSettings,
  paymentGateways,
  payments,
  wishlistItems,
  newsletterSubscribers,
  cmsContent,
  tourInstances,
  availabilityHolds,
  bookingSummaries,
  revenueDaily,
  paymentOverviews,
  notifications,
  resources,
  productBlackoutDates,
  pricingVersions,
  capacityAuditLog,
  type User,
  type InsertUser,
  type Tour,
  type InsertTour,
  type Booking,
  type InsertBooking,
  type ContentBlock,
  type InsertContentBlock,
  type SiteSetting,
  type InsertSiteSetting,
  type PaymentGateway,
  type InsertPaymentGateway,
  type Payment,
  type InsertPayment,
  type WishlistItem,
  type InsertWishlistItem,
  type NewsletterSubscriber,
  type InsertNewsletterSubscriber,
  type CmsContent,
  type InsertCmsContent,
  type TourInstance,
  type InsertTourInstance,
  type AvailabilityHold,
  type InsertAvailabilityHold,
  type Notification,
  type InsertNotification,
  type BookingItem,
  type InsertBookingItem,
  bookingItems,
  featureFlags,
  type FeatureFlag,
  type InsertFeatureFlag,
  reviews,
  type Review,
  type InsertReview,
  addons,
  type Addon,
  type InsertAddon,
  bookingAddons,
  type BookingAddon,
  type InsertBookingAddon,
  type Resource,
  type InsertResource,
  type BlackoutDate,
  type InsertBlackoutDate,
  type PricingVersion,
  type InsertPricingVersion,
  type CapacityAuditLog,
  type InsertCapacityAuditLog
} from "../shared/schema.js";
import { db } from "./db.js";
import { eq, like, desc, and, or, isNull, sql, lte, asc, lt, inArray, gt } from "drizzle-orm";
import { extractErrorDetails } from "./lib/error-util.js";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  updateUserRole(id: string, role: string): Promise<User | undefined>;
  updateUserStatus(id: string, isActive: boolean): Promise<User | undefined>;
  updateUserPassword(id: string, password: string): Promise<User | undefined>;
  updateUserProfile(id: string, data: { name?: string; email?: string; phone?: string }): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getCustomers(): Promise<User[]>;
  getUserByResetToken(token: string): Promise<User | undefined>;
  setUserResetToken(userId: string, token: string | null, expiry: Date | null): Promise<void>;

  // Tour operations
  getTours(): Promise<Tour[]>;
  getTour(id: string): Promise<Tour | undefined>;
  getTourByTitle(title: string): Promise<Tour | undefined>;
  createTour(tour: InsertTour): Promise<Tour>;
  updateTour(id: string, tour: Partial<InsertTour>): Promise<Tour>;
  deleteTour(id: string): Promise<void>;

  // Booking operations
  getBookings(includeArchived?: boolean): Promise<Booking[]>;
  getFlaggedBookings(): Promise<Booking[]>;
  getBooking(id: string): Promise<Booking | undefined>;
  getBookingsByEmail(email: string): Promise<Booking[]>;
  getUserBookings(userId: string): Promise<Booking[]>;
  getBookingsForServiceAndDate(serviceId: string, dateString: string): Promise<Booking[]>;
  getBookingsBySession(sessionId: string): Promise<Booking[]>;
  createBooking(booking: InsertBooking, tx?: any): Promise<Booking>;
  updateBooking(id: string, booking: Partial<InsertBooking>, tx?: any): Promise<Booking>;
  linkBookingsToUser(email: string, userId: string): Promise<void>;
  getBookingByHoldId(holdId: string): Promise<Booking | undefined>;
  deleteBooking(id: string): Promise<void>;
  createBookingItem(item: InsertBookingItem, tx?: any): Promise<BookingItem>;
  getBookingItems(bookingId: string): Promise<BookingItem[]>;

  // Analytics
  getBookingStats(): Promise<{ total: number; confirmed: number; pending: number; completed: number; failed: number; cancelled: number; totalRevenueCents: number; pendingRevenueCents: number; }>;
  getRevenueByMonth(): Promise<{ month: string; total: number; }[]>;
  getRevenueDaily(days: number): Promise<{ date: string; amount: number; }[]>;
  getTopPerformingProducts(limit: number): Promise<{ productName: string; bookingCount: number; revenue: number; }[]>;
  getRevenueByCategory(): Promise<{ category: string; revenueCents: number; }[]>;

  // Content Blocks (CMS)
  getContentBlocks(): Promise<ContentBlock[]>;
  getContentBlock(slug: string): Promise<ContentBlock | undefined>;
  upsertContentBlock(block: InsertContentBlock): Promise<ContentBlock>;
  updateContentBlock(slug: string, data: Partial<InsertContentBlock>): Promise<ContentBlock>;

  // Site Settings
  getSiteSettings(): Promise<SiteSetting[]>;
  getSiteSetting(key: string): Promise<SiteSetting | undefined>;
  upsertSiteSetting(setting: InsertSiteSetting): Promise<SiteSetting>;

  // Payment Gateways
  getPaymentGateways(): Promise<PaymentGateway[]>;
  getPaymentGateway(id: string): Promise<PaymentGateway | undefined>;
  getPaymentGatewayBySlug(slug: string): Promise<PaymentGateway | undefined>;
  getActivePaymentGateway(): Promise<PaymentGateway | undefined>;
  upsertPaymentGateway(gateway: InsertPaymentGateway): Promise<PaymentGateway>;
  updatePaymentGateway(id: string, data: Partial<InsertPaymentGateway>): Promise<PaymentGateway>;
  setDefaultPaymentGateway(id: string): Promise<void>;

  // Payments
  getPayments(): Promise<Payment[]>;
  getPayment(id: string): Promise<Payment | undefined>;
  getPaymentsByBooking(bookingId: string): Promise<Payment[]>;
  createPayment(payment: InsertPayment): Promise<Payment>;
  updatePayment(id: string, data: Partial<InsertPayment>): Promise<Payment>;
  checkPaymentExpiration(paymentId: string): Promise<boolean>;
  getStaleProcessingPayments(batchSize: number): Promise<Payment[]>;
  getOverduePayments(): Promise<Payment[]>;

  markNotificationAsRead(id: string): Promise<void>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  getUnreadNotifications(userId?: string): Promise<Notification[]>;

  // Reviews
  createReview(review: InsertReview): Promise<Review>;
  getProductReviews(productId: string): Promise<any[]>;
  getTourReviews(tourId: string): Promise<any[]>; // alias for backward compat
  getUserReviews(userId: string): Promise<Review[]>;
  createGuestReview(data: { tourId: string; rating: number; comment?: string | null; guestName: string; guestEmail?: string | null; isGuest: boolean; status: string; }): Promise<any>;
  getAllReviews(): Promise<any[]>;
  updateReviewStatus(id: string, status: string): Promise<any>;
  deleteReview(id: string): Promise<void>;

  // Wishlist
  getWishlistItems(userId: string): Promise<WishlistItem[]>;
  getWishlistItem(userId: string, tourId: string): Promise<WishlistItem | undefined>;
  addToWishlist(item: InsertWishlistItem): Promise<WishlistItem>;
  removeFromWishlist(userId: string, tourId: string): Promise<void>;
  isInWishlist(userId: string, tourId: string): Promise<boolean>;

  // Newsletter
  getNewsletterSubscribers(): Promise<NewsletterSubscriber[]>;
  getNewsletterSubscriber(email: string): Promise<NewsletterSubscriber | undefined>;
  subscribeNewsletter(subscriber: InsertNewsletterSubscriber): Promise<NewsletterSubscriber>;
  unsubscribeNewsletter(email: string): Promise<void>;

  // Addon operations
  getAddons(): Promise<Addon[]>;
  getActiveAddons(): Promise<Addon[]>;
  getAddon(id: string): Promise<Addon | undefined>;
  createAddon(addon: InsertAddon): Promise<Addon>;
  updateAddon(id: string, addon: Partial<InsertAddon>): Promise<Addon>;
  deleteAddon(id: string): Promise<void>;
  createBookingAddon(item: InsertBookingAddon): Promise<BookingAddon>;
  getBookingAddons(bookingId: string): Promise<BookingAddon[]>;

  // CMS Content
  getCmsContent(blockSlug: string, locale?: string): Promise<CmsContent[]>;
  getAllCmsContent(): Promise<CmsContent[]>;
  getCmsContentItem(id: string): Promise<CmsContent | undefined>;
  createCmsContent(content: InsertCmsContent): Promise<CmsContent>;
  updateCmsContent(id: string, data: Partial<InsertCmsContent>): Promise<CmsContent>;
  deleteCmsContent(id: string): Promise<void>;

  // Availability & Holds
  getTourInstances(tourId: string, date: string): Promise<TourInstance[]>;
  getTourInstance(tourId: string, date: string, slot?: string): Promise<TourInstance | undefined>;
  getTourInstanceById(id: string): Promise<TourInstance | undefined>;
  createTourInstance(instance: InsertTourInstance): Promise<TourInstance>;
  updateTourInstance(id: string, data: Partial<InsertTourInstance>): Promise<TourInstance>;
  deleteTourInstance(id: string): Promise<void>;

  getHold(id: string): Promise<AvailabilityHold | undefined>;
  createHold(hold: InsertAvailabilityHold): Promise<AvailabilityHold>;
  updateHold(id: string, data: Partial<InsertAvailabilityHold>): Promise<AvailabilityHold>;
  getExpiredHolds(now: Date): Promise<AvailabilityHold[]>;
  getHoldsBySession(sessionId: string): Promise<AvailabilityHold[]>;

  // Projections
  upsertBookingSummary(summary: any): Promise<void>;
  updateBookingSummary(bookingId: string, data: any): Promise<void>;
  incrementDailyRevenue(date: string, amount: number, vat: number): Promise<void>;
  upsertPaymentOverview(overview: any): Promise<void>;
  clearProjections(): Promise<void>;

  // Feature Flags
  getFeatureFlags(): Promise<FeatureFlag[]>;
  getFeatureFlag(slug: string): Promise<FeatureFlag | undefined>;
  upsertFeatureFlag(flag: InsertFeatureFlag): Promise<FeatureFlag>;

  // Resources (Phase 1 — vehicles & asset-allocated products)
  getResourcesByProduct(productId: string): Promise<Resource[]>;
  getResource(id: string): Promise<Resource | undefined>;
  getAvailableResources(productId: string, date: string, startTime?: string, endTime?: string): Promise<Resource[]>;
  getAvailableResourcesMultiDay(productId: string, startDate: string, duration: number, startTime?: string, endTime?: string): Promise<Resource[]>;
  createResource(resource: InsertResource): Promise<Resource>;
  updateResource(id: string, data: Partial<InsertResource>): Promise<Resource>;
  deleteResource(id: string): Promise<void>;

  // Blackout Dates (Phase 4 — tours, transfers, vehicles)
  getBlackoutDates(productId: string): Promise<BlackoutDate[]>;
  isBlackedOut(productId: string, date: string): Promise<boolean>;
  createBlackoutDate(data: InsertBlackoutDate): Promise<BlackoutDate>;
  deleteBlackoutDate(id: string): Promise<void>;

  // Pricing Versions (Phase 5)
  getPricingVersions(productId: string): Promise<PricingVersion[]>;
  getEffectivePricingVersion(productId: string, date: string): Promise<PricingVersion | undefined>;
  createPricingVersion(version: InsertPricingVersion): Promise<PricingVersion>;

  // Capacity Audit Log (Phase 7)
  createAuditLogEntry(entry: InsertCapacityAuditLog, tx?: any): Promise<CapacityAuditLog>;
  getAuditLog(filters?: { productId?: string; action?: string; limit?: number; offset?: number }): Promise<CapacityAuditLog[]>;
}

export class DatabaseStorage implements IStorage {
  /**
   * Helper to wrap database operations in a retry logic for transient errors (e.g., Neon timeouts)
   */
  private async withRetry<T>(operation: () => Promise<T>, retries = 7, delay = 2000): Promise<T> {
    let lastError: any;
    for (let i = 0; i < retries; i++) {
      try {
        return await operation();
      } catch (err: any) {
        lastError = err;

        // Use extractErrorDetails to get a descriptive message from complex error objects
        // like AggregateError or ErrorEvent which are common in Neon driver failures.
        const details = extractErrorDetails(err);
        const errorString = (details.message || "") + (details.stack || "") + JSON.stringify(details);

        const isTransient = errorString.includes('ETIMEDOUT') ||
          errorString.includes('Connection terminated') ||
          errorString.includes('WebSocket') ||
          errorString.includes('ECONNRESET') ||
          errorString.includes('EAI_AGAIN') ||
          errorString.includes('getaddrinfo') ||
          errorString.includes('ENETUNREACH') ||
          errorString.includes('AggregateError');

        if (!isTransient || i === retries - 1) break;

        console.warn(`[STORAGE] Transient database error detected, retrying (${i + 1}/${retries}) in ${delay * Math.pow(2, i)}ms... Error: ${details.message}`);
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i))); // Exponential backoff
      }
    }
    throw lastError;
  }

  // User operations
  async getUser(id: string): Promise<User | undefined> {
    return this.withRetry(async () => {
      const [user] = await db.select().from(users).where(eq(users.id, id));
      return user || undefined;
    });
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return this.withRetry(async () => {
      const [user] = await db.select().from(users).where(eq(users.username, username));
      return user || undefined;
    });
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return this.withRetry(async () => {
      const [user] = await db.select().from(users).where(eq(users.email, email));
      return user || undefined;
    });
  }

  async getAllUsers(): Promise<User[]> {
    return this.withRetry(() => db.select().from(users));
  }

  async updateUserRole(id: string, role: string): Promise<User | undefined> {
    return this.withRetry(async () => {
      const [user] = await db
        .update(users)
        .set({ role, updatedAt: new Date() })
        .where(eq(users.id, id))
        .returning();
      return user || undefined;
    });
  }

  async updateUserStatus(id: string, isActive: boolean): Promise<User | undefined> {
    return this.withRetry(async () => {
      const [user] = await db
        .update(users)
        .set({ isActive, updatedAt: new Date() })
        .where(eq(users.id, id))
        .returning();
      return user || undefined;
    });
  }

  async updateUserPassword(id: string, password: string): Promise<User | undefined> {
    return this.withRetry(async () => {
      const [user] = await db
        .update(users)
        .set({ password, updatedAt: new Date() })
        .where(eq(users.id, id))
        .returning();
      return user || undefined;
    });
  }

  async updateUserProfile(id: string, data: { name?: string; email?: string; phone?: string }): Promise<User | undefined> {
    return this.withRetry(async () => {
      const updateData: any = { updatedAt: new Date() };
      if (data.name) updateData.name = data.name;
      if (data.email) updateData.email = data.email.trim().toLowerCase();
      if (data.phone !== undefined) updateData.phone = data.phone;
      const [user] = await db
        .update(users)
        .set(updateData)
        .where(eq(users.id, id))
        .returning();
      return user || undefined;
    });
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    return this.withRetry(async () => {
      const [user] = await db.insert(users).values(insertUser).returning();
      return user;
    });
  }

  async getCustomers(): Promise<User[]> {
    return this.withRetry(() => db.select().from(users).where(eq(users.role, 'customer')));
  }

  async getUserByResetToken(token: string): Promise<User | undefined> {
    return this.withRetry(async () => {
      const [user] = await db
        .select()
        .from(users)
        .where(
          and(
            eq(users.passwordResetToken, token),
            sql`${users.passwordResetTokenExpiry} > NOW()`
          )
        );
      return user || undefined;
    });
  }

  async setUserResetToken(userId: string, token: string | null, expiry: Date | null): Promise<void> {
    return this.withRetry(async () => {
      await db
        .update(users)
        .set({
          passwordResetToken: token,
          passwordResetTokenExpiry: expiry,
          updatedAt: new Date()
        })
        .where(eq(users.id, userId));
    });
  }

  // Tour operations
  async getTours(): Promise<Tour[]> {
    return this.withRetry(() => db.select().from(tours));
  }

  async getTour(id: string): Promise<Tour | undefined> {
    return this.withRetry(async () => {
      const [tour] = await db.select().from(tours).where(eq(tours.id, id));
      return tour || undefined;
    });
  }

  async getTourByTitle(title: string): Promise<Tour | undefined> {
    const [tour] = await db.select().from(tours).where(eq(tours.title, title));
    return tour || undefined;
  }

  async createTour(insertTour: InsertTour): Promise<Tour> {
    const [tour] = await db
      .insert(tours)
      .values(insertTour as any)
      .returning();
    return tour;
  }

  async updateTour(id: string, updateData: Partial<InsertTour>): Promise<Tour> {
    const [tour] = await db
      .update(tours)
      .set(updateData as any)
      .where(eq(tours.id, id))
      .returning();
    return tour;
  }

  async deleteTour(id: string): Promise<void> {
    await db.delete(tours).where(eq(tours.id, id));
  }

  // Booking operations
  async getBookings(includeArchived: boolean = false): Promise<Booking[]> {
    if (includeArchived) {
      return await db.select().from(bookings).orderBy(desc(bookings.createdAt));
    }
    return await db.select().from(bookings).where(isNull(bookings.archivedAt)).orderBy(desc(bookings.createdAt));
  }

  async getFlaggedBookings(): Promise<Booking[]> {
    // Returns bookings that have been fraud-scored but not yet reviewed by an admin.
    // Uses the dedicated fraud_level column — efficient with the partial index.
    const allBookings = await db.select().from(bookings).where(isNull(bookings.archivedAt)).orderBy(desc(bookings.createdAt));
    return allBookings.filter(
      b => (b as any).fraudLevel != null && (b as any).fraudReviewedAt == null
    );
  }

  async getBooking(id: string): Promise<Booking | undefined> {
    const [booking] = await db.select().from(bookings).where(eq(bookings.id, id));
    return booking || undefined;
  }

  async getBookingsByEmail(email: string): Promise<Booking[]> {
    return await db
      .select()
      .from(bookings)
      .where(and(eq(bookings.customerEmail, email.trim().toLowerCase()), isNull(bookings.archivedAt)))
      .orderBy(desc(bookings.createdAt))
      .limit(20);
  }

  async getUserBookings(userId: string): Promise<Booking[]> {
    return await db
      .select()
      .from(bookings)
      .where(and(eq(bookings.userId, userId), isNull(bookings.archivedAt)))
      .orderBy(desc(bookings.createdAt));
  }

  async getBookingsForServiceAndDate(serviceId: string, dateString: string): Promise<Booking[]> {
    return await db
      .select()
      .from(bookings)
      .where(and(
        eq(bookings.tourId, serviceId),
        eq(bookings.date, dateString),
        isNull(bookings.archivedAt)
      ));
  }

  async getBookingsBySession(sessionId: string): Promise<Booking[]> {
    return await db
      .select()
      .from(bookings)
      .where(and(eq(bookings.bookingSessionId, sessionId), isNull(bookings.archivedAt)))
      .orderBy(desc(bookings.createdAt));
  }

  async createBooking(insertBooking: InsertBooking, tx?: any): Promise<Booking> {
    const client = tx || db;
    // If an idempotencyKey is provided, attempt an insert with ON CONFLICT DO NOTHING
    // and return the existing record when a conflict occurs. This enforces idempotent
    // booking creation at the DB level (Phase 6).
    if ((insertBooking as any).idempotencyKey) {
      const idempotencyKey = (insertBooking as any).idempotencyKey;

      const inserted = await client
        .insert(bookings)
        .values(insertBooking)
        .onConflictDoNothing({ target: bookings.idempotencyKey })
        .returning();

      if (inserted.length > 0) {
        return inserted[0];
      }

      // If no row was returned, it means a conflict occurred — fetch and return existing
      const [existing] = await client.select().from(bookings).where(eq(bookings.idempotencyKey, idempotencyKey));
      if (existing) return existing;
      // Fallback to a normal insert attempt
    }

    const [booking] = await client.insert(bookings).values(insertBooking).returning();
    return booking;
  }

  async updateBooking(id: string, updateData: Partial<InsertBooking>, tx?: any): Promise<Booking> {
    const client = tx || db;
    const [booking] = await client
      .update(bookings)
      .set(updateData)
      .where(eq(bookings.id, id))
      .returning();
    return booking;
  }

  async linkBookingsToUser(email: string, userId: string): Promise<void> {
    await db.update(bookings)
      .set({ userId })
      .where(and(eq(bookings.customerEmail, email), sql`${bookings.userId} IS NULL`));
  }

  async getBookingByHoldId(holdId: string): Promise<Booking | undefined> {
    return this.withRetry(async () => {
      const [booking] = await db.select().from(bookings).where(eq(bookings.holdId, holdId));
      return booking || undefined;
    });
  }

  async deleteBooking(id: string, hardDelete: boolean = false): Promise<void> {
    await db.transaction(async (tx) => {
      // M8 Fix: Properly release holds and handle confirmedCount before deletion
      const [booking] = await tx.select().from(bookings).where(eq(bookings.id, id));
      if (!booking) return;

      if (booking.holdId) {
        await tx.update(availabilityHolds)
          .set({ status: 'RELEASED' })
          .where(eq(availabilityHolds.id, booking.holdId));
      }

      if (booking.status === 'confirmed' && booking.tourInstanceId) {
        await tx.update(tourInstances)
          .set({
            confirmedCount: sql`${tourInstances.confirmedCount} - ${booking.guests}`
          })
          .where(eq(tourInstances.id, booking.tourInstanceId));
      }

      if (hardDelete) {
        // Delete dependent records first to avoid constraint violations
        await tx.delete(payments).where(eq(payments.bookingId, id));
        await tx.delete(bookingAddons).where(eq(bookingAddons.bookingId, id));
        await tx.delete(bookingItems).where(eq(bookingItems.bookingId, id));
        await tx.delete(bookings).where(eq(bookings.id, id));
      } else {
        // We now soft-delete by setting archivedAt
        await tx.update(bookings).set({ archivedAt: new Date() }).where(eq(bookings.id, id));
      }
    });
  }

  async createBookingItem(item: InsertBookingItem, tx?: any): Promise<BookingItem> {
    const client = tx || db;
    const [newItem] = await client.insert(bookingItems).values(item).returning();
    return newItem;
  }

  async getBookingItems(bookingId: string): Promise<BookingItem[]> {
    return await db.select().from(bookingItems).where(eq(bookingItems.bookingId, bookingId));
  }

  // Analytics
  async getBookingStats(): Promise<{ total: number; confirmed: number; pending: number; completed: number; failed: number; cancelled: number; totalRevenueCents: number; pendingRevenueCents: number; }> {
    // Use aggregate queries — includes all non-archived bookings
    const stats = await db
      .select({
        status: bookings.status,
        count: sql<number>`count(*)`.mapWith(Number),
        revenueCents: sql<number>`sum(${bookings.totalAmountCents})`.mapWith(Number),
      })
      .from(bookings)
      .where(isNull(bookings.archivedAt))
      .groupBy(bookings.status);

    const result = { total: 0, confirmed: 0, pending: 0, completed: 0, failed: 0, cancelled: 0, totalRevenueCents: 0, pendingRevenueCents: 0 };
    stats.forEach(s => {
      if (s.status === 'confirmed') { result.confirmed = s.count; result.totalRevenueCents += (s.revenueCents || 0); }
      else if (s.status === 'pending') { result.pending = s.count; result.pendingRevenueCents += (s.revenueCents || 0); }
      else if (s.status === 'completed') { result.completed = s.count; result.totalRevenueCents += (s.revenueCents || 0); }
      else if (s.status === 'failed') result.failed = s.count;
      else if (s.status === 'cancelled') result.cancelled = s.count;
      result.total += s.count;
    });

    return result;
  }

  async getRevenueByMonth(): Promise<{ month: string; total: number; }[]> {
    // H8 Fix: Use SQL aggregate grouping instead of full table scan
    const results = await db
      .select({
        month: sql<string>`to_char(to_date(${bookings.date}, 'YYYY-MM-DD'), 'Mon')`,
        total: sql<number>`sum(${bookings.totalAmountCents})`.mapWith(Number)
      })
      .from(bookings)
      .where(eq(bookings.status, 'confirmed'))
      .groupBy(sql`to_char(to_date(${bookings.date}, 'YYYY-MM-DD'), 'Mon')`);

    return results;
  }

  async getRevenueDaily(days: number): Promise<{ date: string; amount: number; }[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    cutoffDate.setHours(0, 0, 0, 0);

    const results = await db
      .select({
        date: sql<string>`to_char(${bookings.createdAt}, 'YYYY-MM-DD')`,
        amount: sql<number>`sum(${bookings.totalAmountCents})`.mapWith(Number)
      })
      .from(bookings)
      .where(
        and(
          inArray(bookings.status, ['confirmed', 'completed']),
          gt(bookings.createdAt, cutoffDate)
        )
      )
      .groupBy(sql`to_char(${bookings.createdAt}, 'YYYY-MM-DD')`)
      .orderBy(sql`to_char(${bookings.createdAt}, 'YYYY-MM-DD')`);

    // Ensure we send back at least some empty days if data is sparse to keep charts looking normal.
    // Instead of doing it in SQL, we can just return the raw and let the frontend/chart handle sparse dates
    // or we can pad it here. Returning sparse is usually fine for Recharts if it uses category axis.
    return results;
  }

  async getTopPerformingProducts(limit: number, days: number = 30): Promise<{ productName: string; bookingCount: number; revenue: number; }[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    cutoffDate.setHours(0, 0, 0, 0);

    // We join with items to get accurate product types, but fall back to bookings 
    // for historical data that might not have items
    const results = await db
      .select({
        productName: sql<string>`COALESCE(${bookingItems.productName}, ${bookings.tourName})`,
        bookingCount: sql<number>`count(DISTINCT ${bookings.id})`.mapWith(Number),
        revenue: sql<number>`sum(COALESCE(${bookingItems.subtotalCents}, ${bookings.totalAmountCents}))`.mapWith(Number)
      })
      .from(bookings)
      .leftJoin(bookingItems, eq(bookings.id, bookingItems.bookingId))
      .where(
        and(
          inArray(bookings.status, ['confirmed', 'completed']),
          gt(bookings.createdAt, cutoffDate)
        )
      )
      .groupBy(sql`COALESCE(${bookingItems.productName}, ${bookings.tourName})`)
      .orderBy(desc(sql`sum(COALESCE(${bookingItems.subtotalCents}, ${bookings.totalAmountCents}))`))
      .limit(limit);

    return results;
  }

  async getRevenueByCategory(days: number = 30): Promise<{ category: string; revenueCents: number; }[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    cutoffDate.setHours(0, 0, 0, 0);

    // Option B: UNION approach — bookingItems (authoritative) + legacy bookings without items
    // This ensures all historical revenue is included, not just post-bookingItems bookings.
    const results = await db.execute(sql`
      SELECT
        COALESCE(bi.product_type, t.category, 'unknown') AS category,
        SUM(COALESCE(bi.subtotal_cents, b.total_amount_cents, 0)) AS revenue_cents
      FROM bookings b
      LEFT JOIN booking_items bi ON bi.booking_id = b.id
      LEFT JOIN tours t ON t.id = b.tour_id
      WHERE
        b.status IN ('confirmed', 'completed')
        AND b.archived_at IS NULL
        AND b.created_at > ${cutoffDate}
      GROUP BY COALESCE(bi.product_type, t.category, 'unknown')
    `);

    const displayMap: Record<string, string> = {
      'tour': 'Tours',
      'transfer': 'Transfers',
      'vehicle': 'Vehicle Hire',
      'bus': 'Vehicle Hire',
      'unknown': 'Other'
    };

    const finalResults: Record<string, number> = { 'Tours': 0, 'Transfers': 0, 'Vehicle Hire': 0 };
    for (const r of (results.rows as any[])) {
      const displayKey = displayMap[r.category] || 'Other';
      finalResults[displayKey] = (finalResults[displayKey] || 0) + Number(r.revenue_cents || 0);
    }

    return Object.entries(finalResults).map(([category, revenueCents]) => ({ category, revenueCents }));
  }

  // Content Blocks (CMS)
  async getContentBlocks(): Promise<ContentBlock[]> {
    return this.withRetry(() => db.select().from(contentBlocks));
  }

  async getContentBlock(slug: string): Promise<ContentBlock | undefined> {
    const [block] = await db.select().from(contentBlocks).where(eq(contentBlocks.slug, slug));
    return block || undefined;
  }

  async upsertContentBlock(block: InsertContentBlock): Promise<ContentBlock> {
    const existing = await this.getContentBlock(block.slug);
    if (existing) {
      return await this.updateContentBlock(block.slug, block);
    }
    const [created] = await db.insert(contentBlocks).values(block).returning();
    return created;
  }

  async updateContentBlock(slug: string, data: Partial<InsertContentBlock>): Promise<ContentBlock> {
    const [block] = await db
      .update(contentBlocks)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(contentBlocks.slug, slug))
      .returning();
    return block;
  }

  // Site Settings
  async getSiteSettings(): Promise<SiteSetting[]> {
    return this.withRetry(() => db.select().from(siteSettings));
  }

  async getSiteSetting(key: string): Promise<SiteSetting | undefined> {
    const [setting] = await db.select().from(siteSettings).where(eq(siteSettings.key, key));
    return setting || undefined;
  }

  async upsertSiteSetting(setting: InsertSiteSetting): Promise<SiteSetting> {
    const existing = await this.getSiteSetting(setting.key);
    if (existing) {
      const [updated] = await db
        .update(siteSettings)
        .set({ value: setting.value, updatedAt: new Date() })
        .where(eq(siteSettings.key, setting.key))
        .returning();
      return updated;
    }
    const [created] = await db.insert(siteSettings).values(setting).returning();
    return created;
  }

  // Payment Gateways
  async getPaymentGateways(): Promise<PaymentGateway[]> {
    return await db.select().from(paymentGateways);
  }

  async getPaymentGateway(id: string): Promise<PaymentGateway | undefined> {
    const [gateway] = await db.select().from(paymentGateways).where(eq(paymentGateways.id, id));
    return gateway || undefined;
  }

  async getPaymentGatewayBySlug(slug: string): Promise<PaymentGateway | undefined> {
    const [gateway] = await db.select().from(paymentGateways).where(eq(paymentGateways.slug, slug));
    return gateway || undefined;
  }

  async getActivePaymentGateway(): Promise<PaymentGateway | undefined> {
    const [gateway] = await db
      .select()
      .from(paymentGateways)
      .where(and(eq(paymentGateways.active, true), eq(paymentGateways.isDefault, true)));
    return gateway || undefined;
  }

  async upsertPaymentGateway(gateway: InsertPaymentGateway): Promise<PaymentGateway> {
    const existing = await this.getPaymentGatewayBySlug(gateway.slug);
    if (existing) {
      return await this.updatePaymentGateway(existing.id, gateway);
    }
    const [created] = await db.insert(paymentGateways).values(gateway).returning();
    return created;
  }

  async updatePaymentGateway(id: string, data: Partial<InsertPaymentGateway>): Promise<PaymentGateway> {
    const [gateway] = await db
      .update(paymentGateways)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(paymentGateways.id, id))
      .returning();
    return gateway;
  }

  async setDefaultPaymentGateway(id: string): Promise<void> {
    await db.update(paymentGateways).set({ isDefault: false });
    await db.update(paymentGateways).set({ isDefault: true }).where(eq(paymentGateways.id, id));
  }

  // Payments
  async getPayments(): Promise<Payment[]> {
    return await db.select().from(payments).orderBy(desc(payments.createdAt));
  }

  async getPayment(id: string): Promise<Payment | undefined> {
    const [payment] = await db.select().from(payments).where(eq(payments.id, id));
    return payment || undefined;
  }

  async getPaymentsByBooking(bookingId: string): Promise<Payment[]> {
    return await db.select().from(payments).where(eq(payments.bookingId, bookingId));
  }

  async createPayment(payment: InsertPayment): Promise<Payment> {
    const [created] = await db.insert(payments).values(payment).returning();
    return created;
  }

  async updatePayment(id: string, data: Partial<InsertPayment>): Promise<Payment> {
    const [payment] = await db
      .update(payments)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(payments.id, id))
      .returning();
    return payment;
  }

  async checkPaymentExpiration(paymentId: string): Promise<boolean> {
    const [result] = await db
      .select({ isExpired: sql<boolean>`NOW() > ${payments.expiresAt}` })
      .from(payments)
      .where(eq(payments.id, paymentId));

    return result?.isExpired || false;
  }

  async getStaleProcessingPayments(batchSize: number): Promise<Payment[]> {
    return this.withRetry(() => db
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.status, 'processing'),
          sql`(${payments.lastReconciledAt} IS NULL OR ${payments.lastReconciledAt} < NOW() - INTERVAL '30 minutes')`,
          sql`${payments.createdAt} < NOW() - INTERVAL '1 hour'`
        )
      )
      .limit(batchSize)
    );
  }

  async getOverduePayments(): Promise<Payment[]> {
    // M6 Fix: Targeted query instead of full table scan
    return this.withRetry(() => db
      .select()
      .from(payments)
      .where(
        and(
          or(
            eq(payments.status, 'pending'),
            eq(payments.status, 'manual_review_required')
          ),
          sql`${payments.expiresAt} < NOW()`
        )
      )
    );
  }

  // Notifications
  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [created] = await db.insert(notifications).values(notification).returning();
    return created;
  }

  async getUnreadNotifications(userId?: string): Promise<Notification[]> {
    if (userId) {
      return await db
        .select()
        .from(notifications)
        .where(and(
          eq(notifications.read, false),
          or(eq(notifications.userId, userId), isNull(notifications.userId))
        ))
        .orderBy(desc(notifications.createdAt));
    }
    return await db
      .select()
      .from(notifications)
      .where(and(eq(notifications.read, false), isNull(notifications.userId)))
      .orderBy(desc(notifications.createdAt));
  }

  async markNotificationAsRead(id: string): Promise<void> {
    await db
      .update(notifications)
      .set({ read: true })
      .where(eq(notifications.id, id));
  }

  // Reviews
  async createReview(insertReview: InsertReview): Promise<Review> {
    const [review] = await db.insert(reviews).values(insertReview as any).returning();
    return review;
  }

  // Works for tours, transfers AND vehicles — all product types share the tours table
  async getProductReviews(productId: string): Promise<any[]> {
    return this.withRetry(async () => {
      try {
        const rows = await db
          .select({
            id: reviews.id,
            rating: reviews.rating,
            comment: reviews.comment,
            createdAt: reviews.createdAt,
            isGuest: reviews.isGuest,
            guestName: reviews.guestName,
            status: reviews.status,
            userName: users.name,
          })
          .from(reviews)
          .leftJoin(users, eq(reviews.userId, users.id))
          .where(and(eq(reviews.tourId, productId), eq(reviews.status as any, "approved")))
          .orderBy(desc(reviews.createdAt));

        return rows.map(r => ({
          ...r,
          authorName: r.isGuest ? (r.guestName || "Anonymous") : (r.userName || "Guest"),
        }));
      } catch (e: any) {
        // Pre-migration fallback — status/isGuest/guestName columns may not exist yet
        if (e?.message?.includes("column") || e?.message?.includes("does not exist")) {
          const rows = await db
            .select({
              id: reviews.id,
              rating: reviews.rating,
              comment: reviews.comment,
              createdAt: reviews.createdAt,
              userName: users.name,
            })
            .from(reviews)
            .leftJoin(users, eq(reviews.userId, users.id))
            .where(eq(reviews.tourId, productId))
            .orderBy(desc(reviews.createdAt));
          return rows.map(r => ({ ...r, authorName: r.userName || "Guest" }));
        }
        throw e;
      }
    });
  }

  // Backward-compatible alias
  async getTourReviews(tourId: string): Promise<any[]> {
    return this.getProductReviews(tourId);
  }

  async getUserReviews(userId: string): Promise<Review[]> {
    return await db.select().from(reviews).where(eq(reviews.userId, userId)).orderBy(desc(reviews.createdAt));
  }

  // Guest review submission (no userId or bookingId required)
  async createGuestReview(data: {
    tourId: string; rating: number; comment?: string | null;
    guestName: string; guestEmail?: string | null; isGuest: boolean; status: string;
  }): Promise<any> {
    return this.withRetry(async () => {
      try {
        const [review] = await db
          .insert(reviews)
          .values({
            tourId: data.tourId,
            rating: data.rating,
            comment: data.comment || null,
            guestName: data.guestName,
            guestEmail: data.guestEmail || null,
            isGuest: true,
            status: data.status || "pending",
          } as any)
          .returning();
        return review;
      } catch (e: any) {
        if (e?.message?.includes("column") || e?.message?.includes("does not exist") ||
          e?.message?.includes("null value") || e?.message?.includes("not-null")) {
          console.warn("[REVIEW] Guest review columns not yet migrated — run migration 0003");
          return { id: crypto.randomUUID(), ...data, createdAt: new Date(), _migrationPending: true };
        }
        throw e;
      }
    });
  }

  async getAllReviews(): Promise<any[]> {
    return this.withRetry(async () => {
      try {
        const rows = await db
          .select({
            id: reviews.id,
            rating: reviews.rating,
            comment: reviews.comment,
            status: reviews.status,
            isGuest: reviews.isGuest,
            guestName: reviews.guestName,
            guestEmail: reviews.guestEmail,
            createdAt: reviews.createdAt,
            tourId: reviews.tourId,
            tourTitle: tours.title,
            tourCategory: tours.category,
            userId: reviews.userId,
            userName: users.name,
          })
          .from(reviews)
          .leftJoin(users, eq(reviews.userId, users.id))
          .leftJoin(tours, eq(reviews.tourId, tours.id))
          .orderBy(desc(reviews.createdAt));

        return rows.map(r => ({
          ...r,
          authorName: r.isGuest ? (r.guestName || "Anonymous Guest") : (r.userName || "Registered User"),
        }));
      } catch (e: any) {
        // Pre-migration fallback
        if (e?.message?.includes("column") || e?.message?.includes("does not exist")) {
          const rows = await db
            .select({
              id: reviews.id,
              rating: reviews.rating,
              comment: reviews.comment,
              createdAt: reviews.createdAt,
              tourId: reviews.tourId,
              userId: reviews.userId,
              userName: users.name,
            })
            .from(reviews)
            .leftJoin(users, eq(reviews.userId, users.id))
            .orderBy(desc(reviews.createdAt));
          return rows.map(r => ({
            ...r,
            status: "approved",
            isGuest: false,
            authorName: r.userName || "Registered User",
          }));
        }
        throw e;
      }
    });
  }

  async updateReviewStatus(id: string, status: string): Promise<any> {
    return this.withRetry(async () => {
      try {
        const [updated] = await db
          .update(reviews)
          .set({ status } as any)
          .where(eq(reviews.id, id))
          .returning();
        return updated;
      } catch (e: any) {
        if (e?.message?.includes("column") || e?.message?.includes("does not exist")) {
          console.warn("[REVIEW] status column not yet migrated — run migration 0003");
          return { id, status, _migrationPending: true };
        }
        throw e;
      }
    });
  }

  async deleteReview(id: string): Promise<void> {
    return this.withRetry(async () => {
      await db.delete(reviews).where(eq(reviews.id, id));
    });
  }

  // Wishlist
  async getWishlistItems(userId: string): Promise<WishlistItem[]> {
    return await db.select().from(wishlistItems).where(eq(wishlistItems.userId, userId));
  }

  async getWishlistItem(userId: string, tourId: string): Promise<WishlistItem | undefined> {
    return this.withRetry(async () => {
      const [item] = await db
        .select()
        .from(wishlistItems)
        .where(and(eq(wishlistItems.userId, userId), eq(wishlistItems.tourId, tourId)));
      return item || undefined;
    });
  }

  async addToWishlist(item: InsertWishlistItem): Promise<WishlistItem> {
    return this.withRetry(async () => {
      const [created] = await db.insert(wishlistItems).values(item).returning();
      return created;
    });
  }

  async removeFromWishlist(userId: string, tourId: string): Promise<void> {
    return this.withRetry(async () => {
      await db
        .delete(wishlistItems)
        .where(and(eq(wishlistItems.userId, userId), eq(wishlistItems.tourId, tourId)));
    });
  }

  async isInWishlist(userId: string, tourId: string): Promise<boolean> {
    const item = await this.getWishlistItem(userId, tourId);
    return !!item;
  }

  // Newsletter
  async getNewsletterSubscribers(): Promise<NewsletterSubscriber[]> {
    return await db.select().from(newsletterSubscribers).orderBy(desc(newsletterSubscribers.subscribedAt));
  }

  async getNewsletterSubscriber(email: string): Promise<NewsletterSubscriber | undefined> {
    const [subscriber] = await db.select().from(newsletterSubscribers).where(eq(newsletterSubscribers.email, email));
    return subscriber || undefined;
  }

  async subscribeNewsletter(subscriber: InsertNewsletterSubscriber): Promise<NewsletterSubscriber> {
    const existing = await this.getNewsletterSubscriber(subscriber.email);
    if (existing) {
      // MED-3 FIX: Preserve existing `confirmed` status on resubscription.
      // Previously this reset confirmed to false, making confirmed users re-verify.
      const [updated] = await db
        .update(newsletterSubscribers)
        .set({ unsubscribedAt: null })
        .where(eq(newsletterSubscribers.email, subscriber.email))
        .returning();
      return updated;
    }
    const [created] = await db.insert(newsletterSubscribers).values(subscriber).returning();
    return created;
  }

  async unsubscribeNewsletter(email: string): Promise<void> {
    await db
      .update(newsletterSubscribers)
      .set({ unsubscribedAt: new Date() })
      .where(eq(newsletterSubscribers.email, email));
  }

  // Addon operations
  async getAddons(): Promise<Addon[]> {
    return await db.select().from(addons).orderBy(desc(addons.createdAt));
  }

  async getActiveAddons(): Promise<Addon[]> {
    return this.withRetry(() => db.select().from(addons).where(eq(addons.active, true)).orderBy(desc(addons.createdAt)));
  }

  async getAddon(id: string): Promise<Addon | undefined> {
    const [addon] = await db.select().from(addons).where(eq(addons.id, id));
    return addon || undefined;
  }

  async createAddon(insertAddon: InsertAddon): Promise<Addon> {
    const [addon] = await db.insert(addons).values(insertAddon).returning();
    return addon;
  }

  async updateAddon(id: string, updateData: Partial<InsertAddon>): Promise<Addon> {
    const [addon] = await db
      .update(addons)
      .set({ ...updateData })
      .where(eq(addons.id, id))
      .returning();
    return addon;
  }

  async deleteAddon(id: string): Promise<void> {
    await db.delete(addons).where(eq(addons.id, id));
  }

  async createBookingAddon(item: InsertBookingAddon): Promise<BookingAddon> {
    const [newAddon] = await db.insert(bookingAddons).values(item).returning();
    return newAddon;
  }

  async getBookingAddons(bookingId: string): Promise<BookingAddon[]> {
    return await db.select().from(bookingAddons).where(eq(bookingAddons.bookingId, bookingId));
  }

  // CMS Content
  async getCmsContent(blockSlug: string, locale?: string): Promise<CmsContent[]> {
    if (locale) {
      return await db
        .select()
        .from(cmsContent)
        .where(and(eq(cmsContent.blockSlug, blockSlug), eq(cmsContent.locale, locale)))
        .orderBy(cmsContent.sortOrder);
    }
    return await db
      .select()
      .from(cmsContent)
      .where(eq(cmsContent.blockSlug, blockSlug))
      .orderBy(cmsContent.sortOrder);
  }

  async getAllCmsContent(): Promise<CmsContent[]> {
    return await db.select().from(cmsContent).orderBy(cmsContent.sortOrder);
  }

  async getCmsContentItem(id: string): Promise<CmsContent | undefined> {
    const [item] = await db.select().from(cmsContent).where(eq(cmsContent.id, id));
    return item || undefined;
  }

  async createCmsContent(content: InsertCmsContent): Promise<CmsContent> {
    const [created] = await db.insert(cmsContent).values(content).returning();
    return created;
  }

  async updateCmsContent(id: string, data: Partial<InsertCmsContent>): Promise<CmsContent> {
    const [updated] = await db
      .update(cmsContent)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(cmsContent.id, id))
      .returning();
    return updated;
  }

  async deleteCmsContent(id: string): Promise<void> {
    await db.delete(cmsContent).where(eq(cmsContent.id, id));
  }

  // Availability & Holds
  async getTourInstances(tourId: string, date: string): Promise<TourInstance[]> {
    return this.withRetry(() => db
      .select()
      .from(tourInstances)
      .where(and(eq(tourInstances.tourId, tourId), eq(tourInstances.serviceDate, date))));
  }

  async getTourInstance(tourId: string, date: string, slot?: string): Promise<TourInstance | undefined> {
    const filters = [eq(tourInstances.tourId, tourId), eq(tourInstances.serviceDate, date)];
    if (slot) {
      filters.push(eq(tourInstances.timeSlot, slot));
    } else {
      filters.push(sql`${tourInstances.timeSlot} IS NULL`);
    }

    const [instance] = await db.select().from(tourInstances).where(and(...filters));
    return instance || undefined;
  }

  async getTourInstanceById(id: string): Promise<TourInstance | undefined> {
    const [instance] = await db.select().from(tourInstances).where(eq(tourInstances.id, id));
    return instance || undefined;
  }

  async createTourInstance(instance: InsertTourInstance): Promise<TourInstance> {
    const [created] = await db.insert(tourInstances).values(instance).returning();
    return created;
  }

  async updateTourInstance(id: string, data: Partial<InsertTourInstance>): Promise<TourInstance> {
    const [updated] = await db
      .update(tourInstances)
      .set(data)
      .where(eq(tourInstances.id, id))
      .returning();
    return updated;
  }

  async deleteTourInstance(id: string): Promise<void> {
    await db.delete(tourInstances).where(eq(tourInstances.id, id));
  }

  async getHold(id: string): Promise<AvailabilityHold | undefined> {
    return this.withRetry(async () => {
      const [hold] = await db.select().from(availabilityHolds).where(eq(availabilityHolds.id, id));
      return hold || undefined;
    });
  }

  async createHold(hold: InsertAvailabilityHold): Promise<AvailabilityHold> {
    // Ensure expiresAt and status defaults to prevent accidental non-expiring holds
    const normalized = { ...hold } as any;
    if (!normalized.expiresAt) {
      const expires = new Date();
      expires.setMinutes(expires.getMinutes() + 15); // default TTL 15 minutes
      normalized.expiresAt = expires;
    }
    if (!normalized.status) normalized.status = 'ACTIVE';
    const [created] = await db.insert(availabilityHolds).values(normalized).returning();
    return created;
  }

  async updateHold(id: string, data: Partial<InsertAvailabilityHold>): Promise<AvailabilityHold> {
    const [updated] = await db.update(availabilityHolds).set(data).where(eq(availabilityHolds.id, id)).returning();
    await db.insert(capacityAuditLog).values({
      tourInstanceId: updated.tourInstanceId,
      productId: 'N/A',
      action: 'hold_updated',
      quantity: updated.quantity,
      newState: updated,
      metadata: { bookingSessionId: updated.bookingSessionId }
    }).returning();
    return updated;
  }

  async getExpiredHolds(now: Date): Promise<AvailabilityHold[]> {
    return this.withRetry(async () => {
      return await db
        .select()
        .from(availabilityHolds)
        .where(
          and(
            eq(availabilityHolds.status, 'ACTIVE'),
            lt(availabilityHolds.expiresAt, now)
          )
        )
        .orderBy(availabilityHolds.expiresAt);
    });
  }

  async getHoldsBySession(sessionId: string): Promise<AvailabilityHold[]> {
    return await db.select().from(availabilityHolds).where(and(eq(availabilityHolds.bookingSessionId, sessionId), eq(availabilityHolds.status, 'ACTIVE')));
  }

  // Projections
  async upsertBookingSummary(summary: any): Promise<void> {
    await db.insert(bookingSummaries)
      .values(summary)
      .onConflictDoUpdate({
        target: bookingSummaries.bookingId,
        set: summary
      });
  }

  async updateBookingSummary(bookingId: string, data: any): Promise<void> {
    await db.update(bookingSummaries)
      .set(data)
      .where(eq(bookingSummaries.bookingId, bookingId));
  }

  async incrementDailyRevenue(dateStr: string, amount: number, vat: number): Promise<void> {
    await db.insert(revenueDaily)
      .values({ date: dateStr, totalGross: amount, totalVat: vat })
      .onConflictDoUpdate({
        target: revenueDaily.date,
        set: {
          totalGross: sql`${revenueDaily.totalGross} + ${amount}`,
          totalVat: sql`${revenueDaily.totalVat} + ${vat}`
        }
      });
  }

  async upsertPaymentOverview(overview: any): Promise<void> {
    await db.insert(paymentOverviews)
      .values(overview)
      .onConflictDoUpdate({
        target: paymentOverviews.paymentId,
        set: {
          ...overview,
          updatedAt: new Date()
        }
      });
  }

  async clearProjections(): Promise<void> {
    await db.delete(bookingSummaries);
    await db.delete(revenueDaily);
    await db.delete(paymentOverviews);
  }

  // Feature Flags
  async getFeatureFlags(): Promise<FeatureFlag[]> {
    return await db.select().from(featureFlags);
  }

  async getFeatureFlag(slug: string): Promise<FeatureFlag | undefined> {
    const [flag] = await db.select().from(featureFlags).where(eq(featureFlags.slug, slug));
    return flag || undefined;
  }

  async upsertFeatureFlag(flag: InsertFeatureFlag): Promise<FeatureFlag> {
    const existing = await this.getFeatureFlag(flag.slug);
    if (existing) {
      const [updated] = await db
        .update(featureFlags)
        .set({ ...flag, updatedAt: new Date() })
        .where(eq(featureFlags.slug, flag.slug))
        .returning();
      return updated;
    }
    const [created] = await db.insert(featureFlags).values(flag).returning();
    return created;
  }

  // Resources (Phase 1)
  async getResourcesByProduct(productId: string): Promise<Resource[]> {
    return await db.select().from(resources).where(eq(resources.productId, productId));
  }

  async getResource(id: string): Promise<Resource | undefined> {
    const [resource] = await db.select().from(resources).where(eq(resources.id, id));
    return resource || undefined;
  }

  async getAvailableResources(productId: string, date: string, startTime?: string, endTime?: string): Promise<Resource[]> {
    return this.withRetry(async () => {
      // Find resources for this product that are active
      const allResources = await db.select().from(resources)
        .where(and(eq(resources.productId, productId), eq(resources.status, 'active')));

      // Get all active holds for this product on this date
      // For vehicles, we check interval overlap: start1 < end2 AND start2 < end1
      const activeHolds = await db
        .select({
          resourceId: availabilityHolds.resourceId,
          startTime: tourInstances.startTime,
          endTime: tourInstances.endTime
        })
        .from(availabilityHolds)
        .innerJoin(tourInstances, eq(availabilityHolds.tourInstanceId, tourInstances.id))
        .where(and(
          eq(tourInstances.tourId, productId),
          eq(tourInstances.serviceDate, date),
          sql`availability_holds.status IN ('ACTIVE', 'CONFIRMED')`,
          sql`${availabilityHolds.resourceId} IS NOT NULL`
        ));

      if (!startTime && !endTime) {
        // Full day or legacy check - any hold on this date blocks the resource
        const heldResourceIds = new Set<string>();
        activeHolds.forEach(h => {
          if (h.resourceId) heldResourceIds.add(h.resourceId);
        });
        return allResources.filter(r => !heldResourceIds.has(r.id));
      }

      // Time-aware overlap check
      const { timeToMinutes } = await import("./domain/availability/time-interval.js");
      const reqStart = timeToMinutes(startTime || "00:00");
      const reqEnd = timeToMinutes(endTime || "23:59");

      const heldResourceIds = new Set<string>();
      activeHolds.forEach(h => {
        if (!h.resourceId) return;

        const holdStart = timeToMinutes(h.startTime || "00:00");
        const holdEnd = timeToMinutes(h.endTime || "23:59");

        // Interval overlap: start1 < end2 AND start2 < end1
        if (reqStart < holdEnd && holdStart < reqEnd) {
          heldResourceIds.add(h.resourceId);
        }
      });

      return allResources.filter(r => !heldResourceIds.has(r.id));
    });
  }

  async getAvailableResourcesMultiDay(productId: string, startDate: string, duration: number, startTime?: string, endTime?: string): Promise<Resource[]> {
    const start = new Date(startDate);
    const dates: string[] = [];
    for (let i = 0; i < duration; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      dates.push(d.toISOString().split('T')[0]);
    }

    // A resource is available for the multi-day period if it is available on EACH day
    const allResources = await db.select().from(resources)
      .where(and(eq(resources.productId, productId), eq(resources.status, 'active')));

    // Get all active or confirmed holds for this product across ANY of the requested dates
    const heldResources = await db
      .select({
        resourceId: availabilityHolds.resourceId,
        date: tourInstances.serviceDate,
        startTime: tourInstances.startTime,
        endTime: tourInstances.endTime
      })
      .from(availabilityHolds)
      .innerJoin(tourInstances, eq(availabilityHolds.tourInstanceId, tourInstances.id))
      .where(and(
        eq(tourInstances.tourId, productId),
        sql`tour_instances.service_date IN ${dates}`,
        sql`availability_holds.status IN ('ACTIVE', 'CONFIRMED')`,
        sql`${availabilityHolds.resourceId} IS NOT NULL`
      ));

    const { timeToMinutes } = await import("./domain/availability/time-interval.js");
    const reqStart = timeToMinutes(startTime || "00:00");
    const reqEnd = timeToMinutes(endTime || "23:59");

    const heldResourceIdsByDate = new Map<string, Set<string>>();
    heldResources.forEach(h => {
      if (!h.resourceId) return;

      const holdStart = timeToMinutes(h.startTime || "00:00");
      const holdEnd = timeToMinutes(h.endTime || "23:59");

      if (reqStart < holdEnd && holdStart < reqEnd) {
        if (!heldResourceIdsByDate.has(h.date)) {
          heldResourceIdsByDate.set(h.date, new Set());
        }
        heldResourceIdsByDate.get(h.date)!.add(h.resourceId);
      }
    });

    return allResources.filter(resource => {
      // Resource must be free on EVERY day
      return dates.every(date => {
        const heldOnDate = heldResourceIdsByDate.get(date);
        return !heldOnDate || !heldOnDate.has(resource.id);
      });
    });
  }

  async createResource(resource: InsertResource): Promise<Resource> {
    const [created] = await db.insert(resources).values(resource).returning();
    return created;
  }

  async updateResource(id: string, data: Partial<InsertResource>): Promise<Resource> {
    const [updated] = await db
      .update(resources)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(resources.id, id))
      .returning();
    return updated;
  }

  async deleteResource(id: string): Promise<void> {
    await db.delete(resources).where(eq(resources.id, id));
  }

  // Blackout Dates (Phase 4 — tours, transfers, vehicles)
  async getBlackoutDates(productId: string): Promise<BlackoutDate[]> {
    return this.withRetry(() => db.select().from(productBlackoutDates).where(eq(productBlackoutDates.productId, productId)));
  }

  async isBlackedOut(productId: string, date: string): Promise<boolean> {
    return this.withRetry(async () => {
      const [blackout] = await db
        .select()
        .from(productBlackoutDates)
        .where(
          and(
            eq(productBlackoutDates.productId, productId),
            eq(productBlackoutDates.date, date)
          )
        );
      return !!blackout;
    });
  }

  async createBlackoutDate(data: InsertBlackoutDate): Promise<BlackoutDate> {
    const [created] = await db.insert(productBlackoutDates).values(data).returning();
    return created;
  }

  async deleteBlackoutDate(id: string): Promise<void> {
    await db.delete(productBlackoutDates).where(eq(productBlackoutDates.id, id));
  }

  // Pricing Versions (Phase 5)
  async getPricingVersions(productId: string): Promise<PricingVersion[]> {
    return this.withRetry(() => db.select().from(pricingVersions).where(eq(pricingVersions.productId, productId)));
  }

  async getEffectivePricingVersion(productId: string, date: string): Promise<PricingVersion | undefined> {
    return this.withRetry(async () => {
      const [version] = await db
        .select()
        .from(pricingVersions)
        .where(
          and(
            eq(pricingVersions.productId, productId),
            lte(pricingVersions.effectiveFrom, date)
          )
        )
        .orderBy(desc(pricingVersions.effectiveFrom))
        .limit(1);
      return version || undefined;
    });
  }

  async createPricingVersion(version: InsertPricingVersion): Promise<PricingVersion> {
    const [created] = await db.insert(pricingVersions).values(version).returning();
    return created;
  }

  // Capacity Audit Log (Phase 7)
  async createAuditLogEntry(entry: InsertCapacityAuditLog, tx?: any): Promise<CapacityAuditLog> {
    const executor = tx || db;
    const [created] = await executor.insert(capacityAuditLog).values(entry).returning();
    return created;
  }

  async getAuditLog(filters?: { productId?: string; action?: string; limit?: number; offset?: number }): Promise<CapacityAuditLog[]> {
    const conditions = [];
    if (filters?.productId) conditions.push(eq(capacityAuditLog.productId, filters.productId));
    if (filters?.action) conditions.push(eq(capacityAuditLog.action, filters.action));

    const query = db.select().from(capacityAuditLog)
      .orderBy(desc(capacityAuditLog.createdAt))
      .limit(filters?.limit || 100)
      .offset(filters?.offset || 0);

    if (conditions.length > 0) {
      return await query.where(and(...conditions));
    }
    return await query;
  }
}

export const storage = new DatabaseStorage();
