import { storage } from "../../storage";
import { User, InsertUser } from "@shared/schema";

export class UserProfileDomainService {
  public async getAllUsers(): Promise<Omit<User, "password">[]> {
    const users = await storage.getAllUsers();
    return users.map(({ password, ...user }) => user);
  }

  public async createUser(userData: InsertUser): Promise<Omit<User, "password">> {
    const user = await storage.createUser({
      ...userData,
      role: 'customer'
    } as any);
    
    // Link any existing guest bookings with the same email
    try {
      await storage.linkBookingsToUser(user.email, user.id);
    } catch (linkError) {
      console.error(`Failed to link bookings for user ${user.id}:`, linkError);
    }

    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  public async updateUserRole(userId: string, role: string): Promise<Omit<User, "password"> | null> {
    // Current valid roles in A are 'admin' and 'customer'
    const validRoles = ["admin", "customer"];
    if (!validRoles.includes(role)) {
      throw new Error("Invalid role provided");
    }

    const user = await storage.updateUserRole(userId, role);
    if (!user) {
      return null;
    }
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  public async updateUserPassword(userId: string, newPassword: string): Promise<Omit<User, "password"> | null> {
    if (!newPassword) {
      throw new Error("New password is required");
    }

    const user = await storage.updateUserPassword(userId, newPassword);
    if (!user) {
      return null;
    }
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  public async getUserById(userId: string): Promise<Omit<User, "password"> | null> {
    const user = await storage.getUser(userId);
    if (!user) {
      return null;
    }
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  public async getCustomers(): Promise<Omit<User, "password">[]> {
    const customers = await storage.getCustomers();
    return customers.map(({ password, ...user }) => user);
  }
}

export const userProfileDomainService = new UserProfileDomainService();
