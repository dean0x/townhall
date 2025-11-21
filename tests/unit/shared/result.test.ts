/**
 * Unit tests for Result utility functions
 * Tests error propagation, combination, and type safety utilities
 */

import { describe, it, expect } from 'vitest';
import {
  ok,
  err,
  propagateError,
  propagateErrorAsync,
  mapError,
  combineResults,
  tryCatch,
  tryCatchAsync,
  unwrapOrThrow,
  isResult,
} from '../../../src/shared/result';

describe('Result Utilities', () => {
  describe('propagateError', () => {
    it('should propagate error from one Result type to another', () => {
      const originalError = new Error('original error');
      const sourceResult = err<string, Error>(originalError);

      const propagated = propagateError<number, Error>(sourceResult);

      expect(propagated.isErr()).toBe(true);
      if (propagated.isErr()) {
        expect(propagated.error).toBe(originalError);
      }
    });

    it('should throw when called on Ok result', () => {
      const okResult = ok<string, Error>('success');

      expect(() => propagateError(okResult)).toThrow(
        'propagateError called on Ok result - this is a bug'
      );
    });

    it('should preserve error type information', () => {
      class CustomError extends Error {
        constructor(public readonly code: number) {
          super('custom error');
        }
      }

      const sourceResult = err<string, CustomError>(new CustomError(404));
      const propagated = propagateError<number[], CustomError>(sourceResult);

      expect(propagated.isErr()).toBe(true);
      if (propagated.isErr()) {
        expect(propagated.error).toBeInstanceOf(CustomError);
        expect(propagated.error.code).toBe(404);
      }
    });
  });

  describe('propagateErrorAsync', () => {
    it('should propagate error to ResultAsync', async () => {
      const originalError = new Error('async error');
      const sourceResult = err<string, Error>(originalError);

      const propagated = propagateErrorAsync<number, Error>(sourceResult);
      const resolved = await propagated;

      expect(resolved.isErr()).toBe(true);
      if (resolved.isErr()) {
        expect(resolved.error).toBe(originalError);
      }
    });
  });

  describe('mapError', () => {
    it('should map error type using mapper function', () => {
      class SourceError extends Error {}
      class TargetError extends Error {
        constructor(public readonly source: SourceError) {
          super('mapped error');
        }
      }

      const sourceError = new SourceError('source');
      const sourceResult = err<string, SourceError>(sourceError);

      const mapped = mapError(sourceResult, (e) => new TargetError(e));

      expect(mapped.isErr()).toBe(true);
      if (mapped.isErr()) {
        expect(mapped.error).toBeInstanceOf(TargetError);
        expect(mapped.error.source).toBe(sourceError);
      }
    });

    it('should pass through Ok result unchanged', () => {
      const okResult = ok<string, Error>('success');

      const mapped = mapError(okResult, () => new Error('should not be called'));

      expect(mapped.isOk()).toBe(true);
      if (mapped.isOk()) {
        expect(mapped.value).toBe('success');
      }
    });
  });

  describe('combineResults', () => {
    it('should combine all Ok results into array', () => {
      const results = [ok<number, Error>(1), ok<number, Error>(2), ok<number, Error>(3)];

      const combined = combineResults(results);

      expect(combined.isOk()).toBe(true);
      if (combined.isOk()) {
        expect(combined.value).toEqual([1, 2, 3]);
      }
    });

    it('should return first error if any result is Err', () => {
      const firstError = new Error('first error');
      const results = [
        ok<number, Error>(1),
        err<number, Error>(firstError),
        err<number, Error>(new Error('second error')),
      ];

      const combined = combineResults(results);

      expect(combined.isErr()).toBe(true);
      if (combined.isErr()) {
        expect(combined.error).toBe(firstError);
      }
    });

    it('should return empty array for empty input', () => {
      const combined = combineResults<number, Error>([]);

      expect(combined.isOk()).toBe(true);
      if (combined.isOk()) {
        expect(combined.value).toEqual([]);
      }
    });
  });

  describe('tryCatch', () => {
    it('should return Ok for successful function execution', () => {
      const result = tryCatch(
        () => JSON.parse('{"key": "value"}'),
        (e) => new Error(`Parse failed: ${e}`)
      );

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toEqual({ key: 'value' });
      }
    });

    it('should return Err for throwing function', () => {
      const result = tryCatch(
        () => JSON.parse('invalid json'),
        (e) => new Error(`Parse failed: ${e}`)
      );

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toContain('Parse failed');
      }
    });

    it('should pass error to mapper function', () => {
      const result = tryCatch(
        () => {
          throw new Error('specific error');
        },
        (e) => {
          expect(e).toBeInstanceOf(Error);
          return new Error(`wrapped: ${(e as Error).message}`);
        }
      );

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toBe('wrapped: specific error');
      }
    });
  });

  describe('tryCatchAsync', () => {
    it('should return Ok for successful async function', async () => {
      const result = await tryCatchAsync(
        async () => 'async result',
        (e) => new Error(`Async failed: ${e}`)
      );

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe('async result');
      }
    });

    it('should return Err for rejecting async function', async () => {
      const result = await tryCatchAsync(
        async () => {
          throw new Error('async error');
        },
        (e) => new Error(`Caught: ${(e as Error).message}`)
      );

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toBe('Caught: async error');
      }
    });
  });

  describe('unwrapOrThrow', () => {
    it('should return value for Ok result', () => {
      const okResult = ok<string, Error>('success');

      const value = unwrapOrThrow(okResult);

      expect(value).toBe('success');
    });

    it('should throw error for Err result', () => {
      const error = new Error('test error');
      const errResult = err<string, Error>(error);

      expect(() => unwrapOrThrow(errResult)).toThrow(error);
    });
  });

  describe('isResult', () => {
    it('should return true for Ok result', () => {
      const okResult = ok<string, Error>('value');
      expect(isResult(okResult)).toBe(true);
    });

    it('should return true for Err result', () => {
      const errResult = err<string, Error>(new Error('error'));
      expect(isResult(errResult)).toBe(true);
    });

    it('should return false for non-Result objects', () => {
      expect(isResult(null)).toBe(false);
      expect(isResult(undefined)).toBe(false);
      expect(isResult('string')).toBe(false);
      expect(isResult(123)).toBe(false);
      expect(isResult({ isOk: true })).toBe(false);
      expect(isResult({ isOk: 'not a function', isErr: 'not a function' })).toBe(false);
    });

    it('should return false for objects with similar structure but wrong types', () => {
      const fakeResult = {
        isOk: true,
        isErr: false,
      };
      expect(isResult(fakeResult)).toBe(false);
    });
  });
});
