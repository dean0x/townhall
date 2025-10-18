/**
 * ARCHITECTURE: Infrastructure implementation of event bus
 * Pattern: In-memory event bus for MVP
 * Rationale: Simple event handling without external dependencies
 */

import { injectable } from 'tsyringe';
import { IEventBus, DomainEvent } from '../../application/ports/IEventBus';

type EventHandler = (event: DomainEvent) => Promise<void>;

@injectable()
export class InMemoryEventBus implements IEventBus {
  private readonly handlers = new Map<string, Set<EventHandler>>();

  public async publish(event: DomainEvent): Promise<void> {
    const handlers = this.handlers.get(event.eventType);
    if (!handlers) {
      return;
    }

    // Execute all handlers in parallel
    const promises = Array.from(handlers).map(handler =>
      handler(event).catch(error => {
        console.error(`Event handler failed for ${event.eventType}:`, error);
      })
    );

    await Promise.allSettled(promises);
  }

  public subscribe(eventType: string, handler: EventHandler): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler);
  }

  public unsubscribe(eventType: string, handler: EventHandler): void {
    const handlers = this.handlers.get(eventType);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.handlers.delete(eventType);
      }
    }
  }

  public clear(): void {
    this.handlers.clear();
  }

  public getHandlerCount(eventType: string): number {
    return this.handlers.get(eventType)?.size ?? 0;
  }
}