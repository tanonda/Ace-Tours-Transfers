
import { storage } from "../../storage.js";

export interface UtilizationMetric {
    productId: string;
    productName: string;
    totalCapacity: number;
    confirmedCount: number;
    heldCount: number;
    blockedCount: number;
    utilizationPercent: number;
    availableSeats: number;
}

export interface SystemMetrics {
    timestamp: string;
    
    // Booking statistics
    totalBookings: number;
    totalHolds: number;
    expiredHolds: number;
    confirmedBookings: number;
    
    // Failure tracking
    failures: Record<string, number>;
    failureRate: number; // 0-100 percentage
    
    // Utilization by product
    utilization: UtilizationMetric[];
    maxUtilization: number; // highest utilization percent
    criticalUtilization: UtilizationMetric[]; // products >95% utilized
    
    // Hold lifecycle
    averageHoldDurationMinutes: number;
    holdExpiryRate: number; // expired / created ratio
    
    // Performance
    avgTransactionTimeMs: number;
}

export interface SystemAlert {
    severity: "info" | "warning" | "critical";
    message: string;
    metric?: string;
    value?: number;
    threshold?: number;
    timestamp: string;
}

/**
 * Phase 8: Observability & Monitoring Service
 * 
 * Provides comprehensive metrics collection and alerting for:
 * - Utilization levels (critical alert >95%)
 * - Booking failures and failure rate spikes
 * - Hold lifecycle and expiry statistics
 * - Overbooking protection logs
 * - Performance monitoring
 */
class MetricsService {
    private bookingFailures: Record<string, number> = {};
    private holdCreations: number = 0;
    private holdExpirations: number = 0;
    private holdConfirmations: number = 0;
    private transactionTimes: number[] = [];
    private holdCreationTimes: Map<string, number> = new Map(); // holdId -> createdAt
    private lastAlertTime: Record<string, number> = {}; // alert key -> timestamp
    private readonly ALERT_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

    // Phase 4: Concurrency metrics
    private confirmationSuccesses: number = 0;
    private confirmationFailures: Record<string, number> = {};
    private conflictDetections: Record<string, number> = {};
    private nonRetryableFailures: Record<string, number> = {};
    private retryableConfirmationAttempts: number[] = [];
    private retryExhaustedCount: number = 0;
    private bookingConfirmationLatencies: number[] = [];

    incrementFailure(reason: string) {
        this.bookingFailures[reason] = (this.bookingFailures[reason] || 0) + 1;
    }

    incrementHoldCreation(holdId?: string) {
        this.holdCreations++;
        if (holdId) {
            this.holdCreationTimes.set(holdId, Date.now());
        }
    }

    incrementHoldExpiration(holdId?: string) {
        this.holdExpirations++;
        if (holdId) {
            this.holdCreationTimes.delete(holdId);
        }
    }

    incrementHoldConfirmation(holdId?: string) {
        this.holdConfirmations++;
        if (holdId) {
            this.holdCreationTimes.delete(holdId);
        }
    }

    // Phase 4: Concurrency tracking methods
    incrementConfirmationSuccess(): void {
        this.confirmationSuccesses++;
    }

    incrementConfirmationFailure(errorCode: string): void {
        this.confirmationFailures[errorCode] = (this.confirmationFailures[errorCode] || 0) + 1;
    }

    incrementConflictDetectedFailure(conflictType: string): void {
        this.conflictDetections[conflictType] = (this.conflictDetections[conflictType] || 0) + 1;
    }

    incrementNonRetryableConfirmationFailure(errorCode: string): void {
        this.nonRetryableFailures[errorCode] = (this.nonRetryableFailures[errorCode] || 0) + 1;
    }

    recordRetryableConfirmationAttempts(attemptCount: number): void {
        this.retryableConfirmationAttempts.push(attemptCount);
        // Keep last 1000 measurements
        if (this.retryableConfirmationAttempts.length > 1000) {
            this.retryableConfirmationAttempts = this.retryableConfirmationAttempts.slice(-1000);
        }
    }

    incrementRetryExhausted(): void {
        this.retryExhaustedCount++;
    }

    recordBookingConfirmationLatency(durationMs: number): void {
        this.bookingConfirmationLatencies.push(durationMs);
        // Keep last 1000 measurements
        if (this.bookingConfirmationLatencies.length > 1000) {
            this.bookingConfirmationLatencies = this.bookingConfirmationLatencies.slice(-1000);
        }
    }

    recordTransactionTime(durationMs: number) {
        this.transactionTimes.push(durationMs);
        // Keep only last 1000 measurements
        if (this.transactionTimes.length > 1000) {
            this.transactionTimes = this.transactionTimes.slice(-1000);
        }
    }

    /**
     * Phase 4: Get concurrency-specific metrics
     */
    getConcurrencyMetrics() {
        const avgRetryableAttempts = this.retryableConfirmationAttempts.length > 0
            ? this.retryableConfirmationAttempts.reduce((a, b) => a + b, 0) / this.retryableConfirmationAttempts.length
            : 1;

        const avgConfirmationLatency = this.bookingConfirmationLatencies.length > 0
            ? Math.round(
                this.bookingConfirmationLatencies.reduce((a, b) => a + b, 0) / 
                this.bookingConfirmationLatencies.length
            )
            : 0;

        const totalConfirmationAttempts = this.confirmationSuccesses + 
            Object.values(this.confirmationFailures).reduce((a, b) => a + b, 0);

        const confirmationSuccessRate = totalConfirmationAttempts > 0
            ? (this.confirmationSuccesses / totalConfirmationAttempts) * 100
            : 100;

        return {
            confirmationSuccesses: this.confirmationSuccesses,
            confirmationFailures: this.confirmationFailures,
            conflictDetections: this.conflictDetections,
            nonRetryableFailures: this.nonRetryableFailures,
            retryExhaustedCount: this.retryExhaustedCount,
            avgRetryableAttempts: Math.round(avgRetryableAttempts * 100) / 100,
            avgConfirmationLatencyMs: avgConfirmationLatency,
            confirmationSuccessRate: Math.round(confirmationSuccessRate * 100) / 100,
        };
    }

    async getMetrics(): Promise<SystemMetrics> {
        const stats = await storage.getBookingStats();
        const tours = await storage.getTours();
        const today = new Date().toISOString().split('T')[0];

        const utilization: UtilizationMetric[] = [];
        let maxUtilization = 0;
        const criticalUtilization: UtilizationMetric[] = [];

        // Calculate utilization for each tour
        for (const tour of tours) {
            try {
                const instances = await storage.getTourInstances(tour.id, today);
                if (instances && instances.length > 0) {
                    const totalCap = instances.reduce((s, i) => s + (i.totalCapacity || 0), 0);
                    const totalConfirmed = instances.reduce((s, i) => s + (i.confirmedCount || 0), 0);
                    const totalHeld = instances.reduce((s, i) => s + (i.heldCount || 0), 0);
                    const totalBlocked = instances.reduce((s, i) => s + (i.blockedCount || 0), 0);
                    
                    const utilizationPercent = totalCap > 0 
                        ? Math.round((totalConfirmed / totalCap) * 10000) / 100 
                        : 0;
                    const available = totalCap - (totalConfirmed + totalHeld + totalBlocked);

                    const metric: UtilizationMetric = {
                        productId: tour.id,
                        productName: tour.title,
                        totalCapacity: totalCap,
                        confirmedCount: totalConfirmed,
                        heldCount: totalHeld,
                        blockedCount: totalBlocked,
                        utilizationPercent,
                        availableSeats: Math.max(0, available),
                    };

                    utilization.push(metric);
                    maxUtilization = Math.max(maxUtilization, utilizationPercent);

                    if (utilizationPercent > 95) {
                        criticalUtilization.push(metric);
                    }
                }
            } catch (e) {
                console.error(`[METRICS] Error calculating utilization for tour ${tour.id}:`, e);
            }
        }

        // Calculate failure rate
        const totalFailures = Object.values(this.bookingFailures).reduce((a, b) => a + b, 0);
        const totalAttempts = stats.total + totalFailures;
        const failureRate = totalAttempts > 0 ? (totalFailures / totalAttempts) * 100 : 0;

        // Calculate average hold duration
        const holdDurations = Array.from(this.holdCreationTimes.values()).map(
            createdAt => (Date.now() - createdAt) / 1000 / 60 // Convert to minutes
        );
        const averageHoldDurationMinutes = holdDurations.length > 0
            ? Math.round(holdDurations.reduce((a, b) => a + b, 0) / holdDurations.length)
            : 0;

        // Calculate hold expiry rate
        const holdExpiryRate = this.holdCreations > 0
            ? (this.holdExpirations / this.holdCreations)
            : 0;

        // Calculate average transaction time
        const avgTransactionTimeMs = this.transactionTimes.length > 0
            ? Math.round(
                this.transactionTimes.reduce((a, b) => a + b, 0) / this.transactionTimes.length
            )
            : 0;

        return {
            timestamp: new Date().toISOString(),
            totalBookings: stats.total,
            totalHolds: this.holdCreations,
            expiredHolds: this.holdExpirations,
            confirmedBookings: this.holdConfirmations,
            failures: this.bookingFailures,
            failureRate: Math.round(failureRate * 100) / 100,
            utilization,
            maxUtilization,
            criticalUtilization,
            averageHoldDurationMinutes,
            holdExpiryRate: Math.round(holdExpiryRate * 10000) / 10000,
            avgTransactionTimeMs,
        };
    }

    async getAlerts(): Promise<SystemAlert[]> {
        const metrics = await this.getMetrics();
        const alerts: SystemAlert[] = [];

        // Alert 1: High failure rate
        if (metrics.failureRate > 10) {
            const alertKey = "high_failure_rate";
            if (this.shouldAlert(alertKey)) {
                alerts.push({
                    severity: "critical",
                    message: `High booking failure rate detected: ${metrics.failureRate.toFixed(1)}% (threshold: 10%)`,
                    metric: "failureRate",
                    value: metrics.failureRate,
                    threshold: 10,
                    timestamp: new Date().toISOString(),
                });
                this.updateAlertTime(alertKey);
            }
        }

        // Alert 2: Critical utilization
        if (metrics.criticalUtilization.length > 0) {
            const alertKey = "critical_utilization";
            if (this.shouldAlert(alertKey)) {
                const products = metrics.criticalUtilization
                    .map(p => `${p.productName} (${p.utilizationPercent.toFixed(1)}%)`)
                    .join(", ");
                alerts.push({
                    severity: "warning",
                    message: `Critical utilization (>95%): ${products}`,
                    metric: "utilization",
                    value: metrics.maxUtilization,
                    threshold: 95,
                    timestamp: new Date().toISOString(),
                });
                this.updateAlertTime(alertKey);
            }
        }

        // Alert 3: High hold expiry rate (potential data issues)
        if (metrics.holdExpiryRate > 0.5 && metrics.totalHolds > 100) {
            const alertKey = "high_hold_expiry_rate";
            if (this.shouldAlert(alertKey)) {
                alerts.push({
                    severity: "info",
                    message: `High hold expiry rate: ${(metrics.holdExpiryRate * 100).toFixed(1)}% (${metrics.expiredHolds} of ${metrics.totalHolds} holds expired)`,
                    metric: "holdExpiryRate",
                    value: metrics.holdExpiryRate,
                    timestamp: new Date().toISOString(),
                });
                this.updateAlertTime(alertKey);
            }
        }

        // Alert 4: High average transaction time (performance degradation)
        if (metrics.avgTransactionTimeMs > 5000) {
            const alertKey = "high_transaction_time";
            if (this.shouldAlert(alertKey)) {
                alerts.push({
                    severity: "warning",
                    message: `High average transaction time: ${metrics.avgTransactionTimeMs}ms (threshold: 5000ms)`,
                    metric: "avgTransactionTimeMs",
                    value: metrics.avgTransactionTimeMs,
                    threshold: 5000,
                    timestamp: new Date().toISOString(),
                });
                this.updateAlertTime(alertKey);
            }
        }

        return alerts;
    }

    private shouldAlert(alertKey: string): boolean {
        const lastTime = this.lastAlertTime[alertKey] ?? 0;
        return Date.now() - lastTime > this.ALERT_COOLDOWN_MS;
    }

    private updateAlertTime(alertKey: string): void {
        this.lastAlertTime[alertKey] = Date.now();
    }

    resetMetrics(): void {
        this.bookingFailures = {};
        this.holdCreations = 0;
        this.holdExpirations = 0;
        this.holdConfirmations = 0;
        this.transactionTimes = [];
        this.holdCreationTimes.clear();
        this.lastAlertTime = {};
        
        // Phase 4: Reset concurrency metrics
        this.confirmationSuccesses = 0;
        this.confirmationFailures = {};
        this.conflictDetections = {};
        this.nonRetryableFailures = {};
        this.retryableConfirmationAttempts = [];
        this.retryExhaustedCount = 0;
        this.bookingConfirmationLatencies = [];
    }
}

export const metricsService = new MetricsService();
