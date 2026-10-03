import { Request } from "express";

// Define an interface for session management to allow for different implementations (e.g., for testing or different frameworks)
export interface ISessionAdapter {
  getUserId(): string | undefined;
  getUserRole(): string | undefined;
  setSession(userId: string, userRole: string): Promise<void>;
  destroySession(): Promise<void>;
}

// Guest checkout state that must survive login, or the booking just made becomes unviewable.
const CARRIED_OVER_ON_LOGIN = ["recentBookingIds", "bookingSessionId", "bookingSessionExpiresAt"] as const;

// Concrete implementation for Express.js sessions
export class ExpressSessionAdapter implements ISessionAdapter {
  private req: Request;

  constructor(req: Request) {
    this.req = req;
  }

  getUserId(): string | undefined {
    return this.req.session?.userId;
  }

  getUserRole(): string | undefined {
    return this.req.session?.userRole;
  }

  // Issues a fresh session ID before authenticating it, so an ID planted
  // before login (session fixation) never becomes a logged-in session.
  async setSession(userId: string, userRole: string): Promise<void> {
    const old = this.req.session as any;
    if (!old) return;

    const carried = Object.fromEntries(
      CARRIED_OVER_ON_LOGIN.filter((k) => old[k] !== undefined).map((k) => [k, old[k]]),
    );

    await new Promise<void>((resolve, reject) =>
      old.regenerate((err?: Error) => (err ? reject(err) : resolve())),
    );

    Object.assign(this.req.session, carried, { userId, userRole });
  }

  destroySession(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.req.session) {
        return resolve();
      }
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
