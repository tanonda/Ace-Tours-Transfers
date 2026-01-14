import { IStorage } from "../../storage.js";
import { AvailabilityService, HoldStatus } from "../../domain/availability/availability.service.js";

export class HoldExpiryJob {
  private availabilityService: AvailabilityService;
  private storage: IStorage;

  constructor(storage: IStorage) {
    this.storage = storage;
    this.availabilityService = new AvailabilityService(storage);
  }

  async run(): Promise<void> {
    const now = new Date();
    const expiredHolds = await this.storage.getExpiredHolds(now);
    
    if (expiredHolds.length > 0) {
      console.log(`[JOB] Found ${expiredHolds.length} expired holds. Starting cleanup...`);
      for (const hold of expiredHolds) {
        try {
          await this.availabilityService.releaseHold(hold.id, HoldStatus.EXPIRED);
          console.log(`[JOB] Released hold ${hold.id}`);
        } catch (error) {
          console.error(`[JOB] Failed to release hold ${hold.id}:`, error);
        }
      }
    }
  }

  start(intervalMs: number = 60000): void {
    console.log(`[JOB] Starting HoldExpiryJob with interval ${intervalMs}ms`);
    setInterval(() => this.run(), intervalMs);
  }
}
