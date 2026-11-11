/**
 * What the guest is told after checkout, kept apart from React so it can be tested.
 *
 * A card guest returns from the bank's page to /payment/success, but only the
 * bank's server notification confirms the booking, and it can land a few seconds
 * later (or report a refusal). The page must not say "complete your bank transfer"
 * to someone who has just paid by card.
 */

export type CheckoutResultView =
  | "confirmed"        // paid and confirmed
  | "cash"             // pay on the day
  | "bank-transfer"    // waiting for the guest's transfer
  | "card-confirming"  // back from the bank, waiting for its notification
  | "card-not-paid"    // the bank refused or the payment was cancelled/expired
  | "card-review";     // paid, but a person has to finish the booking

export function checkoutResultView(input: { isManual: boolean; isCash: boolean; status?: string | null }): CheckoutResultView {
  const { isManual, isCash, status } = input;
  if (status === "confirmed" || status === "completed") return "confirmed";
  if (isCash) return "cash";
  if (isManual) return "bank-transfer";
  if (status === "failed" || status === "cancelled") return "card-not-paid";
  if (!status || status === "pending") return "card-confirming";
  return "card-review"; // price_mismatch, inventory_conflict, anything new
}

/** Polling can stop once the booking can no longer change by itself. */
export function isFinalCheckoutView(view: CheckoutResultView): boolean {
  return view === "confirmed" || view === "card-not-paid";
}

/**
 * Where "Try again" goes after a cancelled or declined bank payment: back to the
 * same booking, so the guest pays what they already reserved instead of creating
 * a second booking that competes with the first one's seats.
 */
export function retryPaymentPath(bookingId: string | null | undefined): string {
  return bookingId ? `/payment?bookingId=${encodeURIComponent(bookingId)}` : "/payment";
}

/** A booking can only be paid while it is pending; otherwise the guest starts again from the basket. */
export function canRetryBooking(status: string | null | undefined): boolean {
  return status === "pending";
}
