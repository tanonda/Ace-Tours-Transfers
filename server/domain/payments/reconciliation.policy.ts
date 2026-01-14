import { PaymentStatus } from "./interfaces.js";

export class ReconciliationPolicy {
  /**
   * Enforces terminal immutability and validates if a gateway-driven status change is safe.
   * PHASE 4: Adds conflict alerting (PAY-004) for terminal state mismatches.
   */
  static isTransitionSafe(currentStatus: PaymentStatus, gatewayStatus: PaymentStatus): boolean {
    const terminalStates = [
      PaymentStatus.Completed,
      PaymentStatus.Failed,
      PaymentStatus.Cancelled,
      PaymentStatus.Expired
    ];

    // INVARIANT: Terminal states must not be resurrected or changed automatedly.
    if (terminalStates.includes(currentStatus)) {
      if (currentStatus === PaymentStatus.Completed && gatewayStatus === PaymentStatus.Failed) {
        // [PAY-004] CRITICAL CONFLICT: Internal says Paid, Gateway says Failed.
        console.error(`[PAY-004] Critical payment state conflict for transaction. Internal: ${currentStatus}, Gateway: ${gatewayStatus}. Manual audit required.`);
      }
      return false;
    }

    // Allow transitions from non-terminal states to anything returned by the gateway.
    return true;
  }
}
