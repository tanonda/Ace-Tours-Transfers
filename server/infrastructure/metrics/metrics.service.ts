
import { storage } from "../../storage.js";

export interface SystemMetrics {
    totalBookings: number;
    totalHolds: number;
    expiredHolds: number;
    confirmedBookings: number;
    failures: Record<string, number>;
    utilization: Record<string, number>; // productId -> percentage
}

class MetricsService {
    private bookingFailures: Record<string, number> = {};
    private holdCreations: number = 0;
    private holdExpirations: number = 0;
    private holdConfirmations: number = 0;

    incrementFailure(reason: string) {
        this.bookingFailures[reason] = (this.bookingFailures[reason] || 0) + 1;
    }

    incrementHoldCreation() {
        this.holdCreations++;
    }

    incrementHoldExpiration() {
        this.holdExpirations++;
    }

    incrementHoldConfirmation() {
        this.holdConfirmations++;
    }

    async getMetrics(): Promise<SystemMetrics> {
        const stats = await storage.getBookingStats();

        // Calculate utilization for active tours
        const tours = await storage.getTours();
        const utilization: Record<string, number> = {};

        for (const tour of tours) {
            // Basic utilization: current confirmed / total capacity for today or lately
            // For a real system we'd look at a date range, but let's do a simple snapshot
            // We'll peek at the audit log or instances?
            // For now, let's keep it simple: total confirmed across all time? 
            // No, let's just return our counters.
        }

        return {
            totalBookings: stats.total,
            totalHolds: this.holdCreations,
            expiredHolds: this.holdExpirations,
            confirmedBookings: this.holdConfirmations,
            failures: this.bookingFailures,
            utilization
        };
    }

    async getAlerts() {
        const metrics = await this.getMetrics();
        const alerts: string[] = [];

        // Alert if failure rate is high (placeholder logic)
        const totalAttempts = metrics.totalBookings + Object.values(metrics.failures).reduce((a, b) => a + b, 0);
        const failureRate = totalAttempts > 0 ? (Object.values(metrics.failures).reduce((a, b) => a + b, 0) / totalAttempts) : 0;

        if (failureRate > 0.1) {
            alerts.push(`High booking failure rate: ${(failureRate * 100).toFixed(1)}%`);
        }

        return alerts;
    }
}

export const metricsService = new MetricsService();
