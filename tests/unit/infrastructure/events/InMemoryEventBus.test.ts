/**
 * ARCHITECTURE: Infrastructure layer tests
 * Pattern: Unit tests for InMemoryEventBus
 * Rationale: Ensure event publishing and subscription work correctly
 */

import 'reflect-metadata';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InMemoryEventBus } from '../../../../src/infrastructure/events/InMemoryEventBus';
import { DomainEvent } from '../../../../src/application/ports/IEventBus';

// Helper to create test events
function createTestEvent(eventType: string, data: Record<string, unknown> = {}): DomainEvent {
  return {
    eventId: `event-${Date.now()}-${Math.random()}`,
    timestamp: new Date().toISOString(),
    eventType,
    aggregateId: 'test-aggregate',
    data,
  };
}

describe('InMemoryEventBus', () => {
  let eventBus: InMemoryEventBus;

  beforeEach(() => {
    eventBus = new InMemoryEventBus();
  });

  describe('Subscription', () => {
    it('should subscribe a handler to an event type', () => {
      const handler = vi.fn(async () => {});

      eventBus.subscribe('TestEvent', handler);

      expect(eventBus.getHandlerCount('TestEvent')).toBe(1);
    });

    it('should subscribe multiple handlers to the same event type', () => {
      const handler1 = vi.fn(async () => {});
      const handler2 = vi.fn(async () => {});
      const handler3 = vi.fn(async () => {});

      eventBus.subscribe('TestEvent', handler1);
      eventBus.subscribe('TestEvent', handler2);
      eventBus.subscribe('TestEvent', handler3);

      expect(eventBus.getHandlerCount('TestEvent')).toBe(3);
    });

    it('should subscribe handlers to different event types', () => {
      const handler1 = vi.fn(async () => {});
      const handler2 = vi.fn(async () => {});

      eventBus.subscribe('EventA', handler1);
      eventBus.subscribe('EventB', handler2);

      expect(eventBus.getHandlerCount('EventA')).toBe(1);
      expect(eventBus.getHandlerCount('EventB')).toBe(1);
    });

    it('should not duplicate the same handler for the same event type', () => {
      const handler = vi.fn(async () => {});

      eventBus.subscribe('TestEvent', handler);
      eventBus.subscribe('TestEvent', handler); // Subscribe twice
      eventBus.subscribe('TestEvent', handler); // Subscribe thrice

      // Set should prevent duplicates
      expect(eventBus.getHandlerCount('TestEvent')).toBe(1);
    });

    it('should return 0 handler count for unsubscribed event types', () => {
      expect(eventBus.getHandlerCount('NonExistentEvent')).toBe(0);
    });
  });

  describe('Publishing Events', () => {
    it('should call subscribed handler when event is published', async () => {
      const handler = vi.fn(async () => {});
      const event = createTestEvent('TestEvent', { message: 'test' });

      eventBus.subscribe('TestEvent', handler);
      await eventBus.publish(event);

      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith(event);
    });

    it('should call all subscribed handlers for an event', async () => {
      const handler1 = vi.fn(async () => {});
      const handler2 = vi.fn(async () => {});
      const handler3 = vi.fn(async () => {});
      const event = createTestEvent('TestEvent');

      eventBus.subscribe('TestEvent', handler1);
      eventBus.subscribe('TestEvent', handler2);
      eventBus.subscribe('TestEvent', handler3);

      await eventBus.publish(event);

      expect(handler1).toHaveBeenCalledOnce();
      expect(handler2).toHaveBeenCalledOnce();
      expect(handler3).toHaveBeenCalledOnce();
    });

    it('should only call handlers subscribed to the specific event type', async () => {
      const handlerA = vi.fn(async () => {});
      const handlerB = vi.fn(async () => {});
      const eventA = createTestEvent('EventA');

      eventBus.subscribe('EventA', handlerA);
      eventBus.subscribe('EventB', handlerB);

      await eventBus.publish(eventA);

      expect(handlerA).toHaveBeenCalledOnce();
      expect(handlerB).not.toHaveBeenCalled();
    });

    it('should not error when publishing event with no subscribers', async () => {
      const event = createTestEvent('UnsubscribedEvent');

      await expect(eventBus.publish(event)).resolves.not.toThrow();
    });

    it('should pass event data to handlers correctly', async () => {
      let receivedEvent: DomainEvent | null = null;
      const handler = vi.fn(async (event: DomainEvent) => {
        receivedEvent = event;
      });

      const testData = { userId: '123', action: 'created' };
      const event = createTestEvent('UserCreated', testData);

      eventBus.subscribe('UserCreated', handler);
      await eventBus.publish(event);

      expect(receivedEvent).not.toBeNull();
      expect(receivedEvent?.eventType).toBe('UserCreated');
      expect(receivedEvent?.data).toEqual(testData);
    });
  });

  describe('Error Handling', () => {
    it('should not fail other handlers if one handler throws', async () => {
      const successHandler1 = vi.fn(async () => {});
      const failingHandler = vi.fn(async () => {
        throw new Error('Handler failed');
      });
      const successHandler2 = vi.fn(async () => {});

      const event = createTestEvent('TestEvent');

      eventBus.subscribe('TestEvent', successHandler1);
      eventBus.subscribe('TestEvent', failingHandler);
      eventBus.subscribe('TestEvent', successHandler2);

      // Should not throw despite failing handler
      await expect(eventBus.publish(event)).resolves.not.toThrow();

      // All handlers should have been called
      expect(successHandler1).toHaveBeenCalledOnce();
      expect(failingHandler).toHaveBeenCalledOnce();
      expect(successHandler2).toHaveBeenCalledOnce();
    });

    it('should handle multiple failing handlers gracefully', async () => {
      const failingHandler1 = vi.fn(async () => {
        throw new Error('Handler 1 failed');
      });
      const failingHandler2 = vi.fn(async () => {
        throw new Error('Handler 2 failed');
      });

      const event = createTestEvent('TestEvent');

      eventBus.subscribe('TestEvent', failingHandler1);
      eventBus.subscribe('TestEvent', failingHandler2);

      await expect(eventBus.publish(event)).resolves.not.toThrow();

      expect(failingHandler1).toHaveBeenCalledOnce();
      expect(failingHandler2).toHaveBeenCalledOnce();
    });

    it('should handle handler that returns rejected promise', async () => {
      const rejectingHandler = vi.fn(async () => {
        return Promise.reject(new Error('Promise rejected'));
      });
      const successHandler = vi.fn(async () => {});

      const event = createTestEvent('TestEvent');

      eventBus.subscribe('TestEvent', rejectingHandler);
      eventBus.subscribe('TestEvent', successHandler);

      await expect(eventBus.publish(event)).resolves.not.toThrow();

      expect(rejectingHandler).toHaveBeenCalledOnce();
      expect(successHandler).toHaveBeenCalledOnce();
    });
  });

  describe('Unsubscription', () => {
    it('should unsubscribe a handler from an event type', async () => {
      const handler = vi.fn(async () => {});
      const event = createTestEvent('TestEvent');

      eventBus.subscribe('TestEvent', handler);
      eventBus.unsubscribe('TestEvent', handler);

      await eventBus.publish(event);

      expect(handler).not.toHaveBeenCalled();
      expect(eventBus.getHandlerCount('TestEvent')).toBe(0);
    });

    it('should only unsubscribe the specific handler', async () => {
      const handler1 = vi.fn(async () => {});
      const handler2 = vi.fn(async () => {});
      const event = createTestEvent('TestEvent');

      eventBus.subscribe('TestEvent', handler1);
      eventBus.subscribe('TestEvent', handler2);
      eventBus.unsubscribe('TestEvent', handler1);

      await eventBus.publish(event);

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledOnce();
      expect(eventBus.getHandlerCount('TestEvent')).toBe(1);
    });

    it('should handle unsubscribing non-existent handler gracefully', () => {
      const handler = vi.fn(async () => {});

      expect(() => {
        eventBus.unsubscribe('NonExistentEvent', handler);
      }).not.toThrow();
    });

    it('should handle unsubscribing from non-existent event type', () => {
      const handler = vi.fn(async () => {});

      // Subscribe to one event
      eventBus.subscribe('EventA', handler);

      // Unsubscribe from different event (not subscribed)
      expect(() => {
        eventBus.unsubscribe('EventB', handler);
      }).not.toThrow();

      // Original subscription should still work
      expect(eventBus.getHandlerCount('EventA')).toBe(1);
    });

    it('should remove event type from map when last handler is unsubscribed', () => {
      const handler1 = vi.fn(async () => {});
      const handler2 = vi.fn(async () => {});

      eventBus.subscribe('TestEvent', handler1);
      eventBus.subscribe('TestEvent', handler2);

      expect(eventBus.getHandlerCount('TestEvent')).toBe(2);

      eventBus.unsubscribe('TestEvent', handler1);
      expect(eventBus.getHandlerCount('TestEvent')).toBe(1);

      eventBus.unsubscribe('TestEvent', handler2);
      expect(eventBus.getHandlerCount('TestEvent')).toBe(0);
    });
  });

  describe('Clear', () => {
    it('should remove all handlers from all event types', async () => {
      const handler1 = vi.fn(async () => {});
      const handler2 = vi.fn(async () => {});
      const handler3 = vi.fn(async () => {});

      eventBus.subscribe('EventA', handler1);
      eventBus.subscribe('EventB', handler2);
      eventBus.subscribe('EventC', handler3);

      eventBus.clear();

      expect(eventBus.getHandlerCount('EventA')).toBe(0);
      expect(eventBus.getHandlerCount('EventB')).toBe(0);
      expect(eventBus.getHandlerCount('EventC')).toBe(0);

      // Publishing events should not call any handlers
      await eventBus.publish(createTestEvent('EventA'));
      await eventBus.publish(createTestEvent('EventB'));
      await eventBus.publish(createTestEvent('EventC'));

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
      expect(handler3).not.toHaveBeenCalled();
    });

    it('should allow subscribing after clear', async () => {
      const handler = vi.fn(async () => {});

      eventBus.subscribe('TestEvent', handler);
      eventBus.clear();

      // Subscribe again after clear
      const newHandler = vi.fn(async () => {});
      eventBus.subscribe('TestEvent', newHandler);

      await eventBus.publish(createTestEvent('TestEvent'));

      expect(handler).not.toHaveBeenCalled(); // Old handler not called
      expect(newHandler).toHaveBeenCalledOnce(); // New handler called
    });
  });

  describe('Parallel Execution', () => {
    it('should execute handlers in parallel', async () => {
      const executionOrder: number[] = [];

      const handler1 = vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        executionOrder.push(1);
      });

      const handler2 = vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        executionOrder.push(2);
      });

      const handler3 = vi.fn(async () => {
        executionOrder.push(3);
      });

      const event = createTestEvent('TestEvent');

      eventBus.subscribe('TestEvent', handler1);
      eventBus.subscribe('TestEvent', handler2);
      eventBus.subscribe('TestEvent', handler3);

      const startTime = Date.now();
      await eventBus.publish(event);
      const duration = Date.now() - startTime;

      // All handlers should have been called
      expect(handler1).toHaveBeenCalledOnce();
      expect(handler2).toHaveBeenCalledOnce();
      expect(handler3).toHaveBeenCalledOnce();

      // If executed sequentially, would take 60ms+
      // In parallel, should take ~50ms (time of longest handler)
      expect(duration).toBeLessThan(100);

      // Handler3 (instant) and Handler2 (10ms) should complete before Handler1 (50ms)
      expect(executionOrder[0]).toBe(3);
      expect(executionOrder[1]).toBe(2);
      expect(executionOrder[2]).toBe(1);
    });
  });

  describe('Multiple Events', () => {
    it('should handle publishing multiple events in sequence', async () => {
      const handler = vi.fn(async () => {});

      eventBus.subscribe('TestEvent', handler);

      await eventBus.publish(createTestEvent('TestEvent', { count: 1 }));
      await eventBus.publish(createTestEvent('TestEvent', { count: 2 }));
      await eventBus.publish(createTestEvent('TestEvent', { count: 3 }));

      expect(handler).toHaveBeenCalledTimes(3);
    });

    it('should handle publishing different event types', async () => {
      const handlerA = vi.fn(async () => {});
      const handlerB = vi.fn(async () => {});

      eventBus.subscribe('EventA', handlerA);
      eventBus.subscribe('EventB', handlerB);

      await eventBus.publish(createTestEvent('EventA'));
      await eventBus.publish(createTestEvent('EventB'));
      await eventBus.publish(createTestEvent('EventA'));

      expect(handlerA).toHaveBeenCalledTimes(2);
      expect(handlerB).toHaveBeenCalledTimes(1);
    });
  });

  describe('Handler Count', () => {
    it('should return correct handler count for event with multiple handlers', () => {
      const handler1 = vi.fn(async () => {});
      const handler2 = vi.fn(async () => {});
      const handler3 = vi.fn(async () => {});

      eventBus.subscribe('TestEvent', handler1);
      eventBus.subscribe('TestEvent', handler2);
      eventBus.subscribe('TestEvent', handler3);

      expect(eventBus.getHandlerCount('TestEvent')).toBe(3);
    });

    it('should update handler count after unsubscription', () => {
      const handler1 = vi.fn(async () => {});
      const handler2 = vi.fn(async () => {});

      eventBus.subscribe('TestEvent', handler1);
      eventBus.subscribe('TestEvent', handler2);

      expect(eventBus.getHandlerCount('TestEvent')).toBe(2);

      eventBus.unsubscribe('TestEvent', handler1);

      expect(eventBus.getHandlerCount('TestEvent')).toBe(1);
    });

    it('should return 0 for non-existent event types', () => {
      expect(eventBus.getHandlerCount('DoesNotExist')).toBe(0);
    });
  });
});
