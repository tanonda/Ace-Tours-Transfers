// Booking statuses that mean the guest has paid (or the trip is done). The payment-expiry paths
// (saga, expirePayment, cancelBooking("payment_expired"), onPaymentExpired) leave these bookings
// alone; every other status (pending, expired, ...) expires exactly as before.
export const PAID_BOOKING_STATUSES = ["confirmed", "completed"] as const;

export function isPaidBookingStatus(status: string | null | undefined): boolean {
  return (PAID_BOOKING_STATUSES as readonly string[]).includes(status ?? "");
}
