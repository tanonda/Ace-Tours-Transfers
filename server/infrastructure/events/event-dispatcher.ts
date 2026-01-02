
import { DomainEvent } from "../../domain/events";

export type EventHandler<T extends DomainEvent> = (event: T) => Promise<void> | void;

export class EventDispatcher {
  private static instance: EventDispatcher;
  private handlers: Map<string, EventHandler<any>[]> = new Map();

  private constructor() {}

  public static getInstance(): EventDispatcher {
    if (!EventDispatcher.instance) {
      EventDispatcher.instance = new EventDispatcher();
    }
    return EventDispatcher.instance;
  }

  public subscribe<T extends DomainEvent>(eventClass: { new (...args: any[]): T }, handler: EventHandler<T>): void {
    const eventName = eventClass.name;
    if (!this.handlers.has(eventName)) {
      this.handlers.set(eventName, []);
    }
    this.handlers.get(eventName)!.push(handler);
  }

  public async dispatch(event: DomainEvent & { correlationId?: string }): Promise<void> {
    const eventName = event.constructor.name;
    const handlers = this.handlers.get(eventName);
    const correlationId = event.correlationId || 'no-correlation';
    
    if (handlers) {
      console.log(`[EVENT][${correlationId}] Dispatching ${eventName}`, JSON.stringify(event));
      await Promise.all(handlers.map(async (handler) => {
        try {
          await Promise.resolve(handler(event));
          console.log(`[EVENT][${correlationId}] Handler for ${eventName} completed successfully`);
        } catch (err) {
          console.error(`[EVENT][${correlationId}][ERROR] Handler for ${eventName} failed:`, err);
        }
      }));
    } else {
      console.log(`[EVENT][${correlationId}] No handlers registered for ${eventName}`);
    }
  }
}

export const eventDispatcher = EventDispatcher.getInstance();
