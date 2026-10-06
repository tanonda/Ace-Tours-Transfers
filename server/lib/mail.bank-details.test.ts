import { describe, it, expect, vi } from "vitest";

// vi.hoisted: vi.mock below is hoisted above ordinary declarations.
const stored = vi.hoisted((): Record<string, unknown> => ({
  bank_transfer_bank_name: "BRED <Vanuatu>",
  bank_transfer_account_name: "Ace Tours & Transfers",
  bank_transfer_account_number: "0012-345678-9",
}));
vi.mock("../storage.js", () => ({
  storage: { getSiteSetting: vi.fn(async (key: string) => (key in stored ? { key, value: stored[key] } : undefined)) },
}));

describe("bank-transfer instructions email", () => {
  it("shows the bank details from Admin → Settings, escaped", async () => {
    const { getBookingRequestTemplate } = await import("./mail.js");
    const html = await getBookingRequestTemplate(
      { id: "b0a1c2d3-1111", customerName: "Jo", amount: "VT 12,500", date: "2026-11-01", guests: "2 Adult(s)" },
      { title: "Island Tour", id: "t1" },
      "bank_transfer",
    );
    expect(html).toContain("0012-345678-9");
    expect(html).toContain("BRED &lt;Vanuatu&gt;");
    expect(html).not.toContain("BRED <Vanuatu>");
    expect(html).not.toContain("Contact us for account details");
    expect(html).not.toContain("ANZ Bank (Vanuatu) Ltd");
  });
});
