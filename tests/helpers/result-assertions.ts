/**
 * Test helper utilities for Result type assertions
 *
 * These utilities reduce test complexity from 3 nesting levels to 1
 * by providing simple assertion functions for Result types.
 *
 * @example
 * // Instead of:
 * const result = someFunction();
 * expect(result.isOk()).toBe(true);
 * if (result.isOk()) {
 *   expect(result.value.name).toBe('test');
 * }
 *
 * // Use:
 * const value = expectOk(someFunction());
 * expect(value.name).toBe('test');
 */

import { Result } from '../../src/shared/result';

/**
 * Asserts that a Result is Ok and returns the unwrapped value
 * Throws an error if the Result is Err
 *
 * @param result - The Result to check
 * @returns The unwrapped Ok value
 * @throws Error if the Result is Err
 */
export function expectOk<T, E>(result: Result<T, E>): T {
  if (result.isErr()) {
    const errorMessage = result.error instanceof Error
      ? result.error.message
      : JSON.stringify(result.error);
    throw new Error(`Expected Result to be Ok, but got Err: ${errorMessage}`);
  }
  return result.value;
}

/**
 * Asserts that a Result is Err and returns the unwrapped error
 * Throws an error if the Result is Ok
 *
 * @param result - The Result to check
 * @returns The unwrapped Err value
 * @throws Error if the Result is Ok
 */
export function expectErr<T, E>(result: Result<T, E>): E {
  if (result.isOk()) {
    const valueMessage = typeof result.value === 'object'
      ? JSON.stringify(result.value)
      : String(result.value);
    throw new Error(`Expected Result to be Err, but got Ok: ${valueMessage}`);
  }
  return result.error;
}

/**
 * Type guard that asserts a Result is Ok
 * Useful for TypeScript type narrowing in tests
 *
 * @param result - The Result to check
 * @returns True if Ok, false if Err (with assertion failure)
 */
export function assertOk<T, E>(result: Result<T, E>): asserts result is { isOk: () => true; value: T } {
  if (result.isErr()) {
    const errorMessage = result.error instanceof Error
      ? result.error.message
      : JSON.stringify(result.error);
    throw new Error(`Expected Result to be Ok, but got Err: ${errorMessage}`);
  }
}

/**
 * Type guard that asserts a Result is Err
 * Useful for TypeScript type narrowing in tests
 *
 * @param result - The Result to check
 * @returns True if Err, false if Ok (with assertion failure)
 */
export function assertErr<T, E>(result: Result<T, E>): asserts result is { isErr: () => true; error: E } {
  if (result.isOk()) {
    const valueMessage = typeof result.value === 'object'
      ? JSON.stringify(result.value)
      : String(result.value);
    throw new Error(`Expected Result to be Err, but got Ok: ${valueMessage}`);
  }
}

/**
 * Asserts that a Result is Ok and the value matches a predicate
 *
 * @param result - The Result to check
 * @param predicate - Function that tests the Ok value
 * @param message - Optional error message
 * @returns The unwrapped Ok value if predicate passes
 * @throws Error if the Result is Err or predicate fails
 */
export function expectOkWith<T, E>(
  result: Result<T, E>,
  predicate: (value: T) => boolean,
  message?: string
): T {
  const value = expectOk(result);
  if (!predicate(value)) {
    const errorMsg = message || `Ok value did not match predicate: ${JSON.stringify(value)}`;
    throw new Error(errorMsg);
  }
  return value;
}

/**
 * Asserts that a Result is Err and the error matches a predicate
 *
 * @param result - The Result to check
 * @param predicate - Function that tests the Err value
 * @param message - Optional error message
 * @returns The unwrapped Err value if predicate passes
 * @throws Error if the Result is Ok or predicate fails
 */
export function expectErrWith<T, E>(
  result: Result<T, E>,
  predicate: (error: E) => boolean,
  message?: string
): E {
  const error = expectErr(result);
  if (!predicate(error)) {
    const errorMsg = message || `Err value did not match predicate: ${JSON.stringify(error)}`;
    throw new Error(errorMsg);
  }
  return error;
}

/**
 * Asserts that a Result is Ok and the value has a specific property with expected value
 *
 * @param result - The Result to check
 * @param property - Property name to check
 * @param expectedValue - Expected value of the property
 * @returns The unwrapped Ok value
 */
export function expectOkProperty<T extends Record<string, any>, E, K extends keyof T>(
  result: Result<T, E>,
  property: K,
  expectedValue: T[K]
): T {
  const value = expectOk(result);
  if (value[property] !== expectedValue) {
    throw new Error(
      `Expected property '${String(property)}' to be ${JSON.stringify(expectedValue)}, ` +
      `but got ${JSON.stringify(value[property])}`
    );
  }
  return value;
}

/**
 * Asserts that a Result is Err and the error message contains a specific substring
 * Useful for ValidationError and other error types with messages
 *
 * @param result - The Result to check
 * @param substring - Substring to search for in error message
 * @returns The unwrapped Err value
 */
export function expectErrMessage<T, E extends { message: string }>(
  result: Result<T, E>,
  substring: string
): E {
  const error = expectErr(result);
  if (!error.message.includes(substring)) {
    throw new Error(
      `Expected error message to contain "${substring}", ` +
      `but got: "${error.message}"`
    );
  }
  return error;
}
