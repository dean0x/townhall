/**
 * Result type wrapper using neverthrow library
 * Provides functional error handling throughout the application
 */

export { Result, ok, err, ResultAsync, okAsync, errAsync } from 'neverthrow';

export type { Ok, Err } from 'neverthrow';