import { describe, it, expect, vi, beforeEach } from "vitest";

const sent = vi.hoisted(() => [] as any[]);
vi.mock("../storage.js", () => ({
  storage: {
    getSiteSetting: vi.fn(async () => undefined),
    getBookingItems: vi.fn(async () => [{ productId: "t1", productName: "Mele <Cascades>" }]),
  },
}));
vi.mock("../infrastructure/mailing/MailingService.js", () => ({
  mailingService: { sendEmail: vi.fn(async (o: any) => { sent.push(o); return true; }), verify: vi.fn() },
}));

const booking = { id: "11111111-1111-4111-8111-111111111111", customerName: "Jo <b>Bloggs</b>", customerEmail: "jo@example.com", locale: "fr", tourId: "t1", tourName: "Mele" };

describe("review request email", () => {
  beforeEach(() => { sent.length = 0; });

  it("links to the review page and escapes names", async () => {
    const { getReviewRequestTemplate } = await import("./mail.js");
    const html = await getReviewRequestTemplate(booking, ["Mele <Cascades>"], "https://acetoursvanuatu.com/review/abc.def");
    expect(html).toContain('href="https://acetoursvanuatu.com/review/abc.def"');
    expect(html).toContain("Mele &lt;Cascades&gt;");
    expect(html).not.toContain("<b>Bloggs</b>");
  });

  it("sends in the booking's language with a signed link", async () => {
    const { sendReviewRequest } = await import("./review-request.js");
    expect(await sendReviewRequest(booking as any)).toBe(true);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("jo@example.com");
    expect(sent[0].subject).toMatch(/avis|Ace Tours/i);
    expect(sent[0].html).toMatch(/\/review\/[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
  });

  it("returns false without an email address", async () => {
    const { sendReviewRequest } = await import("./review-request.js");
    expect(await sendReviewRequest({ ...booking, customerEmail: "" } as any)).toBe(false);
    expect(sent).toHaveLength(0);
  });
});
