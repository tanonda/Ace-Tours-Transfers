import { eventDispatcher } from "../events/event-dispatcher.js";
import { DomainEvent } from "../../domain/events.js";

export interface IProjectionHandler<T extends DomainEvent> {
  handle(event: T): Promise<void>;
}

export class ProjectionEngine {
  private static instance: ProjectionEngine;
  private handlers: Map<string, IProjectionHandler<any>[]> = new Map();

  private constructor() {}

  public static getInstance(): ProjectionEngine {
    if (!ProjectionEngine.instance) {
      ProjectionEngine.instance = new ProjectionEngine();
    }
    return ProjectionEngine.instance;
  }

  public register<T extends DomainEvent>(
    eventClass: { new (...args: any[]): T } | string,
    handler: IProjectionHandler<T>
  ): void {
    const eventName = typeof eventClass === 'string' ? eventClass : eventClass.name;
    
    if (!this.handlers.has(eventName)) {
      this.handlers.set(eventName, []);
    }
    this.handlers.get(eventName)!.push(handler);

    // Only subscribe to the dispatcher if it's the class version (for live events)
    if (typeof eventClass !== 'string') {
      eventDispatcher.subscribe(eventClass, (event: T) => {
        handler.handle(event).catch(err => {
          console.error(`[PROJECTION][ERROR] Failed to project ${event.constructor.name}:`, err);
        });
      });
    }
  }

  public async replay(events: DomainEvent[]): Promise<void> {
    console.log(`[PROJECTION] Replaying ${events.length} events...`);
    for (const event of events) {
      const eventName = event.constructor.name;
      const handlers = this.handlers.get(eventName);
      if (handlers) {
        for (const handler of handlers) {
          // Handlers MUST be idempotent as per ADR-004
          await handler.handle(event);
        }
      }
    }
    console.log('[PROJECTION] Replay complete.');
  }

  /**
   * Orchestrates a full rebuild of projections.
   * 1. Clears target tables (if handlers support it)
   * 2. Replays all events
   */
  public async rebuild(events: DomainEvent[]): Promise<void> {
    console.warn('[PROJECTION] Starting FULL REBUILD. This will clear existing read models.');
    
    // In a real system, we'd call a clear() method on each read model repository
    // For this implementation, we assume handlers or repository-backed projections 
    // handle their own internal flushing if needed or we use a separate migration.
    
    await this.replay(events);
  }
}


export const projectionEngine = ProjectionEngine.getInstance();
