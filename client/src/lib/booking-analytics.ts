/**
 * GA4 "purchase" event for a completed booking, pushed to the GTM dataLayer.
 * GTM forwards it with a "GA4 Event" tag (Custom Event trigger: purchase,
 * ecommerce data from the data layer). No names or emails are ever sent.
 */

type BookingLike = { status?: string; totalAmountCents?: number };
type ItemLike = { productId?: string; productName?: string; adultPax?: number; childPax?: number };

type PurchaseInput = {
  /** The ACT-XXXXXXXX reference the guest sees. */
  reference: string;
  booking: BookingLike;
  items: ItemLike[];
  paymentMethod: string;
};

/** Cash/bank transfer are complete when made; card bookings only once payment confirms them. */
export function bookingCompleted({ isManual, status }: { isManual: boolean; status?: string }): boolean {
  if (!status) return false;
  return isManual || status === "confirmed" || status === "completed";
}

export function buildPurchaseEvent({ reference, booking, items, paymentMethod }: PurchaseInput) {
  return {
    event: "purchase",
    ecommerce: {
      transaction_id: reference,
      value: booking.totalAmountCents ?? 0, // whole vatu (see pricing notes)
      currency: "VUV",
      payment_type: paymentMethod,
      items: items.map((i) => ({
        item_id: i.productId,
        item_name: i.productName,
        quantity: (i.adultPax ?? 0) + (i.childPax ?? 0) || 1,
      })),
    },
  };
}

const sentKey = (reference: string) => `ga4-purchase-sent:${reference}`;

/** Returns true if the event was pushed (false if this booking was already tracked). */
export function trackBookingCompleted(input: PurchaseInput): boolean {
  try {
    if (localStorage.getItem(sentKey(input.reference))) return false;
  } catch {
    // Storage blocked: track anyway; a rare duplicate beats a missed booking.
  }
  const w = window as unknown as { dataLayer?: unknown[] };
  w.dataLayer = w.dataLayer || [];
  w.dataLayer.push({ ecommerce: null });
  w.dataLayer.push(buildPurchaseEvent(input));
  try {
    localStorage.setItem(sentKey(input.reference), "1");
  } catch {
    // ignore
  }
  return true;
}
