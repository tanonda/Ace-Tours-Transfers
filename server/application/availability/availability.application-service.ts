import { IStorage } from "../../storage.js";
import { AvailabilityService, HoldStatus } from "../../domain/availability/availability.service.js";
import { AvailabilityHold, TourInstance } from "../../../shared/schema.js";

export interface HoldRequest {
  tourId: string;
  date: string;
  slot?: string;
  quantity: number;
  sessionId: string;
}

export class AvailabilityApplicationService {
  private availabilityService: AvailabilityService;
  private storage: IStorage;

  constructor(storage: IStorage) {
    this.storage = storage;
    this.availabilityService = new AvailabilityService(storage);
  }

  async getAvailability(tourId: string, date: string, slot?: string): Promise<{ available: number }> {
    const available = await this.availabilityService.checkAvailability(tourId, date, slot);
    return { available };
  }

  async createHold(request: HoldRequest): Promise<AvailabilityHold> {
    return await this.availabilityService.createHold(
      request.tourId,
      request.date,
      request.quantity,
      request.sessionId,
      request.slot
    );
  }

  async confirmBooking(holdId: string): Promise<void> {
    await this.availabilityService.confirmBooking(holdId);
  }

  async releaseHold(holdId: string): Promise<void> {
    await this.availabilityService.releaseHold(holdId, HoldStatus.RELEASED);
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
}
