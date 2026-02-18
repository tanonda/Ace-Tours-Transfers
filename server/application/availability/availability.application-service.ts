import { IStorage } from "../../storage.js";
import { AvailabilityService, HoldStatus } from "../../domain/availability/availability.service.js";
import { AvailabilityHold, TourInstance } from "../../../shared/schema.js";
import { eventDispatcher } from "../../infrastructure/events/event-dispatcher.js";
import { HoldReleased } from "../../domain/events.js";

// Manual payment methods (bank transfer, cash) need a much longer hold TTL
// because the customer may take 24–72 hours to complete their payment.
// Automatic card payments use the default 15-minute window.
export const MANUAL_PAYMENT_TTL_MINUTES = 4320; // 72 hours
export const CARD_PAYMENT_TTL_MINUTES   = 15;   // 15 minutes

export const MANUAL_PAYMENT_SLUGS = [
  'manual', 'manual_transfer', 'bank-transfer', 'bank_transfer',
  'cash', 'anz-egate', 'bsp-bank', 'bred-bank', 'wantok-money',
  'generic-local-bank',
];

export function getHoldTtlMinutes(paymentProvider?: string): number {
  if (!paymentProvider) return CARD_PAYMENT_TTL_MINUTES;
  const slug = paymentProvider.toLowerCase();
  const isManual = MANUAL_PAYMENT_SLUGS.some(s => slug.includes(s));
  return isManual ? MANUAL_PAYMENT_TTL_MINUTES : CARD_PAYMENT_TTL_MINUTES;
}

export interface HoldRequest {
  tourId: string;
  date: string;
  slot?: string;
  quantity: number;
  sessionId: string;
  ttlMinutes?: number;
  paymentProvider?: string; // when set, TTL is derived automatically if ttlMinutes is absent
  startTime?: string;
  endTime?: string;
  pinnedResourceId?: string;
}

export class AvailabilityApplicationService {
  private availabilityService: AvailabilityService;
  private storage: IStorage;

  constructor(storage: IStorage) {
    this.storage = storage;
    this.availabilityService = new AvailabilityService(storage);
  }

  async getAvailability(tourId: string, date: string, slot?: string, startTime?: string, endTime?: string): Promise<{ available: number }> {
    const available = await this.availabilityService.checkAvailability(tourId, date, slot, startTime, endTime);
    return { available };
  }

  async createHold(request: HoldRequest, tx?: any): Promise<AvailabilityHold> {
    // Derive TTL: explicit ttlMinutes wins; otherwise use paymentProvider to decide.
    const ttlMinutes = request.ttlMinutes ?? getHoldTtlMinutes(request.paymentProvider);
    return await this.availabilityService.createHoldWithInvalidation({
      tourId: request.tourId,
      date: request.date,
      quantity: request.quantity,
      sessionId: request.sessionId,
      slot: request.slot,
      ttlMinutes,
      startTime: request.startTime,
      endTime: request.endTime,
      pinnedResourceId: request.pinnedResourceId,
      tx
    });
  }

  async confirmBooking(holdId: string, tx?: any): Promise<void> {
    await this.availabilityService.confirmBooking(holdId, tx);
  }

  async confirmSessionHolds(sessionId: string): Promise<void> {
    await this.availabilityService.confirmHoldsBySession(sessionId);
  }

  async releaseHold(holdId: string): Promise<void> {
    await this.availabilityService.releaseHold(holdId, HoldStatus.RELEASED);
    await eventDispatcher.dispatch(new HoldReleased(holdId, "manual_release"));
  }

  async adminOverrideCapacity(instanceId: string, totalCapacity: number): Promise<TourInstance> {
    return await this.availabilityService.adminOverride(instanceId, { totalCapacity });
  }

  async adminBlockCapacity(instanceId: string, blockedCount: number): Promise<TourInstance> {
    return await this.availabilityService.adminOverride(instanceId, { blockedCount });
  }

  async updateCapacity(instanceId: string, totalCapacity?: number, blockedCount?: number): Promise<TourInstance> {
    return await this.availabilityService.adminOverride(instanceId, { totalCapacity, blockedCount });
  }

  async upsertInstance(data: {
    tourId: string;
    date: string;
    timeSlot?: string;
    startTime?: string;
    endTime?: string;
    totalCapacity: number;
    blockedCount?: number;
  }): Promise<TourInstance> {
    // Check if instance exists
    const existing = await this.storage.getTourInstance(data.tourId, data.date, data.timeSlot);
    if (existing) {
      return await this.updateCapacity(existing.id, data.totalCapacity, data.blockedCount);
    }

    // Create new instance
    return await this.storage.createTourInstance({
      tourId: data.tourId,
      serviceDate: data.date,
      timeSlot: data.timeSlot || null,
      startTime: data.startTime || null,
      endTime: data.endTime || null,
      totalCapacity: data.totalCapacity,
      blockedCount: data.blockedCount || 0,
      confirmedCount: 0,
      heldCount: 0
    });
  }

  async deleteInstance(instanceId: string): Promise<void> {
    await this.storage.deleteTourInstance(instanceId);
  }
}
