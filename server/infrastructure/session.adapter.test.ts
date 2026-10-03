import { describe, expect, it } from "vitest";
import type { Request } from "express";
import { ExpressSessionAdapter } from "./session.adapter.js";

// Mimics express-session: regenerate() replaces req.session with a fresh object and a new ID.
function fakeRequest(initial: Record<string, unknown>) {
  let counter = 0;
  const req: any = {};
  const makeSession = (data: Record<string, unknown>) => ({
    ...data,
    regenerate(cb: (err?: Error) => void) {
      req.session = makeSession({});
      req.sessionID = `sid-${++counter}`;
      cb();
    },
  });
  req.session = makeSession(initial);
  req.sessionID = "sid-attacker-chosen";
  return req as Request & { session: any; sessionID: string };
}

describe("ExpressSessionAdapter.setSession", () => {
  it("issues a new session ID on login (prevents session fixation)", async () => {
    const req = fakeRequest({});
    await new ExpressSessionAdapter(req).setSession("user-1", "customer");

    expect(req.sessionID).not.toBe("sid-attacker-chosen");
    expect(req.session.userId).toBe("user-1");
    expect(req.session.userRole).toBe("customer");
  });

  it("keeps guest checkout state so a just-made booking stays viewable", async () => {
    const req = fakeRequest({
      recentBookingIds: ["book-1"],
      bookingSessionId: "bs-1",
      bookingSessionExpiresAt: 123,
      somethingElse: "dropped",
    });
    await new ExpressSessionAdapter(req).setSession("user-1", "customer");

    expect(req.session.recentBookingIds).toEqual(["book-1"]);
    expect(req.session.bookingSessionId).toBe("bs-1");
    expect(req.session.bookingSessionExpiresAt).toBe(123);
    expect(req.session.somethingElse).toBeUndefined();
  });
});
