
import { db } from "../../db.js";
import { payments, bookings, tourInstances } from "../../../shared/schema.js";
import { eq, isNull, and, sql, notInArray } from "drizzle-orm";
import { PaymentStatus } from "../../domain/payments/interfaces.js";

export type OrphanSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export interface DiffAction {
  label: string;
  type: 'refund' | 'attach' | 'review' | 'repair_inventory';
  description: string;
}

export interface InconsistencyEntry {
  type: 'orphaned_payment' | 'orphaned_booking' | 'inventory_mismatch' | 'payment_without_inventory';
  severity: OrphanSeverity;
  bookingId?: string;
  paymentId?: string;
  gatewayReference?: string;
  amount?: number;
  description: string;
  recommendedAction: DiffAction;
}

export interface DiffReport {
  generatedAt: Date;
  summary: {
    orphanedPayments: number;
    orphanedBookings: number;
    inventoryMismatches: number;
    totalIssues: number;
  };
  entries: InconsistencyEntry[];
}

export class PaymentBookingDiffService {
  /**
   * Generates a comprehensive report of all financial and inventory inconsistencies.
   */
  async generateReport(): Promise<DiffReport> {
    const report: DiffReport = {
      generatedAt: new Date(),
      summary: {
        orphanedPayments: 0,
        orphanedBookings: 0,
        inventoryMismatches: 0,
        totalIssues: 0
      },
      entries: []
    };

    // 1. Detect orphaned payments (Payments without valid bookings)
    const orphans = await db
      .select({
        paymentId: payments.id,
        bookingId: payments.bookingId,
        ref: payments.gatewayReference,
        amount: payments.amount,
        status: payments.status
      })
      .from(payments)
      .leftJoin(bookings, eq(payments.bookingId, bookings.id))
      .where(isNull(bookings.id));

    for (const orphan of orphans) {
      report.summary.orphanedPayments++;
      report.entries.push({
        type: 'orphaned_payment',
        severity: orphan.status === PaymentStatus.Completed ? 'CRITICAL' : 'INFO',
        paymentId: orphan.paymentId,
        gatewayReference: orphan.ref || undefined,
        amount: orphan.amount,
        description: `Payment ${orphan.paymentId} references booking ${orphan.bookingId} which does not exist.`,
        recommendedAction: {
          label: orphan.status === PaymentStatus.Completed ? 'Investigate & Re-attach' : 'Ignore/Delete',
          type: 'review',
          description: 'Check bank statement for actual settlement before refunding.'
        }
      });
    }

    // 2. Detect orphaned bookings (Confirmed bookings without successful payments)
    const unpaidBookings = await db
      .select({
        id: bookings.id,
        customer: bookings.customerName,
        status: bookings.status,
        amount: bookings.amount
      })
      .from(bookings)
      .leftJoin(payments, eq(bookings.id, payments.bookingId))
      .where(and(
        eq(bookings.status, 'confirmed'),
        isNull(payments.id)
      ));

    for (const booking of unpaidBookings) {
      report.summary.orphanedBookings++;
      report.entries.push({
        type: 'orphaned_booking',
        severity: 'WARNING',
        bookingId: booking.id,
        description: `Booking ${booking.id} is confirmed but has no associated payment record.`,
        recommendedAction: {
          label: 'Verify Payment Manually',
          type: 'attach',
          description: 'Search for payment by customer name or email in bank gateway.'
        }
      });
    }

    // 3. Detect Inventory Mismatches (Completed payment but booking not confirmed or hold expired)
    const inventoryIssues = await db
      .select({
        paymentId: payments.id,
        bookingId: bookings.id,
        bookingStatus: bookings.status,
        holdId: bookings.holdId,
        amount: payments.amount
      })
      .from(payments)
      .innerJoin(bookings, eq(payments.bookingId, bookings.id))
      .where(and(
        eq(payments.status, PaymentStatus.Completed),
        eq(bookings.status, 'pending')
      ));

    for (const issue of inventoryIssues) {
      report.summary.inventoryMismatches++;
      report.entries.push({
        type: 'payment_without_inventory',
        severity: 'CRITICAL',
        paymentId: issue.paymentId,
        bookingId: issue.bookingId,
        amount: issue.amount,
        description: `Payment ${issue.paymentId} is Completed, but Booking ${issue.bookingId} is still Pending (Inventory failed to confirm).`,
        recommendedAction: {
          label: 'Force Confirm Inventory',
          type: 'repair_inventory',
          description: 'Trigger inventory repair and confirm booking manually if capacity exists.'
        }
      });
    }

    report.summary.totalIssues = report.entries.length;
    return report;
  }
}
