/**
 * ARCHITECTURE: Value object for simulation type identification
 * Pattern: Branded type with extensible union
 * Rationale: Type-safe discrimination of simulation types
 */

import { Brand } from '../../shared/types';

/**
 * Known simulation types in the system.
 * New types are added here as they are implemented.
 */
export type SimulationTypeName = 'debate' | 'decision' | 'brainstorm';

/**
 * Branded type for simulation type to prevent string confusion
 */
export type SimulationType = Brand<SimulationTypeName, 'SimulationType'>;

/**
 * Factory for creating SimulationType values
 */
export const SimulationTypeFactory = {
  /**
   * Create a SimulationType from a known type name
   */
  create(name: SimulationTypeName): SimulationType {
    return name as SimulationType;
  },

  /**
   * Check if a string is a valid simulation type
   */
  isValid(value: string): value is SimulationTypeName {
    return ['debate', 'decision', 'brainstorm'].includes(value);
  },

  /**
   * Pre-defined simulation types
   */
  DEBATE: 'debate' as SimulationType,
  DECISION: 'decision' as SimulationType,
  BRAINSTORM: 'brainstorm' as SimulationType,
} as const;
