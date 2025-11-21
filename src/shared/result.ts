/**
 * ARCHITECTURE: Result type utilities for functional error handling
 * Pattern: Railway-oriented programming with explicit error propagation
 * Rationale: Prevents accidental type mismatches in error paths
 *
 * IMPORTANT: Always use propagateError() or mapError() when returning
 * errors from a function with a different success type than the source.
 *
 * Example:
 *   // WRONG - loses type safety:
 *   if (result.isErr()) return result;
 *
 *   // CORRECT - explicit error propagation:
 *   if (result.isErr()) return propagateError(result);
 */

import { Result, ok, err, ResultAsync, okAsync, errAsync } from 'neverthrow';
import type { Ok, Err } from 'neverthrow';

// Re-export core types
export { Result, ok, err, ResultAsync, okAsync, errAsync };
export type { Ok, Err };

/**
 * Propagate an error from one Result type to another.
 * Use this when returning early from a function on error.
 *
 * This is type-safe because it extracts only the error, discarding
 * the (potentially incorrect) success type from the source.
 *
 * @example
 * async function createUser(data: UserData): Promise<Result<User, Error>> {
 *   const validationResult = validateData(data);
 *   if (validationResult.isErr()) {
 *     return propagateError(validationResult); // Type-safe!
 *   }
 *   // ...
 * }
 */
export function propagateError<TNewValue, TError>(
  result: Result<unknown, TError>
): Result<TNewValue, TError> {
  if (result.isOk()) {
    throw new Error('propagateError called on Ok result - this is a bug');
  }
  return err(result.error);
}

/**
 * Async version of propagateError
 */
export function propagateErrorAsync<TNewValue, TError>(
  result: Result<unknown, TError>
): ResultAsync<TNewValue, TError> {
  return errAsync(result.isErr() ? result.error : (undefined as never));
}

/**
 * Map the error type of a Result to a new error type.
 * Useful when you need to convert between error types.
 *
 * @example
 * const result = repo.findById(id); // Result<User, StorageError>
 * return mapError(result, e => new NotFoundError('User', id));
 */
export function mapError<TValue, TErrorIn, TErrorOut>(
  result: Result<TValue, TErrorIn>,
  mapper: (error: TErrorIn) => TErrorOut
): Result<TValue, TErrorOut> {
  return result.mapErr(mapper);
}

/**
 * Combine multiple Results into a single Result.
 * If any Result is an error, returns the first error.
 * If all are Ok, returns an array of values.
 *
 * @example
 * const results = await Promise.all([
 *   repo.findById(id1),
 *   repo.findById(id2),
 * ]);
 * const combined = combineResults(results);
 */
export function combineResults<T, E>(
  results: readonly Result<T, E>[]
): Result<readonly T[], E> {
  const values: T[] = [];
  for (const result of results) {
    if (result.isErr()) {
      return err(result.error);
    }
    values.push(result.value);
  }
  return ok(values);
}

/**
 * Execute a function that may throw and wrap it in a Result.
 * Use this at system boundaries (e.g., parsing JSON, calling external APIs).
 *
 * @example
 * const parsed = tryCatch(
 *   () => JSON.parse(data),
 *   e => new ValidationError(`Invalid JSON: ${e}`)
 * );
 */
export function tryCatch<T, E>(
  fn: () => T,
  errorMapper: (error: unknown) => E
): Result<T, E> {
  try {
    return ok(fn());
  } catch (error) {
    return err(errorMapper(error));
  }
}

/**
 * Async version of tryCatch
 */
export async function tryCatchAsync<T, E>(
  fn: () => Promise<T>,
  errorMapper: (error: unknown) => E
): Promise<Result<T, E>> {
  try {
    return ok(await fn());
  } catch (error) {
    return err(errorMapper(error));
  }
}

/**
 * Unwrap a Result, throwing if it's an error.
 * Only use this at the top level of your application (e.g., CLI entry point).
 * NEVER use in business logic.
 *
 * @example
 * // In CLI command handler
 * const user = unwrapOrThrow(await createUser(data));
 */
export function unwrapOrThrow<T, E extends Error>(result: Result<T, E>): T {
  if (result.isErr()) {
    throw result.error;
  }
  return result.value;
}

/**
 * Type guard to check if a value is a Result type
 */
export function isResult<T, E>(value: unknown): value is Result<T, E> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'isOk' in value &&
    'isErr' in value &&
    typeof (value as Result<T, E>).isOk === 'function'
  );
}