import { describe, it, expect } from "vitest";
import { invalidPersonName, PERSON_NAME_ERROR } from "./person-name.js";
import { createBookingBodySchema } from "../server/routes/shared.js";
import { screenBookingUpdate } from "../server/lib/booking-update-policy.js";

// Names show up in staff print-outs, emails and the admin dashboard. Print windows
// now escape them, but < and > never belong in a person's name, so the server
// refuses them at every place a name comes in.
describe("invalidPersonName", () => {
  it.each(["<img src=x onerror=alert(1)>", "Jo <b>", "a>b"])("rejects %s", (name) => {
    expect(invalidPersonName(name)).toBe(PERSON_NAME_ERROR);
  });

  it.each(["Jo Guest", "Jean-Marc Ménard", "O'Brien", "Mary & John Smith", "李小龙", "Tom (Captain) Tanna"])(
    "accepts %s",
    (name) => {
      expect(invalidPersonName(name)).toBeNull();
    },
  );

  it("ignores absent names, which each route treats by its own rules", () => {
    expect(invalidPersonName(undefined)).toBeNull();
    expect(invalidPersonName(null)).toBeNull();
  });
});

describe("POST /api/bookings body", () => {
  const body = (customerName: string) => ({
    customerName,
    customerEmail: "guest@example.com",
    items: [{ productId: "90b13e31-6e1b-44e9-942c-667203409126", adultPax: 2, childPax: 0, date: "2026-11-01" }],
  });

  it("refuses a customer name containing < or >, with a message the guest can act on", () => {
    const result = createBookingBodySchema.safeParse(body("<script>x</script>"));
    expect(result.success).toBe(false);
    expect(result.error?.errors.map((e) => e.message)).toContain(PERSON_NAME_ERROR);
  });

  it("still accepts an ordinary name", () => {
    expect(createBookingBodySchema.safeParse(body("Jo Guest")).success).toBe(true);
  });
});

describe("PATCH /api/bookings/:id (owner editing their name)", () => {
  it("refuses a new customer name containing < or >", () => {
    const result = screenBookingUpdate({ customerName: "<img src=x>" }, "owner", "pending");
    expect(result).toEqual({ ok: false, error: PERSON_NAME_ERROR });
  });

  it("also refuses it from an admin", () => {
    expect(screenBookingUpdate({ customerName: "Jo <b>" }, "admin", "pending").ok).toBe(false);
  });

  it("still lets an owner fix a typo in their name", () => {
    expect(screenBookingUpdate({ customerName: "Jo Guest" }, "owner", "pending").ok).toBe(true);
  });
});
