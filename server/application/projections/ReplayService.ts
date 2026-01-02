import { storage } from "../storage";
import { projectionEngine } from "../infrastructure/projections/projection-engine";
import { BookingCreated, PaymentInitiated, PaymentConfirmed } from "../domain/events";

export class ReplayService {
  public static async rebuildAll(): Promise<void> {
    console.log("[REPLAY] Starting full projection rebuild...");
    
    // 1. Clear existing projections
    await storage.clearProjections();
    
    // 2. Reconstruct Event Stream (Simple version: fetch from tables)
    // In a strict event-store system, we would fetch from an events table.
    // Here we derive from domain entities to satisfy the "disposable read model" rule.
    
    const events: any[] = [];
    
    // FETCH BOOKINGS -> BookingCreated
    const bookings = await (storage as any).db.select().from((storage as any).bookings);
    for (const b of bookings) {
      const event = new BookingCreated(b.id, parseInt(b.amount));
      (event as any).occurredAt = b.createdAt;
      events.push(event);
    }
    
    // FETCH PAYMENTS -> PaymentInitiated, PaymentConfirmed
    const payments = await (storage as any).db.select().from((storage as any).payments);
    for (const p of payments) {
      const initiated = new PaymentInitiated(p.id, p.bookingId, p.amount);
      (initiated as any).occurredAt = p.createdAt;
      events.push(initiated);
      
      if (p.status === 'completed') {
        const confirmed = new PaymentConfirmed(p.id, p.bookingId);
        (confirmed as any).occurredAt = p.updatedAt || p.createdAt;
        events.push(confirmed);
      }
    }
    
    // 3. Sort by occurredAt to ensure causal consistency
    events.sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
    
    // 4. Replay through Engine
    await projectionEngine.replay(events);
    
    console.log("[REPLAY] Finished full projection rebuild.");
  }
}
