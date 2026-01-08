/**
 * ARCHITECTURE: Debate-specific value object
 * Pattern: String enum for type-safe argument classification
 * Rationale: Defines the three supported argument types in debates
 */

import { Result, ok, err } from '../../../shared/result';
import { ValidationError } from '../../../shared/errors';

export enum ArgumentType {
  DEDUCTIVE = 'deductive',
  INDUCTIVE = 'inductive',
  EMPIRICAL = 'empirical',
}

export const ARGUMENT_TYPES: readonly ArgumentType[] = Object.values(ArgumentType);

export function isValidArgumentType(value: string): value is ArgumentType {
  return ARGUMENT_TYPES.includes(value as ArgumentType);
}

export function parseArgumentType(value: string): Result<ArgumentType, ValidationError> {
  if (!isValidArgumentType(value)) {
    return err(
      new ValidationError(
        `Invalid argument type: ${value}. Must be one of: ${ARGUMENT_TYPES.join(', ')}`,
        'argumentType'
      )
    );
  }
  return ok(value);
}

export function getArgumentTypeDescription(type: ArgumentType): string {
  switch (type) {
    case ArgumentType.DEDUCTIVE:
      return 'Logical reasoning from premises to conclusion';
    case ArgumentType.INDUCTIVE:
      return 'Generalization from specific observations';
    case ArgumentType.EMPIRICAL:
      return 'Claims supported by evidence and data';
  }
}
