import { describe, it, expect, afterEach } from "vitest";
import { getBankTransferDetails } from "./bank-transfer-details.js";
import { BANK_TRANSFER_KEYS, MISSING_ACCOUNT_NUMBER } from "../../shared/bank-transfer.js";

const settings = (values: Record<string, unknown>) => async (key: string) =>
  key in values ? { value: values[key] } : undefined;

describe("getBankTransferDetails", () => {
  afterEach(() => {
    delete process.env.BANK_NAME;
    delete process.env.BANK_ACCOUNT_NAME;
    delete process.env.BANK_ACCOUNT_NUMBER;
  });

  it("uses the admin settings, ahead of the environment", async () => {
    process.env.BANK_ACCOUNT_NUMBER = "env-111";
    const details = await getBankTransferDetails(settings({
      [BANK_TRANSFER_KEYS.bankName]: "BRED Vanuatu",
      [BANK_TRANSFER_KEYS.accountName]: "Ace Tours & Transfers",
      [BANK_TRANSFER_KEYS.accountNumber]: " 0012-345678-9 ",
    }));
    expect(details).toEqual({ bankName: "BRED Vanuatu", accountName: "Ace Tours & Transfers", accountNumber: "0012-345678-9" });
  });

  it("falls back to the environment for a value left empty in admin", async () => {
    process.env.BANK_ACCOUNT_NUMBER = "env-111";
    const details = await getBankTransferDetails(settings({ [BANK_TRANSFER_KEYS.accountNumber]: "" }));
    expect(details.accountNumber).toBe("env-111");
  });

  it("never invents a bank, and says so when no account number is set anywhere", async () => {
    const details = await getBankTransferDetails(settings({}));
    expect(details.bankName).toBe("");
    expect(details.accountNumber).toBe(MISSING_ACCOUNT_NUMBER);
  });

  it("falls back when the settings cannot be read", async () => {
    process.env.BANK_ACCOUNT_NUMBER = "env-111";
    const details = await getBankTransferDetails(async () => { throw new Error("db down"); });
    expect(details.accountNumber).toBe("env-111");
  });
});
