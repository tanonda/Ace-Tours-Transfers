import {
  BANK_TRANSFER_KEYS,
  DEFAULT_ACCOUNT_NAME,
  MISSING_ACCOUNT_NUMBER,
  settingText,
} from "../../shared/bank-transfer.js";

export interface BankTransferDetails {
  /** "" when unknown: callers leave the row out rather than guess a bank. */
  bankName: string;
  accountName: string;
  /** MISSING_ACCOUNT_NUMBER when none is configured anywhere. */
  accountNumber: string;
}

type ReadSetting = (key: string) => Promise<{ value: unknown } | undefined>;

/**
 * The bank details guests pay into: admin settings first, then the BANK_* env
 * fallback. Read fresh on every call, so an admin's change applies to the next email.
 */
export async function getBankTransferDetails(readSetting?: ReadSetting): Promise<BankTransferDetails> {
  let read = readSetting;
  if (!read) {
    try {
      // Imported lazily (and once) to keep mail.ts free of a load-time storage cycle.
      const { storage } = await import("../storage.js");
      read = (key) => storage.getSiteSetting(key);
    } catch {
      read = async () => undefined;
    }
  }
  const fromAdmin = async (key: string) => {
    try {
      return settingText((await read!(key))?.value);
    } catch {
      return "";
    }
  };
  const [bankName, accountName, accountNumber] = await Promise.all([
    fromAdmin(BANK_TRANSFER_KEYS.bankName),
    fromAdmin(BANK_TRANSFER_KEYS.accountName),
    fromAdmin(BANK_TRANSFER_KEYS.accountNumber),
  ]);
  return {
    bankName: bankName || process.env.BANK_NAME?.trim() || "",
    accountName: accountName || process.env.BANK_ACCOUNT_NAME?.trim() || DEFAULT_ACCOUNT_NAME,
    accountNumber: accountNumber || process.env.BANK_ACCOUNT_NUMBER?.trim() || MISSING_ACCOUNT_NUMBER,
  };
}
