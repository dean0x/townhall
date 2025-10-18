/**
 * ARCHITECTURE: Application layer port for storage initialization
 * Pattern: Interface for infrastructure dependency
 * Rationale: Application layer defines contract, infrastructure implements
 *
 * This interface allows the application layer to initialize storage
 * without depending on concrete infrastructure implementations.
 */

import { Result } from '../../shared/result';
import { StorageError } from '../../shared/errors';

export interface IStorageInitializer {
  /**
   * Initialize the storage directory structure
   *
   * Creates necessary directories for:
   * - Object storage (arguments, simulations, agents)
   * - References (HEAD, active simulation)
   * - Indexes (by-agent, by-type, by-simulation)
   *
   * @returns Result containing void on success or StorageError on failure
   */
  initialize(): Promise<Result<void, StorageError>>;
}
