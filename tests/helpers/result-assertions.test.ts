/**
 * Tests for Result assertion helper utilities
 */

import { describe, it, expect } from 'vitest';
import { ok, err } from '../../src/shared/result';
import { ValidationError } from '../../src/shared/errors';
import {
  expectOk,
  expectErr,
  assertOk,
  assertErr,
  expectOkWith,
  expectErrWith,
  expectOkProperty,
  expectErrMessage,
} from './result-assertions';

describe('Result Assertion Helpers', () => {
  describe('expectOk', () => {
    it('should return value when Result is Ok', () => {
      const result = ok(42);
      const value = expectOk(result);
      expect(value).toBe(42);
    });

    it('should throw when Result is Err', () => {
      const result = err(new ValidationError('Test error'));
      expect(() => expectOk(result)).toThrow('Expected Result to be Ok, but got Err: Test error');
    });

    it('should work with complex objects', () => {
      const result = ok({ name: 'Alice', age: 30 });
      const value = expectOk(result);
      expect(value.name).toBe('Alice');
      expect(value.age).toBe(30);
    });
  });

  describe('expectErr', () => {
    it('should return error when Result is Err', () => {
      const error = new ValidationError('Test error');
      const result = err(error);
      const returnedError = expectErr(result);
      expect(returnedError).toBe(error);
    });

    it('should throw when Result is Ok', () => {
      const result = ok(42);
      expect(() => expectErr(result)).toThrow('Expected Result to be Err, but got Ok: 42');
    });

    it('should work with string errors', () => {
      const result = err('Simple error message');
      const error = expectErr(result);
      expect(error).toBe('Simple error message');
    });
  });

  describe('assertOk', () => {
    it('should pass assertion when Result is Ok', () => {
      const result = ok(100);
      expect(() => assertOk(result)).not.toThrow();
    });

    it('should throw when Result is Err', () => {
      const result = err(new ValidationError('Error'));
      expect(() => assertOk(result)).toThrow('Expected Result to be Ok, but got Err: Error');
    });

    it('should provide type narrowing', () => {
      const result = ok(123);
      assertOk(result);
      // TypeScript now knows result.value is available
      expect(result.value).toBe(123);
    });
  });

  describe('assertErr', () => {
    it('should pass assertion when Result is Err', () => {
      const result = err(new ValidationError('Error'));
      expect(() => assertErr(result)).not.toThrow();
    });

    it('should throw when Result is Ok', () => {
      const result = ok(100);
      expect(() => assertErr(result)).toThrow('Expected Result to be Err, but got Ok: 100');
    });

    it('should provide type narrowing', () => {
      const result = err(new ValidationError('Test'));
      assertErr(result);
      // TypeScript now knows result.error is available
      expect(result.error.message).toBe('Test');
    });
  });

  describe('expectOkWith', () => {
    it('should return value when predicate passes', () => {
      const result = ok(10);
      const value = expectOkWith(result, (v) => v > 5);
      expect(value).toBe(10);
    });

    it('should throw when predicate fails', () => {
      const result = ok(3);
      expect(() => expectOkWith(result, (v) => v > 5))
        .toThrow('Ok value did not match predicate');
    });

    it('should use custom error message', () => {
      const result = ok(3);
      expect(() => expectOkWith(result, (v) => v > 5, 'Value too small'))
        .toThrow('Value too small');
    });

    it('should throw when Result is Err', () => {
      const result = err(new ValidationError('Error'));
      expect(() => expectOkWith(result, (v) => true))
        .toThrow('Expected Result to be Ok, but got Err: Error');
    });
  });

  describe('expectErrWith', () => {
    it('should return error when predicate passes', () => {
      const error = new ValidationError('Error message');
      const result = err(error);
      const returnedError = expectErrWith(result, (e) => e.message.includes('Error'));
      expect(returnedError).toBe(error);
    });

    it('should throw when predicate fails', () => {
      const result = err(new ValidationError('Error'));
      expect(() => expectErrWith(result, (e) => e.message.includes('Success')))
        .toThrow('Err value did not match predicate');
    });

    it('should use custom error message', () => {
      const result = err(new ValidationError('Error'));
      expect(() => expectErrWith(result, (e) => false, 'Custom error'))
        .toThrow('Custom error');
    });
  });

  describe('expectOkProperty', () => {
    it('should return value when property matches', () => {
      const result = ok({ name: 'Bob', age: 25 });
      const value = expectOkProperty(result, 'name', 'Bob');
      expect(value.name).toBe('Bob');
      expect(value.age).toBe(25);
    });

    it('should throw when property does not match', () => {
      const result = ok({ name: 'Bob', age: 25 });
      expect(() => expectOkProperty(result, 'name', 'Alice'))
        .toThrow('Expected property \'name\' to be "Alice", but got "Bob"');
    });

    it('should work with numeric properties', () => {
      const result = ok({ id: 1, count: 100 });
      const value = expectOkProperty(result, 'count', 100);
      expect(value.count).toBe(100);
    });
  });

  describe('expectErrMessage', () => {
    it('should return error when message contains substring', () => {
      const error = new ValidationError('Invalid argument: missing premises');
      const result = err(error);
      const returnedError = expectErrMessage(result, 'missing premises');
      expect(returnedError).toBe(error);
    });

    it('should throw when message does not contain substring', () => {
      const result = err(new ValidationError('Invalid argument'));
      expect(() => expectErrMessage(result, 'database error'))
        .toThrow('Expected error message to contain "database error", but got: "Invalid argument"');
    });

    it('should be case-sensitive', () => {
      const result = err(new ValidationError('Invalid Argument'));
      expect(() => expectErrMessage(result, 'invalid argument'))
        .toThrow();
    });
  });

  describe('Real-world usage examples', () => {
    it('should simplify test code compared to manual checks', () => {
      // Simulating a function that returns Result
      const createUser = (name: string) => {
        if (name.length < 3) {
          return err(new ValidationError('Name too short'));
        }
        return ok({ id: 1, name, createdAt: new Date() });
      };

      // Old way (verbose):
      const result1 = createUser('Alice');
      expect(result1.isOk()).toBe(true);
      if (result1.isOk()) {
        expect(result1.value.name).toBe('Alice');
      }

      // New way (concise):
      const user = expectOk(createUser('Alice'));
      expect(user.name).toBe('Alice');

      // Error case - old way:
      const result2 = createUser('Bo');
      expect(result2.isErr()).toBe(true);
      if (result2.isErr()) {
        expect(result2.error.message).toContain('too short');
      }

      // Error case - new way:
      const error = expectErrMessage(createUser('Bo'), 'too short');
      expect(error).toBeInstanceOf(ValidationError);
    });
  });
});
