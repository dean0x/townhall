/**
 * Shared type definitions and branded type utilities
 * Provides type safety for domain identifiers and values
 */

// Branded type utility for creating distinct types from primitives
declare const __brand: unique symbol;
export type Brand<T, TBrand extends string> = T & { [__brand]: TBrand };

// Common primitive types with validation
export type NonEmptyString = string & { readonly __tag: 'NonEmptyString' };
export type PositiveInteger = number & { readonly __tag: 'PositiveInteger' };
export type ISOTimestamp = string & { readonly __tag: 'ISOTimestamp' };
export type UUID = string & { readonly __tag: 'UUID' };
export type SHA256Hash = string & { readonly __tag: 'SHA256Hash' };

// Utility type for making readonly arrays
export type ReadonlyArray<T> = readonly T[];

// Utility type for making all properties readonly deeply
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

// Helper functions for creating branded types
export const createNonEmptyString = (value: string): NonEmptyString => {
  if (value.length === 0) {
    throw new Error('String cannot be empty');
  }
  return value as NonEmptyString;
};

export const createPositiveInteger = (value: number): PositiveInteger => {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error('Value must be a positive integer');
  }
  return value as PositiveInteger;
};

export const createISOTimestamp = (date: Date = new Date()): ISOTimestamp => {
  return date.toISOString() as ISOTimestamp;
};

// Validation helpers
export const isValidUUID = (value: string): value is UUID => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
};

export const isValidSHA256 = (value: string): value is SHA256Hash => {
  const sha256Regex = /^[a-f0-9]{64}$/i;
  return sha256Regex.test(value);
};

export const createUUID = (value: string): UUID => {
  if (!isValidUUID(value)) {
    throw new Error('Invalid UUID format');
  }
  return value as UUID;
};

export const createSHA256Hash = (value: string): SHA256Hash => {
  if (!isValidSHA256(value)) {
    throw new Error('Invalid SHA256 hash format');
  }
  return value as SHA256Hash;
};