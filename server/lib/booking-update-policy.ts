import { invalidPersonName } from "../../shared/person-name.js";

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

export type BookingUpdateActor = "admin" | "staff" | "owner";

export function screenBookingUpdate(
  body: Record<string, unknown>,
  actor: BookingUpdateActor,
  currentStatus: string,
): BookingUpdateScreen {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Invalid update." };
  }

  // Field service (drivers/guides) may only mark a trip done; confirming a pending
  // booking means checking payment, which stays with admins.
  const isAllowed =
    actor === "admin" ? (field: string) => !IMMUTABLE_FIELDS.includes(field)
    : actor === "staff" ? (field: string) => field === "status"
    : (field: string) => OWNER_EDITABLE_FIELDS.includes(field);

  for (const [field, value] of Object.entries(body)) {
    if (value !== undefined && !isAllowed(field)) {
      return { ok: false, error: `Field '${field}' cannot be modified.` };
    }
  }

  const nameError = invalidPersonName(body.customerName);
  if (nameError) return { ok: false, error: nameError };

  if (actor === "staff" && !(currentStatus === "confirmed" && body.status === "completed")) {
    return { ok: false, error: "Field service can only mark confirmed bookings as completed." };
  }

  return { ok: true, updates: { ...body } };
}
