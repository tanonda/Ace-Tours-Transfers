import { Request } from "express";

// Define an interface for session management to allow for different implementations (e.g., for testing or different frameworks)
export interface ISessionAdapter {
  getUserId(): string | undefined;
  getUserRole(): string | undefined;
  setSession(userId: string, userRole: string): void;
  destroySession(): Promise<void>;
}

// Concrete implementation for Express.js sessions
export class ExpressSessionAdapter implements ISessionAdapter {
  private req: Request;

  constructor(req: Request) {
    this.req = req;
  }

  getUserId(): string | undefined {
    return this.req.session.userId;
  }

  getUserRole(): string | undefined {
    return this.req.session.userRole;
  }

  setSession(userId: string, userRole: string): void {
    this.req.session.userId = userId;
    this.req.session.userRole = userRole;
  }

  destroySession(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.req.session.destroy((err) => {
        if (err) {
          return reject(err);
        }
        this.req.res?.clearCookie("connect.sid");
        resolve();
      });
    });
  }
}
