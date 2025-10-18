/**
 * ArgumentType enum
 * Defines the three supported argument types
 */

import { Result, ok, err } from '../../shared/result';
import { ValidationError } from '../../shared/errors';

export enum ArgumentType {
  DEDUCTIVE = 'deductive',
  INDUCTIVE = 'inductive',
  EMPIRICAL = 'empirical',
}

export const ARGUMENT_TYPES = Object.values(ArgumentType) as const;

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