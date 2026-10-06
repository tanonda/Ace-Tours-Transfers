/**
 * Bank-transfer details have one home: the admin settings in Admin → Settings →
 * Payments (bank_transfer_*). The instructions email and the payment-success page
 * both read these keys; BANK_* environment variables are only a fallback.
 */
export const BANK_TRANSFER_KEYS = {
  bankName: "bank_transfer_bank_name",
  accountName: "bank_transfer_account_name",
  accountNumber: "bank_transfer_account_number",
} as const;

export const BANK_TRANSFER_SETTING_KEYS: readonly string[] = Object.values(BANK_TRANSFER_KEYS);

export const DEFAULT_ACCOUNT_NAME = "Ace Tours & Transfers";
export const MISSING_ACCOUNT_NUMBER = "Contact us for account details";

/** A setting's stored value as display text ("" when unset or not a string). */
export function settingText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
