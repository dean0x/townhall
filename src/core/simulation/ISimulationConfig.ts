/**
 * ARCHITECTURE: Configuration interface for simulation type registration
 * Pattern: Factory pattern with metadata for registration
 * Rationale: Enables registry to create simulations without knowing concrete types
 */

import type { Result } from '../../shared/result';
import type { ValidationError } from '../../shared/errors';
import type { SimulationType } from './SimulationType';
import type { ISimulation } from './ISimulation';

/**
 * Configuration for registering a simulation type with the registry.
 *
 * Each simulation type (debate, decision, brainstorm) provides a config
 * that tells the registry how to create and identify simulations of that type.
 *
 * @typeParam TSimulation - The concrete simulation type
 * @typeParam TConfig - The simulation's configuration type
 * @typeParam TStatus - The simulation's status enum type
 *
 * @example
 * ```typescript
 * const DebateSimulationConfig: ISimulationTypeConfig<DebateSimulation, DebateConfig, DebateStatus> = {
 *   type: SimulationTypeFactory.DEBATE,
 *   name: 'Debate',
 *   description: 'Structured argumentation with rebuttals and concessions',
 *   actionTypes: ['argument', 'rebuttal', 'concession'],
 *   // ...
 * };
 * ```
 */
export interface ISimulationTypeConfig<
  TSimulation extends ISimulation<TConfig, TStatus>,
  TConfig = unknown,
  TStatus extends string = string
> {
  /** Unique type identifier */
  readonly type: SimulationType;

  /** Human-readable name for display */
  readonly name: string;

  /** Description of what this simulation type is for */
  readonly description: string;

  /** Action types supported by this simulation (e.g., ['argument', 'rebuttal', 'concession']) */
  readonly actionTypes: readonly string[];

  /**
   * Factory method to create a new simulation instance.
   * The registry calls this when a user creates a new simulation of this type.
   */
  create(params: SimulationCreateParams<TConfig>): Result<TSimulation, ValidationError>;

  /**
   * Validate that a configuration object is valid for this simulation type.
   */
  validateConfig(config: unknown): Result<TConfig, ValidationError>;
}

/**
 * Parameters passed to simulation factory methods
 */
export interface SimulationCreateParams<TConfig = unknown> {
  /** Topic or title for the simulation */
  readonly topic: string;

  /** Type-specific configuration */
  readonly config: TConfig;

  /** Creation timestamp */
  readonly createdAt: string; // ISO timestamp

  /** Crypto service for ID generation (injected) */
  readonly cryptoService: {
    hash(content: string, algorithm: string): string;
  };
}

/**
 * Simplified config interface for runtime registration
 * (when full generics aren't needed)
 */
export interface SimulationTypeInfo {
  readonly type: SimulationType;
  readonly name: string;
  readonly description: string;
  readonly actionTypes: readonly string[];
}
