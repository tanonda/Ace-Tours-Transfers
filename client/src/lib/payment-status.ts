/**
 * Payment status and refund display helpers.
 *
 * Card refunds for BRED Bank/PayZen are executed in the bank's Back Office and
 * only *recorded* on the site: a payment row carries `refundedAmount` (whole
 * VUV, the same unit as `payments.amount`), `refundedAt` and `refundReference`.
 * These helpers are pure TypeScript (no React) so the admin reconciliation and
 * payments views use the same labels, badge tones and refund wording.
 */

export type PaymentStatusLike = string | null | undefined;

export type PaymentStatusTone = "neutral" | "info" | "positive" | "warning" | "danger" | "refund";

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  processing: "Processing",
  completed: "Completed",
  failed: "Failed",
  // Admin cancellation sets this when a completed payment needs a manual refund.
  refund_pending: "Refund pending (manual)",
  refunded: "Refunded",
  manual_review_required: "Manual review required",
  cancelled: "Cancelled",
  expired: "Expired",
};

const STATUS_TONES: Record<string, PaymentStatusTone> = {
  pending: "neutral",
  processing: "info",
  completed: "positive",
  failed: "danger",
  refund_pending: "warning",
  refunded: "refund",
  manual_review_required: "warning",
  cancelled: "neutral",
  expired: "neutral",
};

/** Tailwind classes for a status Badge (see components/ui/badge). */
const TONE_CLASSES: Record<PaymentStatusTone, string> = {
  neutral: "border-transparent bg-muted text-muted-foreground",
  info: "border-transparent bg-blue-500/15 text-blue-700 dark:text-blue-300",
  positive: "border-transparent bg-green-500/15 text-green-700 dark:text-green-300",
  warning: "border-transparent bg-amber-500/15 text-amber-800 dark:text-amber-300",
  danger: "border-transparent bg-destructive/10 text-destructive",
  refund: "border-transparent bg-purple-500/15 text-purple-700 dark:text-purple-300",
};

/** "REFUND_PENDING", "Refund Pending" and "refund-pending" all normalise alike. */
function normalizeStatus(status: PaymentStatusLike): string | null {
  if (typeof status !== "string") return null;
  const normalized = status.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return normalized.length > 0 ? normalized : null;
}

/** Human label for a payment status; unknown values are title-cased, never thrown. */
export function statusLabel(status: PaymentStatusLike): string {
  const key = normalizeStatus(status);
  if (!key) return "Unknown";
  const known = STATUS_LABELS[key];
  if (known) return known;
  return key
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** True for the two refund-related statuses (refunded, refund_pending). */
export function isRefundStatus(status: PaymentStatusLike): boolean {
  const key = normalizeStatus(status);
  return key === "refunded" || key === "refund_pending";
}

/** True when the status says the refund has already been recorded (fully refunded). */
export function isRefundRecorded(status: PaymentStatusLike): boolean {
  return normalizeStatus(status) === "refunded";
}

export function statusTone(status: PaymentStatusLike): PaymentStatusTone {
  const key = normalizeStatus(status);
  return (key && STATUS_TONES[key]) || "neutral";
}

/** Tailwind classes for a Badge showing this status. */
export function statusToneClass(status: PaymentStatusLike): string {
  return TONE_CLASSES[statusTone(status)];
}

/** The subset of a payment row that describes a recorded refund. */
export interface PaymentRefundFields {
  /** Original payment amount, in the same unit as refundedAmount (whole VUV). */
  amount?: number | string | null;
  status?: PaymentStatusLike;
  /** Total money returned so far, in whole VUV. */
  refundedAmount?: number | string | null;
  refundedAt?: string | null;
  refundReference?: string | null;
}

/**
 * - none: nothing refunded/recorded
 * - full: recorded total covers the original payment
 * - partial: recorded total is less than the original payment
 * - recorded: a refund is recorded but the original amount is unknown
 * - unknown: refund metadata exists but no amount could be read
 */
export type RefundKind = "none" | "full" | "partial" | "recorded" | "unknown";

export interface RefundSummary {
  hasRefund: boolean;
  kind: RefundKind;
  /** Total refunded, whole VUV; null when no amount is recorded. */
  amount: number | null;
  /** ISO timestamp as returned by the API, or null. */
  date: string | null;
  reference: string | null;
  isFull: boolean;
  isPartial: boolean;
}

const NO_REFUND: RefundSummary = {
  hasRefund: false,
  kind: "none",
  amount: null,
  date: null,
  reference: null,
  isFull: false,
  isPartial: false,
};

function toPositiveAmount(value: number | string | null | undefined): number | null {
  const parsed =
    typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function toNonEmptyString(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Summarises the refund recorded on a payment. Partial refunds are real: a
 * partially refunded payment can still have status "completed" with
 * refundedAmount below amount, so callers must render this independently of the
 * status badge. Safe for null/undefined rows and for 0/empty API values.
 */
export function refundSummary(payment: PaymentRefundFields | null | undefined): RefundSummary {
  if (!payment) return NO_REFUND;

  const paidAmount = toPositiveAmount(payment.amount);
  const amount = toPositiveAmount(payment.refundedAmount);
  const date = toNonEmptyString(payment.refundedAt);
  const reference = toNonEmptyString(payment.refundReference);

  const hasRefund = amount !== null || date !== null || reference !== null;
  if (!hasRefund) return NO_REFUND;

  const isFull = amount !== null && paidAmount !== null && amount >= paidAmount;
  const isPartial = amount !== null && paidAmount !== null && paidAmount > 0 && amount < paidAmount;
  const kind: RefundKind = amount === null ? "unknown" : isFull ? "full" : isPartial ? "partial" : "recorded";

  return { hasRefund: true, kind, amount, date, reference, isFull, isPartial };
}
