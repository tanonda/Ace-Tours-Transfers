/**
 * FraudDetectionService
 *
 * Evaluates incoming booking requests for fraud risk using a multi-signal
 * scoring model. Runs synchronously during booking creation and flags
 * high-risk bookings for admin review without blocking legitimate customers.
 *
 * Risk signals:
 *  1. Email velocity     — multiple bookings from the same email in a short window
 *  2. IP velocity        — multiple bookings from the same IP in a short window
 *  3. High pax anomaly   — unusually large guest counts vs. product norms
 *  4. High value order   — order total is far above the site average
 *  5. Rapid repeat       — same email booking the same tour on the same date twice
 *  6. Suspicious name    — generic/bot-like customer names
 *  7. Mismatched email   — disposable / temp email domain
 *  8. After-hours spike  — booking cluster from same IP in < 5 minutes
 */

import { IStorage } from "../../storage.js";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type FraudRiskLevel = "low" | "medium" | "high" | "critical";

export interface FraudSignal {
  code: string;
  description: string;
  score: number; // contribution to total risk score
}

export interface FraudAssessment {
  bookingId: string;
  riskScore: number;          // 0–100
  riskLevel: FraudRiskLevel;
  signals: FraudSignal[];
  shouldBlock: boolean;       // only true for critical score + hard block signal
  requiresReview: boolean;    // admin must approve before confirmation emails
  assessedAt: string;
}

export interface BookingContext {
  bookingId: string;
  customerEmail: string;
  customerName: string;
  customerPhone?: string | null;
  ipAddress: string;
  totalAmountCents: number;
  guests: number;
  tourId: string;
  date: string;
  sessionId?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "mailinator.com", "guerrillamail.com", "tempmail.com", "throwam.com",
  "yopmail.com", "dispostable.com", "trashmail.com", "sharklasers.com",
  "guerrillamailblock.com", "grr.la", "guerrillamail.info", "spam4.me",
  "10minutemail.com", "minutemail.com", "discard.email", "fakeinbox.com",
  "maildrop.cc", "getairmail.com", "filzmail.com", "throwam.com",
  "mailnull.com", "spamgourmet.com", "spamgourmet.net",
]);

const SUSPICIOUS_NAME_PATTERNS = [
  /^test/i, /^user\d*/i, /^asdf/i, /^qwer/i, /^foo/i, /^bar/i,
  /^admin/i, /^guest/i, /^sample/i, /^dummy/i, /^name/i, /^[a-z]{1,2}$/i,
];

const SCORE_THRESHOLDS = {
  low: 0,
  medium: 30,
  high: 60,
  critical: 85,
};

const VELOCITY_WINDOW_MINUTES = 60;   // for email/IP checks
const RAPID_REPEAT_WINDOW_MINUTES = 5; // for IP burst detection
const MAX_BOOKINGS_PER_EMAIL_PER_HOUR = 3;
const MAX_BOOKINGS_PER_IP_PER_HOUR = 5;
const HIGH_PAX_THRESHOLD = 15;
const HIGH_VALUE_MULTIPLIER = 5; // 5x site average = high value signal
const SITE_AVERAGE_BOOKING_CENTS = 25_000; // ~250 VUV, tune based on real data

// In-memory velocity store (process-local; acceptable for single-instance deploy)
const ipVelocityStore = new Map<string, number[]>(); // ip -> [timestamp, ...]
const emailVelocityStore = new Map<string, number[]>();

function recordAndCount(store: Map<string, number[]>, key: string, windowMs: number): number {
  const now = Date.now();
  const cutoff = now - windowMs;
  const existing = (store.get(key) || []).filter(t => t > cutoff);
  existing.push(now);
  store.set(key, existing);
  return existing.length;
}

// ─────────────────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────────────────

export class FraudDetectionService {
  private storage: IStorage;

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  /**
   * Primary entry point. Call after a booking record is created but
   * before emitting confirmation events or emails.
   */
  async assess(ctx: BookingContext): Promise<FraudAssessment> {
    const signals: FraudSignal[] = [];

    await Promise.all([
      this.checkEmailVelocity(ctx, signals),
      this.checkIpVelocity(ctx, signals),
      this.checkRapidRepeat(ctx, signals),
      this.checkHighPax(ctx, signals),
      this.checkHighValue(ctx, signals),
      this.checkDisposableEmail(ctx, signals),
      this.checkSuspiciousName(ctx, signals),
    ]);

    const riskScore = Math.min(100, signals.reduce((sum, s) => sum + s.score, 0));
    const riskLevel = this.scoreToLevel(riskScore);
    const shouldBlock = riskLevel === "critical" && signals.some(s => s.code === "IP_BURST");
    const requiresReview = riskScore >= SCORE_THRESHOLDS.medium;

    const assessment: FraudAssessment = {
      bookingId: ctx.bookingId,
      riskScore,
      riskLevel,
      signals,
      shouldBlock,
      requiresReview,
      assessedAt: new Date().toISOString(),
    };

    console.log(
      `[FRAUD] Booking ${ctx.bookingId} — score: ${riskScore} (${riskLevel})` +
      (signals.length ? ` | signals: ${signals.map(s => s.code).join(", ")}` : "")
    );

    return assessment;
  }

  // ── Signals ───────────────────────────────────────────────────────────────

  private async checkEmailVelocity(ctx: BookingContext, signals: FraudSignal[]) {
    const windowMs = VELOCITY_WINDOW_MINUTES * 60 * 1000;
    const count = recordAndCount(emailVelocityStore, ctx.customerEmail.toLowerCase(), windowMs);

    // Also check DB for persistent history
    let dbCount = 0;
    try {
      const recent = await this.storage.getBookingsByEmail(ctx.customerEmail);
      const cutoff = new Date(Date.now() - windowMs);
      dbCount = recent.filter(b => b.id !== ctx.bookingId && new Date(b.createdAt) > cutoff).length;
    } catch { /* non-fatal */ }

    const total = Math.max(count - 1, dbCount); // subtract current booking from in-memory count
    if (total >= MAX_BOOKINGS_PER_EMAIL_PER_HOUR) {
      const score = Math.min(40, total * 10);
      signals.push({
        code: "EMAIL_VELOCITY",
        description: `${total} bookings from ${ctx.customerEmail} in the last ${VELOCITY_WINDOW_MINUTES} minutes`,
        score,
      });
    }
  }

  private async checkIpVelocity(ctx: BookingContext, signals: FraudSignal[]) {
    if (!ctx.ipAddress || ctx.ipAddress === "127.0.0.1" || ctx.ipAddress === "::1") return;

    const windowMs = VELOCITY_WINDOW_MINUTES * 60 * 1000;
    const count = recordAndCount(ipVelocityStore, ctx.ipAddress, windowMs);
    const total = count - 1; // subtract current

    if (total >= MAX_BOOKINGS_PER_IP_PER_HOUR) {
      const score = Math.min(40, total * 8);
      signals.push({
        code: "IP_VELOCITY",
        description: `${total} bookings from IP ${ctx.ipAddress} in the last ${VELOCITY_WINDOW_MINUTES} minutes`,
        score,
      });
    }

    // Separate rapid burst check (within 5 minutes)
    const burstWindowMs = RAPID_REPEAT_WINDOW_MINUTES * 60 * 1000;
    const burstCount = recordAndCount(
      new Map(ipVelocityStore),
      `${ctx.ipAddress}:burst`,
      burstWindowMs
    );
    if (burstCount > 3) {
      signals.push({
        code: "IP_BURST",
        description: `${burstCount} bookings from IP ${ctx.ipAddress} within 5 minutes — possible bot activity`,
        score: 50,
      });
    }
  }

  private async checkRapidRepeat(ctx: BookingContext, signals: FraudSignal[]) {
    try {
      const existing = await this.storage.getBookingsByEmail(ctx.customerEmail);
      const duplicates = existing.filter(
        b =>
          b.id !== ctx.bookingId &&
          b.tourId === ctx.tourId &&
          b.date === ctx.date &&
          b.status !== "cancelled"
      );
      if (duplicates.length > 0) {
        signals.push({
          code: "DUPLICATE_BOOKING",
          description: `Same customer has ${duplicates.length} existing booking(s) for the same tour and date`,
          score: 35,
        });
      }
    } catch { /* non-fatal */ }
  }

  private checkHighPax(ctx: BookingContext, signals: FraudSignal[]) {
    if (ctx.guests >= HIGH_PAX_THRESHOLD) {
      signals.push({
        code: "HIGH_PAX_COUNT",
        description: `Booking for ${ctx.guests} guests — unusually large group, may need manual verification`,
        score: 20,
      });
    }
  }

  private checkHighValue(ctx: BookingContext, signals: FraudSignal[]) {
    if (ctx.totalAmountCents > SITE_AVERAGE_BOOKING_CENTS * HIGH_VALUE_MULTIPLIER) {
      const multiplier = (ctx.totalAmountCents / SITE_AVERAGE_BOOKING_CENTS).toFixed(1);
      signals.push({
        code: "HIGH_VALUE_ORDER",
        description: `Order value is ${multiplier}x the site average — warrants additional verification`,
        score: 25,
      });
    }
  }

  private checkDisposableEmail(ctx: BookingContext, signals: FraudSignal[]) {
    const domain = ctx.customerEmail.split("@")[1]?.toLowerCase();
    if (domain && DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
      signals.push({
        code: "DISPOSABLE_EMAIL",
        description: `Customer email uses known disposable domain: ${domain}`,
        score: 45,
      });
    }
  }

  private checkSuspiciousName(ctx: BookingContext, signals: FraudSignal[]) {
    const name = ctx.customerName?.trim() || "";
    const isSuspicious = SUSPICIOUS_NAME_PATTERNS.some(p => p.test(name));
    if (isSuspicious || name.length < 3) {
      signals.push({
        code: "SUSPICIOUS_NAME",
        description: `Customer name "${name}" matches known bot/test name patterns`,
        score: 20,
      });
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private scoreToLevel(score: number): FraudRiskLevel {
    if (score >= SCORE_THRESHOLDS.critical) return "critical";
    if (score >= SCORE_THRESHOLDS.high) return "high";
    if (score >= SCORE_THRESHOLDS.medium) return "medium";
    return "low";
  }

  /**
   * Serialise assessment for storage in booking.metadata JSON field.
   * @deprecated Use writeToBooking() instead which uses proper DB columns.
   */
  toMetadata(assessment: FraudAssessment): Record<string, unknown> {
    return {
      fraud: {
        score: assessment.riskScore,
        level: assessment.riskLevel,
        signals: assessment.signals.map(s => s.code),
        requiresReview: assessment.requiresReview,
        assessedAt: assessment.assessedAt,
      },
    };
  }

  /**
   * Persist fraud assessment to the proper typed columns on the booking row.
   */
  async writeToBooking(bookingId: string, assessment: FraudAssessment): Promise<void> {
    await this.storage.updateBooking(bookingId, {
      fraudScore: assessment.riskScore,
      fraudLevel: assessment.riskLevel,
      fraudSignals: assessment.signals.map(s => s.code) as any,
    } as any);
  }
}
