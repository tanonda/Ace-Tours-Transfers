// Bank statement matching for offline payments. It never confirms anything: a line whose booking
// reference matches AND whose amount column equals the booking's amount is a *suggestion* for an
// admin to confirm; any other reference match is *needs review*. Only the amount column counts —
// a number in the description (which the guest writes) is never read as the amount.
// Amounts are whole vatu (no minor unit), the same unit as bookings.totalAmountCents.

/** The reference a guest quotes: the first 8 hex digits of the booking id, upper case (ACT-1234ABCD). */
export function bookingRef(bookingId: string): string {
  return bookingId.replace(/^book_/i, "").replace(/-/g, "").slice(0, 8).toUpperCase();
}

/** One CSV line into cells: commas, "quoted, cells" and "" escapes. */
export function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { cells.push(cell); cell = ""; }
    else cell += c;
  }
  cells.push(cell);
  return cells.map((c) => c.trim());
}

const normaliseHeader = (h: string) => h.toLowerCase().replace(/\((vuv|vt)\)/g, "").replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
/** Money-in columns win over a signed "Amount" column. */
const CREDIT_HEADERS = new Set(["credit", "credits", "cr", "credit amount", "deposit", "deposits", "paid in", "money in", "amount in", "receipts"]);
const AMOUNT_HEADERS = new Set(["amount", "transaction amount", "amount vuv", "value"]);

/** The index of the amount column in a header row, or -1 when the row isn't a header with one. */
export function findAmountColumn(header: string[]): number {
  const names = header.map(normaliseHeader);
  const credit = names.findIndex((n) => CREDIT_HEADERS.has(n));
  return credit >= 0 ? credit : names.findIndex((n) => AMOUNT_HEADERS.has(n));
}

const AMOUNT_CELL = /^(?:VT|VUV)?\s*(-?)\s*(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?\s*(?:VT|VUV)?$/i;

/** A cell that is just an amount (13000, 13,000.00, VT 13,000, -500) as a number; anything else null. */
export function parseAmount(cell: string): number | null {
  const m = cell.trim().match(AMOUNT_CELL);
  if (!m) return null;
  const value = Number(`${m[2].replace(/,/g, "")}${m[3] ?? ""}`);
  return m[1] ? -value : value;
}

export type StatementBooking = { id: string; totalAmountCents: number; updatedAt: Date | string; customerName?: string | null };
export type ReviewReason = "amount_mismatch" | "no_amount_column" | "unparseable_amount" | "duplicate_reference";
export type StatementMatch = {
  bookingId: string;
  ref: string;
  customerName: string | null;
  lineNo: number;
  line: string;
  statementAmount: number | null;
  expectedAmount: number;
  /** The booking's updatedAt when matched: the confirm call's compare-and-set value. */
  updatedAt: string;
  status: "suggested" | "needs_review";
  reason?: ReviewReason;
};

export function matchStatement(text: string, bookings: StatementBooking[]): {
  amountColumn: string | null;
  suggestions: StatementMatch[];
  needsReview: StatementMatch[];
  ignored: number;
} {
  const lines = text.split(/\r?\n/).map((raw, i) => ({ raw, lineNo: i + 1 })).filter((l) => l.raw.trim());
  const header = lines.length ? parseCsvLine(lines[0].raw) : [];
  const col = findAmountColumn(header);
  const rows = col >= 0 ? lines.slice(1) : lines;
  const refs = bookings.map((b) => ({ b, ref: bookingRef(b.id) }));

  const suggestions: StatementMatch[] = [];
  const needsReview: StatementMatch[] = [];
  const seen = new Set<string>();
  let ignored = 0;

  for (const { raw, lineNo } of rows) {
    const upper = raw.toUpperCase();
    const hit = refs.find(({ ref }) => upper.includes(ref));
    if (!hit) { ignored++; continue; }
    const { b, ref } = hit;
    const amount = col >= 0 ? parseAmount(parseCsvLine(raw)[col] ?? "") : null;
    const match: StatementMatch = {
      bookingId: b.id, ref, customerName: b.customerName ?? null, lineNo, line: raw, statementAmount: amount,
      expectedAmount: b.totalAmountCents, updatedAt: new Date(b.updatedAt).toISOString(), status: "needs_review",
    };
    if (seen.has(b.id)) match.reason = "duplicate_reference";
    else if (col < 0) match.reason = "no_amount_column";
    else if (amount === null) match.reason = "unparseable_amount";
    else if (amount !== b.totalAmountCents) match.reason = "amount_mismatch";
    else match.status = "suggested";

    if (match.status === "suggested") { suggestions.push(match); seen.add(b.id); }
    else needsReview.push(match);
  }
  return { amountColumn: col >= 0 ? header[col] : null, suggestions, needsReview, ignored };
}
