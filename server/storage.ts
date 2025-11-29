import { 
  users, 
  tours,
  bookings,
  contentBlocks,
  siteSettings,
  paymentGateways,
  payments,
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
  type InsertPayment
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, sql } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
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
  createBooking(booking: InsertBooking): Promise<Booking>;
  updateBooking(id: string, booking: Partial<InsertBooking>): Promise<Booking>;
  deleteBooking(id: string): Promise<void>;
  
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

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
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
      .values(insertTour)
      .returning();
    return tour;
  }

  async updateTour(id: string, updateData: Partial<InsertTour>): Promise<Tour> {
    const [tour] = await db
      .update(tours)
      .set(updateData)
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

  async deleteBooking(id: string): Promise<void> {
    await db.delete(bookings).where(eq(bookings.id, id));
  }

  // Analytics
  async getBookingStats(): Promise<{ total: number; confirmed: number; pending: number; completed: number; }> {
    const allBookings = await db.select().from(bookings);
    return {
      total: allBookings.length,
      confirmed: allBookings.filter(b => b.status === 'confirmed').length,
      pending: allBookings.filter(b => b.status === 'pending').length,
      completed: allBookings.filter(b => b.status === 'completed').length,
    };
  }

  async getRevenueByMonth(): Promise<{ month: string; total: number; }[]> {
    // Simple aggregation - can be enhanced with actual SQL aggregation
    const allBookings = await db.select().from(bookings);
    const monthlyData: Record<string, number> = {};
    
    allBookings.forEach(booking => {
      const date = new Date(booking.date);
      const monthKey = date.toLocaleDateString('en-US', { month: 'short' });
      const amount = parseFloat(booking.amount.replace('$', '').replace(',', ''));
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
    // First, unset all defaults
    await db.update(paymentGateways).set({ isDefault: false });
    // Then set the new default
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
}

export const storage = new DatabaseStorage();
