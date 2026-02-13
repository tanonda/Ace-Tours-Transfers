
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
                // Compute utilization snapshot for today's instances
                try {
                    const today = new Date().toISOString().split('T')[0];
                    const instances = await storage.getTourInstances(tour.id, today);
                    if (instances && instances.length > 0) {
                        const totalCap = instances.reduce((s, i) => s + (i.totalCapacity || 0), 0);
                        const totalConfirmed = instances.reduce((s, i) => s + (i.confirmedCount || 0), 0);
                        utilization[tour.id] = totalCap > 0 ? Math.round((totalConfirmed / totalCap) * 10000) / 100 : 0;
                    } else {
                        utilization[tour.id] = 0;
                    }
                } catch (e) {
                    utilization[tour.id] = 0;
                }
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
