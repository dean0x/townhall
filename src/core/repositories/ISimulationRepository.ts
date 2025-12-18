/**
 * ARCHITECTURE: Generic repository interface for all simulation types
 * Pattern: Interface in core, simulation-specific implementations in infrastructure
 * Rationale: Core depends on nothing - simulations implement this with their own types
 *
 * Each simulation type (debate, decision, brainstorm) provides its own implementation
 * of this interface with simulation-specific entity types.
 */

import { Result } from '../../shared/result';
import { NotFoundError, StorageError, ConflictError } from '../../shared/errors';
import type { ISimulation } from '../simulation/ISimulation';
import type { SimulationId } from '../value-objects/SimulationId';

/**
 * Generic repository interface for persisting and retrieving simulations.
 *
 * @typeParam TSimulation - The specific simulation type (must implement ISimulation)
 * @typeParam TConfig - The simulation-specific configuration type
 * @typeParam TStatus - The simulation-specific status type
 *
 * @example
 * ```typescript
 * // Debate implements with DebateSimulation
 * interface IDebateRepository extends ISimulationRepository<
 *   DebateSimulation,
 *   DebateConfig,
 *   DebateStatus
 * > {
 *   // debate-specific methods if any
 * }
 *
 * // Decision implements with DecisionSimulation
 * interface IDecisionRepository extends ISimulationRepository<
 *   DecisionSimulation,
 *   DecisionConfig,
 *   DecisionStatus
 * > {
 *   // decision-specific methods
 * }
 * ```
 */
export interface ISimulationRepository<
  TSimulation extends ISimulation<TConfig, TStatus>,
  TConfig = unknown,
  TStatus extends string = string
> {
  /**
   * Save a simulation to storage.
   */
  save(simulation: TSimulation): Promise<Result<SimulationId, StorageError>>;

  /**
   * Find simulation by ID.
   * @returns StorageError if data exists but is corrupted
   */
  findById(id: SimulationId): Promise<Result<TSimulation, NotFoundError | StorageError>>;

  /**
   * Get the currently active simulation (enforces single active constraint).
   * @returns StorageError if data exists but is corrupted
   */
  getActive(): Promise<Result<TSimulation, NotFoundError | StorageError>>;

  /**
   * Set a simulation as the active one (fails if another is already active).
   */
  setActive(id: SimulationId): Promise<Result<void, NotFoundError | StorageError | ConflictError>>;

  /**
   * Switch to a different simulation (overwrites current active simulation).
   * Used by checkout command to allow switching between simulations.
   */
  switchActive(id: SimulationId): Promise<Result<void, NotFoundError | StorageError>>;

  /**
   * Check if there is an active simulation.
   */
  hasActive(): Promise<Result<boolean, StorageError>>;

  /**
   * Clear the active simulation reference.
   */
  clearActive(): Promise<Result<void, StorageError>>;

  /**
   * List all simulations (for historical access).
   */
  listAll(): Promise<Result<TSimulation[], StorageError>>;

  /**
   * Check if a simulation exists.
   */
  exists(id: SimulationId): Promise<Result<boolean, StorageError>>;

  /**
   * Delete a simulation (cleanup operation).
   */
  delete(id: SimulationId): Promise<Result<void, StorageError>>;
}
