/**
 * Which fields PATCH /api/bookings/:id may write.
 *
 * Customers get an allowlist: anything else (status, date, guests, payment and fraud
 * fields) changes money or capacity and must go through an admin. New booking columns
 * are therefore customer-immutable by default.
 */
export const OWNER_EDITABLE_FIELDS = ["notes", "pickupLocation", "customerPhone", "customerName"];

// Financial and identity fields no one may overwrite through this route.
const IMMUTABLE_FIELDS = [
  "totalAmountCents", "amount", "tourId", "customerEmail",
  "idempotencyKey", "holdId", "bookingSessionId", "id", "createdAt",
];

export type BookingUpdateScreen =
  | { ok: true; updates: Record<string, unknown> }
  | { ok: false; error: string };

export function screenBookingUpdate(body: Record<string, unknown>, isAdmin: boolean): BookingUpdateScreen {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Invalid update." };
  }

  const isAllowed = isAdmin
    ? (field: string) => !IMMUTABLE_FIELDS.includes(field)
    : (field: string) => OWNER_EDITABLE_FIELDS.includes(field);

  for (const [field, value] of Object.entries(body)) {
    if (value !== undefined && !isAllowed(field)) {
      return { ok: false, error: `Field '${field}' cannot be modified.` };
    }
  }

  return { ok: true, updates: { ...body } };
}
