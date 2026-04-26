/**
 * Capacity Overview Service - Provides real-time capacity data for admin dashboard
 */

import { IStorage } from "../../storage.js";
import { db } from "../../db.js";
import { products, tourInstances } from "../../../shared/schema.js";
import { eq, gte, sql } from "drizzle-orm";

export interface TourCapacityOverview {
    tourId: string;
    tourTitle: string;
    date: string;
    totalCapacity: number;
    confirmedCount: number;
    heldCount: number;
    blockedCount: number;
    remainingCapacity: number;
    utilizationPercent: number;
    status: "available" | "limited" | "critical" | "sold-out";
}

export class CapacityOverviewService {
    constructor(private storage: IStorage) { }

    /**
     * Get capacity overview for all tours within a date range
     */
    async getCapacityOverview(
        startDate: string,
        endDate: string
    ): Promise<TourCapacityOverview[]> {
        // Fetch tour instances with tour details
        const instances = await db
            .select({
                tourId: tourInstances.tourId,
                tourTitle: products.title,
                date: tourInstances.serviceDate,
                totalCapacity: tourInstances.totalCapacity,
                confirmedCount: tourInstances.confirmedCount,
                heldCount: tourInstances.heldCount,
                blockedCount: tourInstances.blockedCount,
            })
            .from(tourInstances)
            .innerJoin(products, eq(products.id, tourInstances.tourId))
            .where(
                sql`${tourInstances.serviceDate} >= ${startDate} AND ${tourInstances.serviceDate} <= ${endDate}`
            );

        const overview: TourCapacityOverview[] = instances.map((instance: any) => {
            const used = instance.confirmedCount + instance.heldCount + instance.blockedCount;
            const remaining = Math.max(0, instance.totalCapacity - used);
            const utilizationPercent = instance.totalCapacity > 0 ? used / instance.totalCapacity : 0;

            let status: TourCapacityOverview["status"];
            if (remaining === 0) {
                status = "sold-out";
            } else if (utilizationPercent >= 0.9) {
                status = "critical";
            } else if (utilizationPercent >= 0.7) {
                status = "limited";
            } else {
                status = "available";
            }

            return {
                tourId: instance.tourId,
                tourTitle: instance.tourTitle,
                date: instance.date,
                totalCapacity: instance.totalCapacity,
                confirmedCount: instance.confirmedCount,
                heldCount: instance.heldCount,
                blockedCount: instance.blockedCount,
                remainingCapacity: remaining,
                utilizationPercent: Math.round(utilizationPercent * 100) / 100,
                status,
            };
        });

        return overview;
    }

    /**
     * Get capacity summary statistics
     */
    async getCapacitySummary(startDate: string, endDate: string): Promise<{
        totalTours: number;
        soldOutTours: number;
        criticalTours: number;
        averageUtilization: number;
    }> {
        const overview = await this.getCapacityOverview(startDate, endDate);

        const soldOutTours = overview.filter((t) => t.status === "sold-out").length;
        const criticalTours = overview.filter((t) => t.status === "critical").length;
        const averageUtilization =
            overview.length > 0
                ? overview.reduce((sum, t) => sum + t.utilizationPercent, 0) / overview.length
                : 0;

        return {
            totalTours: overview.length,
            soldOutTours,
            criticalTours,
            averageUtilization: Math.round(averageUtilization * 100) / 100,
        };
    }
}
