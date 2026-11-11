import type { IStorage } from "../storage.js";
import type { Payment } from "../../shared/schema.js";
import { PaymentStatus } from "../domain/payments/interfaces.js";
import { sendAdminEmail, shortBookingRef } from "../lib/mail.js";
import { escapeHtml } from "../lib/escape-html.js";

/** How long a payment waits for a person before the overdue sweep may close it. */
export const REVIEW_WINDOW_HOURS = 72;

/** The bank reported a state only a person can settle (held funds, partial capture, unknown status). */
export const BANK_STATUS_NEEDS_REVIEW = 'bank_status_needs_review';

/**
 * Parks a card payment for a person to settle.
 *
 * A card payment's `expiresAt` is its 15-minute checkout window. The overdue sweep
 * expires any `manual_review_required` payment past that time and cancels its
 * booking, so a payment parked without a new window was closed minutes later with
 * nobody told, while the bank might be holding the guest's money. Every review
 * hold therefore gets a fresh window and an admin email.
 */
export async function holdPaymentForReview(
  storage: IStorage,
  payment: Payment,
  hold: {
    reason: string;
    gatewayName: string;
    /** What the bank said, e.g. "MPGS order status AUTHORIZED". */
    detail?: string;
    gatewayReference?: string;
    bankAmount?: number;
    bankCurrency?: string;
  },
): Promise<void> {
  const expiresAt = new Date(Date.now() + REVIEW_WINDOW_HOURS * 60 * 60 * 1000);
  await storage.updatePayment(payment.id, {
    status: PaymentStatus.ManualReviewRequired,
    failureReason: hold.reason,
    expiresAt,
    ...(hold.gatewayReference ? { gatewayReference: hold.gatewayReference } : {}),
    metadata: {
      ...((payment.metadata as Record<string, unknown> | null) ?? {}),
      bankReportedStatus: hold.detail,
      bankReportedAmount: hold.bankAmount,
      bankReportedCurrency: hold.bankCurrency,
    },
  });
  console.warn(`[PAYMENT][REVIEW] Payment ${payment.id} held for manual review (${hold.reason}): ${hold.detail ?? ''}`);

  try {
    await sendAdminEmail(
      `⚠️ Card payment needs review — Booking ACT-${shortBookingRef(payment.bookingId)}`,
      `<div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
        <h2 style="color: #d35400;">A card payment needs a person</h2>
        <p>${escapeHtml(hold.gatewayName)} reported a result this site will not settle by itself:
        <strong>${escapeHtml(hold.detail || hold.reason)}</strong>.</p>
        <p><strong>Payment ID:</strong> ${escapeHtml(payment.id)}<br>
        <strong>Booking:</strong> ACT-${escapeHtml(shortBookingRef(payment.bookingId))}<br>
        <strong>Expected:</strong> ${escapeHtml(String(payment.amount))} ${escapeHtml(payment.currency)}<br>
        <strong>Bank reported:</strong> ${escapeHtml(String(hold.bankAmount ?? 'n/a'))} ${escapeHtml(String(hold.bankCurrency ?? ''))}</p>
        <p>Check the order in the bank's merchant portal. If the guest's money was taken or is being held,
        capture it and confirm the payment in Admin → Payments, or release/refund it in the portal.</p>
        <p>The payment is <strong>manual_review_required</strong> for ${REVIEW_WINDOW_HOURS} hours; after that the still-pending booking is closed.</p>
      </div>`,
    );
  } catch (emailErr) {
    console.error('[PAYMENT][REVIEW] Failed to send review email:', emailErr);
  }
}
