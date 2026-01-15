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
  bookingItems
} from "../shared/schema.js";
import { db } from "./db.js";
import { eq, like, desc, and, or, isNull, sql } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  updateUserRole(id: string, role: string): Promise<User | undefined>;
  updateUserPassword(id: string, password: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getCustomers(): Promise<User[]>;

  // Tour operations
  getTours(): Promise<Tour[]>;
  getTour(id: string): Promise<Tour | undefined>;
  createTour(tour: InsertTour): Promise<Tour>;
  updateTour(id: string, tour: Partial<InsertTour>): Promise<Tour>;
  deleteTour(id: string): Promise<void>;

  // Booking operations
  getBookings(): Promise<Booking[]>;
  getBooking(id: string): Promise<Booking | undefined>;
  getUserBookings(userId: string): Promise<Booking[]>;
  getBookingsForServiceAndDate(serviceId: string, dateString: string): Promise<Booking[]>; 
  getBookingsBySession(sessionId: string): Promise<Booking[]>;
  createBooking(booking: InsertBooking): Promise<Booking>;
  updateBooking(id: string, booking: Partial<InsertBooking>): Promise<Booking>;
  linkBookingsToUser(email: string, userId: string): Promise<void>;
  deleteBooking(id: string): Promise<void>;
  createBookingItem(item: InsertBookingItem): Promise<BookingItem>;
  getBookingItems(bookingId: string): Promise<BookingItem[]>;

  // Analytics
  getBookingStats(): Promise<{ total: number; confirmed: number; pending: number; completed: number; }>;
  getRevenueByMonth(): Promise<{ month: string; total: number; }[]>;

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

  // Notifications
  createNotification(notification: InsertNotification): Promise<Notification>;
  getUnreadNotifications(userId?: string): Promise<Notification[]>;
  markNotificationAsRead(id: string): Promise<void>;

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

  // CMS Content
  getCmsContent(blockSlug: string, locale?: string): Promise<CmsContent[]>;
  getCmsContentItem(id: string): Promise<CmsContent | undefined>;
  createCmsContent(content: InsertCmsContent): Promise<CmsContent>;
  updateCmsContent(id: string, data: Partial<InsertCmsContent>): Promise<CmsContent>;
  deleteCmsContent(id: string): Promise<void>;

  // Availability & Holds
  getTourInstance(tourId: string, date: string, slot?: string): Promise<TourInstance | undefined>;
  getTourInstanceById(id: string): Promise<TourInstance | undefined>;
  createTourInstance(instance: InsertTourInstance): Promise<TourInstance>;
  updateTourInstance(id: string, data: Partial<InsertTourInstance>): Promise<TourInstance>;
  
  getHold(id: string): Promise<AvailabilityHold | undefined>;
  createHold(hold: InsertAvailabilityHold): Promise<AvailabilityHold>;
  updateHold(id: string, data: Partial<InsertAvailabilityHold>): Promise<AvailabilityHold>;
  getExpiredHolds(now: Date): Promise<AvailabilityHold[]>;

  // Projections
  upsertBookingSummary(summary: any): Promise<void>;
  updateBookingSummary(bookingId: string, data: any): Promise<void>;
  incrementDailyRevenue(date: string, amount: number, vat: number): Promise<void>;
  upsertPaymentOverview(overview: any): Promise<void>;
  clearProjections(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async updateUserRole(id: string, role: string): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ role, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  async updateUserPassword(id: string, password: string): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ password, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getCustomers(): Promise<User[]> {
    return await db.select().from(users).where(eq(users.role, 'customer'));
  }

  // Tour operations
  async getTours(): Promise<Tour[]> {
    return await db.select().from(tours);
  }

  async getTour(id: string): Promise<Tour | undefined> {
    const [tour] = await db.select().from(tours).where(eq(tours.id, id));
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
  async getBookings(): Promise<Booking[]> {
    return await db.select().from(bookings).orderBy(desc(bookings.createdAt));
  }

  async getBooking(id: string): Promise<Booking | undefined> {
    const [booking] = await db.select().from(bookings).where(eq(bookings.id, id));
    return booking || undefined;
  }

  async getUserBookings(userId: string): Promise<Booking[]> {
    return await db
      .select()
      .from(bookings)
      .where(eq(bookings.userId, userId))
      .orderBy(desc(bookings.createdAt));
  }

  async getBookingsForServiceAndDate(serviceId: string, dateString: string): Promise<Booking[]> {
    return await db
      .select()
      .from(bookings)
      .where(and(
        eq(bookings.tourId, serviceId),
        eq(bookings.date, dateString)
      ));
  }

  async getBookingsBySession(sessionId: string): Promise<Booking[]> {
    return await db
      .select()
      .from(bookings)
      .where(eq(bookings.bookingSessionId, sessionId))
      .orderBy(desc(bookings.createdAt));
  }

  async createBooking(insertBooking: InsertBooking): Promise<Booking> {
    const [booking] = await db
      .insert(bookings)
      .values(insertBooking)
      .returning();
    return booking;
  }

  async updateBooking(id: string, updateData: Partial<InsertBooking>): Promise<Booking> {
    const [booking] = await db
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

  async deleteBooking(id: string): Promise<void> {
    await db.delete(bookings).where(eq(bookings.id, id));
  }

  async createBookingItem(item: InsertBookingItem): Promise<BookingItem> {
    const [newItem] = await db.insert(bookingItems).values(item).returning();
    return newItem;
  }

  async getBookingItems(bookingId: string): Promise<BookingItem[]> {
    return await db.select().from(bookingItems).where(eq(bookingItems.bookingId, bookingId));
  }

  // Analytics
  async getBookingStats(): Promise<{ total: number; confirmed: number; pending: number; completed: number; }> {
    const allBookings = await db.select().from(bookings);
    return {
      total: allBookings.length,
      confirmed: allBookings.filter((b: Booking) => b.status === 'confirmed').length,
      pending: allBookings.filter((b: Booking) => b.status === 'pending').length,
      completed: allBookings.filter((b: Booking) => b.status === 'completed').length,
    };
  }

  async getRevenueByMonth(): Promise<{ month: string; total: number; }[]> {
    const allBookings = await db.select().from(bookings);
    const monthlyData: Record<string, number> = {};

    allBookings.forEach((booking: Booking) => {
      const date = new Date(booking.date);
      const monthKey = date.toLocaleDateString('en-US', { month: 'short' });
      const amount = parseFloat(booking.amount.replace(/[^0-9.-]+/g, '') || '0');
      monthlyData[monthKey] = (monthlyData[monthKey] || 0) + amount;
    });

    return Object.entries(monthlyData).map(([month, total]) => ({ month, total }));
  }

  // Content Blocks (CMS)
  async getContentBlocks(): Promise<ContentBlock[]> {
    return await db.select().from(contentBlocks);
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
    return await db.select().from(siteSettings);
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
    return await db
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.status, 'processing'),
          sql`(${payments.lastReconciledAt} IS NULL OR ${payments.lastReconciledAt} < NOW() - INTERVAL '30 minutes')`,
          sql`${payments.createdAt} < NOW() - INTERVAL '1 hour'`
        )
      )
      .limit(batchSize);
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

  // Wishlist
  async getWishlistItems(userId: string): Promise<WishlistItem[]> {
    return await db.select().from(wishlistItems).where(eq(wishlistItems.userId, userId));
  }

  async getWishlistItem(userId: string, tourId: string): Promise<WishlistItem | undefined> {
    const [item] = await db
      .select()
      .from(wishlistItems)
      .where(and(eq(wishlistItems.userId, userId), eq(wishlistItems.tourId, tourId)));
    return item || undefined;
  }

  async addToWishlist(item: InsertWishlistItem): Promise<WishlistItem> {
    const [created] = await db.insert(wishlistItems).values(item).returning();
    return created;
  }

  async removeFromWishlist(userId: string, tourId: string): Promise<void> {
    await db
      .delete(wishlistItems)
      .where(and(eq(wishlistItems.userId, userId), eq(wishlistItems.tourId, tourId)));
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
      const [updated] = await db
        .update(newsletterSubscribers)
        .set({ unsubscribedAt: null, confirmed: false })
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

  async getHold(id: string): Promise<AvailabilityHold | undefined> {
    const [hold] = await db.select().from(availabilityHolds).where(eq(availabilityHolds.id, id));
    return hold || undefined;
  }

  async createHold(hold: InsertAvailabilityHold): Promise<AvailabilityHold> {
    const [created] = await db.insert(availabilityHolds).values(hold).returning();
    return created;
  }

  async updateHold(id: string, data: Partial<InsertAvailabilityHold>): Promise<AvailabilityHold> {
    const [updated] = await db
      .update(availabilityHolds)
      .set(data)
      .where(eq(availabilityHolds.id, id))
      .returning();
    return updated;
  }

  async getExpiredHolds(now: Date): Promise<AvailabilityHold[]> {
    return await db
      .select()
      .from(availabilityHolds)
      .where(
        and(
          eq(availabilityHolds.status, 'ACTIVE'),
          sql`${availabilityHolds.expiresAt} < ${now}`
        )
      );
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
}

export const storage = new DatabaseStorage();
