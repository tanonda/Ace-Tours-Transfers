
import { type User, type InsertUser } from "../../../shared/schema.js";
import { type IStorage, storage } from "../../storage.js";
import { mailingService } from "../../infrastructure/mailing/MailingService.js";
import bcrypt from "bcryptjs";

export interface AuthResult extends User {
  // Add any extra fields needed for the auth response
}

export class AuthDomainService {
  private storage: IStorage;

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  async login(email: string, password: string): Promise<AuthResult | null> {
    const user = await this.storage.getUserByEmail(email.trim().toLowerCase());
    if (!user) return null;

    const isPasswordValid = await this.verifyPassword(password, user.password);
    if (!isPasswordValid) return null;

    if (user.isActive === false) {
      throw new Error("Account is suspended. Please contact administrator.");
    }

    return user;
  }

  private async verifyPassword(password: string, storedPassword: string): Promise<boolean> {
    if (!storedPassword) {
      return false;
    }

    try {
      return await bcrypt.compare(password, storedPassword);
    } catch (error) {
      // Backwards compatibility for legacy plaintext passwords.
      // If bcrypt compare fails due to an invalid hash format, gracefully
      // fall back to direct comparison instead of surfacing a 500.
      const bcryptErrorMessage = error instanceof Error ? error.message : "";
      if (bcryptErrorMessage.toLowerCase().includes("invalid salt")) {
        return password === storedPassword;
      }
      return false;
    }
  }

  /**
   * Domain logic for registration.
   * Ensures business rules (unique email) and side effects (welcome email).
   */
  async register(name: string, email: string, password: string): Promise<AuthResult> {
    const existing = await this.storage.getUserByEmail(email);
    if (existing) {
      throw new Error(`User with this email already exists: ${email}`);
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const username = email.split('@')[0] + Math.random().toString(36).substring(2, 5);

    const user = await this.storage.createUser({
      name,
      email,
      username,
      password: hashedPassword,
    });

    // Side Effect: Welcome Email (Fire and forget or handle error gracefully)
    try {
      // In a real system, we'd emit a 'UserRegistered' event here.
      // For now, call the mailing service directly.
      // await mailingService.sendWelcomeEmail(user.email, user.name);
      console.log(`[AUTH] Welcome email would be sent to ${user.email}`);
    } catch (e) {
      console.error("[AUTH] Failed to send welcome email:", e);
    }

    return user;
  }

  async getAuthenticatedUser(userId: string): Promise<AuthResult | null> {
    const user = await this.storage.getUser(userId);
    return user || null;
  }
}

export const authDomainService = new AuthDomainService(storage);
