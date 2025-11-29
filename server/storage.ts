import { 
  users, 
  tours,
  bookings,
  type User, 
  type InsertUser,
  type Tour,
  type InsertTour,
  type Booking,
  type InsertBooking
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
}

export const storage = new DatabaseStorage();
