/**
 * ARCHITECTURE: Application layer tests
 * Pattern: Unit tests for QueryBus mediator pattern
 * Rationale: Ensure query routing and error handling work correctly
 */

import 'reflect-metadata';
import { describe, it, expect, beforeEach } from 'vitest';
import { QueryBus, IQueryHandler } from '../../../../src/application/handlers/QueryBus';
import { Result, ok, err } from '../../../../src/shared/result';
import { ValidationError, InternalError, NotFoundError } from '../../../../src/shared/errors';

// Test query types
interface TestQuery {
  readonly id: string;
}

interface AnotherTestQuery {
  readonly filter: string;
}

// Mock handler that always succeeds
class SuccessfulHandler implements IQueryHandler<TestQuery, string> {
  public async handle(query: TestQuery): Promise<Result<string, Error>> {
    return ok(`Result for: ${query.id}`);
  }
}

// Mock handler that always fails with domain error
class FailingHandler implements IQueryHandler<TestQuery, string> {
  public async handle(query: TestQuery): Promise<Result<string, Error>> {
    return err(new NotFoundError('TestResource', query.id));
  }
}

// Mock handler that throws an exception
class ThrowingHandler implements IQueryHandler<TestQuery, string> {
  public async handle(query: TestQuery): Promise<Result<string, Error>> {
    throw new Error('Unexpected query exception');
  }
}

// Mock handler for different query type
class AnotherSuccessfulHandler implements IQueryHandler<AnotherTestQuery, string[]> {
  public async handle(query: AnotherTestQuery): Promise<Result<string[], Error>> {
    return ok([`Filtered: ${query.filter}`]);
  }
}

describe('QueryBus', () => {
  let queryBus: QueryBus;

  beforeEach(() => {
    queryBus = new QueryBus();
  });

  describe('Handler Registration', () => {
    it('should register a query handler successfully', () => {
      const handler = new SuccessfulHandler();

      expect(() => {
        queryBus.register('TestQuery', handler);
      }).not.toThrow();
    });

    it('should register multiple different handlers', () => {
      const handler1 = new SuccessfulHandler();
      const handler2 = new AnotherSuccessfulHandler();

      expect(() => {
        queryBus.register('TestQuery', handler1);
        queryBus.register('AnotherTestQuery', handler2);
      }).not.toThrow();
    });

    it('should allow overriding a registered handler', () => {
      const handler1 = new SuccessfulHandler();
      const handler2 = new FailingHandler();

      queryBus.register('TestQuery', handler1);
      queryBus.register('TestQuery', handler2); // Override

      // Should not throw - last registration wins
      expect(() => {
        queryBus.register('TestQuery', handler2);
      }).not.toThrow();
    });
  });

  describe('Query Execution - Success Cases', () => {
    it('should execute query with explicit query name', async () => {
      const handler = new SuccessfulHandler();
      queryBus.register('TestQuery', handler);

      const query: TestQuery = { id: 'test-123' };
      const result = await queryBus.execute(query, 'TestQuery');

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe('Result for: test-123');
      }
    });

    it('should execute query using constructor name fallback', async () => {
      const handler = new SuccessfulHandler();
      queryBus.register('TestQuery', handler);

      // Create query with constructor name
      class TestQuery {
        constructor(public readonly id: string) {}
      }

      const query = new TestQuery('constructor-query');
      const result = await queryBus.execute(query);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe('Result for: constructor-query');
      }
    });

    it('should execute multiple different queries', async () => {
      const handler1 = new SuccessfulHandler();
      const handler2 = new AnotherSuccessfulHandler();

      queryBus.register('TestQuery', handler1);
      queryBus.register('AnotherTestQuery', handler2);

      const query1: TestQuery = { id: 'first' };
      const query2: AnotherTestQuery = { filter: 'active' };

      const result1 = await queryBus.execute(query1, 'TestQuery');
      const result2 = await queryBus.execute(query2, 'AnotherTestQuery');

      expect(result1.isOk()).toBe(true);
      expect(result2.isOk()).toBe(true);

      if (result1.isOk()) expect(result1.value).toBe('Result for: first');
      if (result2.isOk()) expect(result2.value).toEqual(['Filtered: active']);
    });

    it('should execute same query multiple times', async () => {
      const handler = new SuccessfulHandler();
      queryBus.register('TestQuery', handler);

      const query1: TestQuery = { id: 'query-1' };
      const query2: TestQuery = { id: 'query-2' };
      const query3: TestQuery = { id: 'query-3' };

      const result1 = await queryBus.execute(query1, 'TestQuery');
      const result2 = await queryBus.execute(query2, 'TestQuery');
      const result3 = await queryBus.execute(query3, 'TestQuery');

      expect(result1.isOk()).toBe(true);
      expect(result2.isOk()).toBe(true);
      expect(result3.isOk()).toBe(true);

      if (result1.isOk()) expect(result1.value).toBe('Result for: query-1');
      if (result2.isOk()) expect(result2.value).toBe('Result for: query-2');
      if (result3.isOk()) expect(result3.value).toBe('Result for: query-3');
    });
  });

  describe('Query Execution - Error Cases', () => {
    it('should return error when no handler is registered', async () => {
      const query: TestQuery = { id: 'unhandled' };
      const result = await queryBus.execute(query, 'UnregisteredQuery');

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(InternalError);
        expect(result.error.message).toContain('No handler registered for query');
        expect(result.error.message).toContain('UnregisteredQuery');
      }
    });

    it('should return error when handler returns error Result', async () => {
      const handler = new FailingHandler();
      queryBus.register('TestQuery', handler);

      const query: TestQuery = { id: 'missing' };
      const result = await queryBus.execute(query, 'TestQuery');

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(NotFoundError);
        expect(result.error.message).toBe("TestResource with identifier 'missing' not found");
      }
    });

    it('should catch and wrap exceptions thrown by handler', async () => {
      const handler = new ThrowingHandler();
      queryBus.register('TestQuery', handler);

      const query: TestQuery = { id: 'will-throw' };
      const result = await queryBus.execute(query, 'TestQuery');

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(InternalError);
        expect(result.error.message).toContain('Query handler failed');
        expect(result.error.message).toContain('Unexpected query exception');
      }
    });

    it('should handle query with unknown constructor name', async () => {
      const handler = new SuccessfulHandler();
      queryBus.register('TestQuery', handler);

      // Plain object without constructor
      const query = { id: 'plain object' };
      const result = await queryBus.execute(query); // No explicit name

      // Should fail because constructor.name will be "Object" or "UnknownQuery"
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(InternalError);
        expect(result.error.message).toContain('No handler registered');
      }
    });
  });

  describe('Query Execution - Edge Cases', () => {
    it('should handle handler that returns rejected promise', async () => {
      class RejectingHandler implements IQueryHandler<TestQuery, string> {
        public async handle(query: TestQuery): Promise<Result<string, Error>> {
          return Promise.reject(new Error('Promise rejection in query'));
        }
      }

      const handler = new RejectingHandler();
      queryBus.register('TestQuery', handler);

      const query: TestQuery = { id: 'reject-test' };
      const result = await queryBus.execute(query, 'TestQuery');

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(InternalError);
        expect(result.error.message).toContain('Query handler failed');
        expect(result.error.message).toContain('Promise rejection in query');
      }
    });

    it('should execute queries in parallel without interference', async () => {
      const handler = new SuccessfulHandler();
      queryBus.register('TestQuery', handler);

      // Execute multiple queries in parallel
      const queries = Array.from({ length: 10 }, (_, i) => ({
        id: `query-${i}`,
      }));

      const results = await Promise.all(
        queries.map((q) => queryBus.execute(q, 'TestQuery'))
      );

      // All should succeed
      expect(results.every((r) => r.isOk())).toBe(true);

      // Each should have correct value
      results.forEach((result, index) => {
        if (result.isOk()) {
          expect(result.value).toBe(`Result for: query-${index}`);
        }
      });
    });

    it('should not affect other handlers when one handler fails', async () => {
      const successHandler = new SuccessfulHandler();
      const failHandler = new FailingHandler();

      queryBus.register('SuccessQuery', successHandler);
      queryBus.register('FailQuery', failHandler);

      const successQuery: TestQuery = { id: 'success' };
      const failQuery: TestQuery = { id: 'fail' };

      // Execute failing query first
      const failResult = await queryBus.execute(failQuery, 'FailQuery');
      expect(failResult.isErr()).toBe(true);

      // Success query should still work
      const successResult = await queryBus.execute(successQuery, 'SuccessQuery');
      expect(successResult.isOk()).toBe(true);
      if (successResult.isOk()) {
        expect(successResult.value).toBe('Result for: success');
      }
    });

    it('should handle special characters in query name', async () => {
      const handler = new SuccessfulHandler();
      const specialName = 'Get-User-Query_v2.0';

      queryBus.register(specialName, handler);

      const query: TestQuery = { id: 'special-chars' };
      const result = await queryBus.execute(query, specialName);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe('Result for: special-chars');
      }
    });
  });

  describe('Handler State Isolation', () => {
    it('should maintain separate state for different handler instances', async () => {
      class StatefulHandler implements IQueryHandler<TestQuery, number> {
        private callCount = 0;

        public async handle(query: TestQuery): Promise<Result<number, Error>> {
          this.callCount++;
          return ok(this.callCount);
        }
      }

      const handler1 = new StatefulHandler();
      const handler2 = new StatefulHandler();

      queryBus.register('Handler1', handler1);
      queryBus.register('Handler2', handler2);

      const query: TestQuery = { id: 'test' };

      // Call handler1 three times
      await queryBus.execute(query, 'Handler1');
      await queryBus.execute(query, 'Handler1');
      const result1 = await queryBus.execute(query, 'Handler1');

      // Call handler2 once
      const result2 = await queryBus.execute(query, 'Handler2');

      // Each handler should maintain its own state
      expect(result1.isOk() && result1.value).toBe(3);
      expect(result2.isOk() && result2.value).toBe(1);
    });
  });

  describe('Query-Specific Behaviors', () => {
    it('should support read-only operations (queries should not modify state)', async () => {
      class ReadOnlyHandler implements IQueryHandler<TestQuery, string> {
        public async handle(query: TestQuery): Promise<Result<string, Error>> {
          // Query handlers should only read, not write
          // This is a convention test to demonstrate the pattern
          return ok(`Read: ${query.id}`);
        }
      }

      const handler = new ReadOnlyHandler();
      queryBus.register('ReadQuery', handler);

      const query: TestQuery = { id: 'readonly-data' };
      const result = await queryBus.execute(query, 'ReadQuery');

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe('Read: readonly-data');
      }
    });

    it('should handle queries that return complex data structures', async () => {
      interface ComplexResult {
        items: string[];
        total: number;
        page: number;
      }

      class ComplexHandler implements IQueryHandler<TestQuery, ComplexResult> {
        public async handle(query: TestQuery): Promise<Result<ComplexResult, Error>> {
          return ok({
            items: [`item-${query.id}-1`, `item-${query.id}-2`],
            total: 2,
            page: 1,
          });
        }
      }

      const handler = new ComplexHandler();
      queryBus.register('ComplexQuery', handler);

      const query: TestQuery = { id: 'complex' };
      const result = await queryBus.execute(query, 'ComplexQuery');

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.items).toHaveLength(2);
        expect(result.value.items[0]).toBe('item-complex-1');
        expect(result.value.total).toBe(2);
        expect(result.value.page).toBe(1);
      }
    });
  });
});
