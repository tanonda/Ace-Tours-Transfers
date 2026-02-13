/**
 * CapacityAlertService - Monitors capacity utilization and triggers alerts
 * 
 * Notifies staff when tours are approaching sellout so they can take action.
 */

import { eventDispatcher } from "../../infrastructure/events/event-dispatcher.js";

export interface CapacityThresholdReached {
    type: "CapacityThresholdReached";
    tourId: string;
    tourName: string;
    date: string;
    totalCapacity: number;
    remainingCapacity: number;
    utilizationPercent: number;
    timestamp: Date;
    occurredAt: Date; // Required by DomainEvent
}

export interface AlertConfig {
    warningThreshold: number; // e.g., 0.8 = 80%
    criticalThreshold: number; // e.g., 0.9 = 90%
    enabled: boolean;
}

export class CapacityAlertService {
    private config: AlertConfig;

    constructor(config?: Partial<AlertConfig>) {
        this.config = {
            warningThreshold: config?.warningThreshold || 0.8,
            criticalThreshold: config?.criticalThreshold || 0.9,
            enabled: config?.enabled !== undefined ? config.enabled : true,
        };
    }

    /**
     * Check if capacity has reached alert threshold and emit event
     */
    checkCapacity(
        tourId: string,
        tourName: string,
        date: string,
        totalCapacity: number,
        remainingCapacity: number
    ): void {
        if (!this.config.enabled) return;

        const usedCapacity = totalCapacity - remainingCapacity;
        const utilizationPercent = totalCapacity > 0 ? usedCapacity / totalCapacity : 0;

        // Check if we've crossed a threshold
        if (utilizationPercent >= this.config.criticalThreshold) {
            this.emitAlert(tourId, tourName, date, totalCapacity, remainingCapacity, utilizationPercent, "CRITICAL");
        } else if (utilizationPercent >= this.config.warningThreshold) {
            this.emitAlert(tourId, tourName, date, totalCapacity, remainingCapacity, utilizationPercent, "WARNING");
        }
    }

    private emitAlert(
        tourId: string,
        tourName: string,
        date: string,
        totalCapacity: number,
        remainingCapacity: number,
        utilizationPercent: number,
        level: "WARNING" | "CRITICAL"
    ): void {
        const now = new Date();
        const event: CapacityThresholdReached = {
            type: "CapacityThresholdReached",
            tourId,
            tourName,
            date,
            totalCapacity,
            remainingCapacity,
            utilizationPercent,
            timestamp: now,
            occurredAt: now,
        };

        // Emit event for logging/notifications
        eventDispatcher.dispatch(event);

        // Log to console for staff visibility
        const emoji = level === "CRITICAL" ? "🚨" : "⚠️ ";
        console.log(
            `${emoji} [${level}] Capacity Alert: "${tourName}" on ${date} is ${Math.round(utilizationPercent * 100)}% booked (${remainingCapacity}/${totalCapacity} seats remaining)`
        );
    }

    /**
     * Update alert configuration
     */
    updateConfig(config: Partial<AlertConfig>): void {
        this.config = { ...this.config, ...config };
    }

    /**
     * Get current configuration
     */
    getConfig(): AlertConfig {
        return { ...this.config };
    }
}

// Singleton instance
export const capacityAlertService = new CapacityAlertService();
