import bcrypt from "bcryptjs";
import { storage } from "../../storage";
import { User } from "@shared/schema";

interface AuthResult {
  id: string;
  username: string;
  email: string;
  name: string;
  role: string;
}

export class AuthDomainService {
  /**
   * Handles user login with support for both bcrypt and legacy plain text passwords.
   */
  public async login(email: string, password: string): Promise<AuthResult | null> {
    const user = await storage.getUserByEmail(email);
    if (!user) {
      return null;
    }


    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return null;
    }

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      role: user.role,
    };
  }

  /**
   * Retrieves user details for the authenticated user.
   */
  public async getAuthenticatedUser(userId: string): Promise<AuthResult | null> {
    const user = await storage.getUser(userId);
    if (!user) {
      return null;
    }

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      role: user.role,
    };
  }
}

export const authDomainService = new AuthDomainService();
