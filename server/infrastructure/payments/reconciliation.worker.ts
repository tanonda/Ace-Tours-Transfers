import { PaymentReconciliationService } from "../../application/payment-reconciliation.service";

export class ReconciliationWorker {
  private reconciliationService: PaymentReconciliationService;
  private intervalMinutes: number;
  private isRunning: boolean = false;
  private timer: NodeJS.Timeout | null = null;
  private batchSize: number = 20;

  constructor(reconciliationService: PaymentReconciliationService, intervalMinutes: number = 15) {
    this.reconciliationService = reconciliationService;
    this.intervalMinutes = intervalMinutes;
  }

  /**
   * Starts the periodic reconciliation loop.
   */
  start() {
    if (this.timer) return;
    
    console.log(`[WORKER] Starting ReconciliationWorker (Interval: ${this.intervalMinutes}m)`);
    
    // Run immediately on start, then periodically
    this.performReconciliation();
    
    this.timer = setInterval(() => {
      this.performReconciliation();
    }, this.intervalMinutes * 60 * 1000);
  }

  /**
   * Stops the periodic reconciliation loop.
   */
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log(`[WORKER] ReconciliationWorker stopped.`);
    }
  }

  /**
   * Executes a single batch reconciliation pass.
   */
  private async performReconciliation() {
    if (this.isRunning) {
      console.warn(`[WORKER] Previous reconciliation pass still in progress. Skipping loop.`);
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      await this.reconciliationService.reconcileStalePayments(this.batchSize);
      const duration = Date.now() - startTime;
      console.log(`[WORKER] Reconciliation pass completed in ${duration}ms.`);
    } catch (error) {
      console.error(`[WORKER] Critical error during reconciliation pass:`, error);
    } finally {
      this.isRunning = false;
    }
  }
}
