import type { User } from "../../shared/schema.js";

/**
 * Allow-list of user columns that may be sent to a browser. Every response that
 * returns a user row MUST go through toSafeUser(); never res.json() a raw row.
 *
 * Deliberately excluded: password (bcrypt hash), passwordResetToken,
 * passwordResetTokenExpiry, totpSecret. A leaked reset token or TOTP secret is a
 * working credential. New columns are excluded by default until added here.
 */
export const SAFE_USER_FIELDS = [
  "id", // client: session user identity, ownership checks
  "username", // admin staff screen shows/creates usernames
  "email", // client: profile, booking prefill
  "name", // client: header/profile
  "phone", // client: profile form
  "role", // client: homePathForRole, isAdmin/isStaff
  "isActive", // admin staff screen: suspended state
  "totpEnabled", // boolean only (not the secret): lets UI show MFA status
  "createdAt", // admin lists
  "updatedAt", // admin lists
] as const satisfies readonly (keyof User)[];

export type SafeUser = Pick<User, (typeof SAFE_USER_FIELDS)[number]>;

export function toSafeUser<T extends SafeUser>(user: T): SafeUser {
  const safe = {} as Record<string, unknown>;
  for (const field of SAFE_USER_FIELDS) safe[field] = user[field];
  return safe as SafeUser;
}
