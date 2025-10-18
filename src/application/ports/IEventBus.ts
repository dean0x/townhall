/**
 * ARCHITECTURE: Application layer port for event handling
 * Pattern: Interface for infrastructure dependency
 * Rationale: Application layer defines contract, infrastructure implements
 */

export interface DomainEvent {
  readonly eventId: string;
  readonly timestamp: string;
  readonly eventType: string;
  readonly aggregateId: string;
  readonly data: Record<string, unknown>;
}

export interface IEventBus {
  /**
   * Publish a domain event
   */
  publish(event: DomainEvent): Promise<void>;

  /**
   * Subscribe to events of a specific type
   */
  subscribe(eventType: string, handler: (event: DomainEvent) => Promise<void>): void;

  /**
   * Unsubscribe from events
   */
  unsubscribe(eventType: string, handler: (event: DomainEvent) => Promise<void>): void;
}