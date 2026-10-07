// Fields that must never leave the server, even in admin-only responses: a leaked
// TOTP secret or reset token is a working credential for that account.
const SECRET_USER_FIELDS = ["password", "passwordResetToken", "passwordResetTokenExpiry", "totpSecret"] as const;

type SecretField = (typeof SECRET_USER_FIELDS)[number];

export function toSafeUser<T extends Partial<Record<SecretField, unknown>>>(user: T): Omit<T, SecretField> {
  const safe: Record<string, unknown> = { ...user };
  for (const field of SECRET_USER_FIELDS) delete safe[field];
  return safe as Omit<T, SecretField>;
}
