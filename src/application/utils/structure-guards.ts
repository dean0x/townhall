/**
 * Type guards for ArgumentStructure discriminated union
 * These allow TypeScript to narrow types without unsafe 'as any' casts
 */

import {
  ArgumentStructure,
  DeductiveStructure,
  InductiveStructure,
  EmpiricalStructure
} from '../../core/entities/Argument';

/**
 * Type guard for DeductiveStructure
 * Checks for presence of 'premises' and 'conclusion' properties
 */
export function isDeductiveStructure(structure: ArgumentStructure): structure is DeductiveStructure {
  return 'premises' in structure && 'conclusion' in structure;
}

/**
 * Type guard for InductiveStructure
 * Checks for presence of 'observations' and 'generalization' properties
 */
export function isInductiveStructure(structure: ArgumentStructure): structure is InductiveStructure {
  return 'observations' in structure && 'generalization' in structure;
}

/**
 * Type guard for EmpiricalStructure
 * Checks for presence of 'evidence' and 'claim' properties
 */
export function isEmpiricalStructure(structure: ArgumentStructure): structure is EmpiricalStructure {
  return 'evidence' in structure && 'claim' in structure;
}
