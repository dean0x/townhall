/**
 * ARCHITECTURE: Repository interface for debate simulations
 * Pattern: Interface in core, implementation in infrastructure
 * Rationale: Maintains single active debate constraint
 */

import { Result } from '../../shared/result';
import { NotFoundError, StorageError, ConflictError } from '../../shared/errors';
import { DebateSimulation } from '../entities/DebateSimulation';
import { SimulationId } from '../value-objects/SimulationId';

export interface ISimulationRepository {
  /**
   * Save a simulation to storage
   */
  save(simulation: DebateSimulation): Promise<Result<SimulationId, StorageError>>;

  /**
   * Find simulation by ID
   */
  findById(id: SimulationId): Promise<Result<DebateSimulation, NotFoundError>>;

  /**
   * Get the currently active simulation (enforces single active constraint)
   */
  getActive(): Promise<Result<DebateSimulation, NotFoundError>>;

  /**
   * Set a simulation as the active one
   */
  setActive(id: SimulationId): Promise<Result<void, StorageError | ConflictError>>;

  /**
   * Check if there is an active simulation
   */
  hasActive(): Promise<Result<boolean, StorageError>>;

  /**
   * Clear the active simulation reference
   */
  clearActive(): Promise<Result<void, StorageError>>;

  /**
   * List all simulations (for historical access)
   */
  listAll(): Promise<Result<DebateSimulation[], StorageError>>;

  /**
   * Check if a simulation exists
   */
  exists(id: SimulationId): Promise<Result<boolean, StorageError>>;

  /**
   * Delete a simulation (cleanup operation)
   */
  delete(id: SimulationId): Promise<Result<void, StorageError>>;
}