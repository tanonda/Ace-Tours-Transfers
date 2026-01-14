
import { 
  AuthDomainService, 
  type AuthResult 
} from "./auth.domain-service.js";
import { 
  type User, 
  type InsertUser, 
  tours, 
  bookings, 
  users 
} from "../../../shared/schema.js";
import { storage, type IStorage } from "../../storage.js";
import { eq, and, sql } from "drizzle-orm";
import { db } from "../../db.js";
import bcrypt from "bcryptjs";

export class UserProfileDomainService {
  private storage: IStorage;

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  async getAllUsers(): Promise<User[]> {
    return this.storage.getAllUsers();
  }

  async getUserById(id: string): Promise<User | undefined> {
    return this.storage.getUser(id);
  }

  async createUser(userData: InsertUser): Promise<User> {
    const existingUserByEmail = await this.storage.getUserByEmail(userData.email);
    if (existingUserByEmail) {
      throw new Error(`User with this email already exists: ${userData.email}`);
    }

    const existingUserByUsername = await this.storage.getUserByUsername(userData.username);
    if (existingUserByUsername) {
      throw new Error(`User with this username already exists: ${userData.username}`);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    
    // Create the user
    const user = await this.storage.createUser({
      ...userData,
      password: hashedPassword,
    });

    // Integrated logic: Link guest bookings to this new user if they exist
    try {
      await this.storage.linkBookingsToUser(user.email, user.id);
      console.log(`[USER][LINK] Linked existing bookings for ${user.email} to UID ${user.id}`);
    } catch (linkError) {
      console.error(`[USER][ERROR] Failed to link bookings for ${user.email}:`, linkError);
      // We don't throw here as user creation succeeded
    }

    return user;
  }

  async updateUserRole(id: string, role: string): Promise<User | undefined> {
    const validRoles = ['admin', 'field_service', 'customer'];
    if (!validRoles.includes(role)) {
      throw new Error(`Invalid role: ${role}. Valid roles are: ${validRoles.join(', ')}`);
    }
    return this.storage.updateUserRole(id, role);
  }

  async updateUserPassword(id: string, newPassword: string): Promise<User | undefined> {
    if (!newPassword) {
      throw new Error("New password is required");
    }
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    return this.storage.updateUserPassword(id, hashedPassword);
  }

  /**
   * CUSTOMER MANAGEMENT
   */
  async getCustomers(): Promise<User[]> {
    return this.storage.getCustomers();
  }

  /**
   * GUEST FLOWS
   */
  async findOrCreateGuestUser(email: string, name: string): Promise<User> {
    const existing = await this.storage.getUserByEmail(email);
    if (existing) return existing;

    // Create a shadow/guest user
    const username = `guest_${Math.random().toString(36).substring(2, 9)}`;
    const guestPassword = await bcrypt.hash(Math.random().toString(36), 10);

    return this.storage.createUser({
      username,
      password: guestPassword,
      email,
      name
    });
  }
}

export const userProfileDomainService = new UserProfileDomainService(storage);
