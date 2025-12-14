/**
 * ARCHITECTURE: Repository interface in core domain
 * Pattern: Interface defines contract, infrastructure provides implementation
 * Rationale: Dependency inversion - core doesn't depend on storage details
 */

import { Result } from '../../shared/result';
import { NotFoundError, StorageError } from '../../shared/errors';
import { Argument, Rebuttal, Concession, ArgumentId } from '../../simulations/debate';
import { SimulationId } from '../value-objects/SimulationId';
import { AgentId } from '../value-objects/AgentId';

export interface IArgumentRepository {
  /**
   * Save an argument to storage
   */
  save(argument: Argument): Promise<Result<ArgumentId, StorageError>>;

  /**
   * Save a rebuttal to storage
   */
  saveRebuttal(rebuttal: Rebuttal): Promise<Result<ArgumentId, StorageError>>;

  /**
   * Save a concession to storage
   */
  saveConcession(concession: Concession): Promise<Result<ArgumentId, StorageError>>;

  /**
   * Find argument by its ID (full or short hash)
   * Returns StorageError if data exists but is corrupted
   */
  findById(id: ArgumentId | string): Promise<Result<Argument, NotFoundError | StorageError>>;

  /**
   * Find all arguments in a simulation
   */
  findBySimulation(simulationId: SimulationId): Promise<Result<Argument[], StorageError>>;

  /**
   * Find all arguments by an agent
   */
  findByAgent(agentId: AgentId): Promise<Result<Argument[], StorageError>>;

  /**
   * Find arguments that reference a target argument (rebuttals/concessions)
   */
  findReferencingArguments(targetId: ArgumentId): Promise<Result<Argument[], StorageError>>;

  /**
   * Check if an argument exists
   */
  exists(id: ArgumentId): Promise<Result<boolean, StorageError>>;

  /**
   * Expand short hash to full argument ID
   */
  expandShortHash(shortHash: string): Promise<Result<ArgumentId, NotFoundError>>;

  /**
   * Get all argument IDs for a simulation (for indexing)
   */
  getAllIds(simulationId: SimulationId): Promise<Result<ArgumentId[], StorageError>>;

  /**
   * Batch load multiple arguments by ID
   *
   * PERFORMANCE: Single operation to load multiple arguments, avoiding N+1 patterns
   *
   * @param ids - Array of argument IDs to retrieve (duplicates are deduplicated internally)
   * @returns Map of found arguments keyed by ArgumentId. Missing IDs are omitted from
   *          the map (not treated as errors for batch operations).
   * @throws StorageError if deserialization fails for any found argument
   */
  findByIds(ids: ArgumentId[]): Promise<Result<Map<ArgumentId, Argument>, StorageError>>;

  /**
   * Find relationships for an argument (rebuttals, concessions, supports)
   */
  findRelationships(argumentId: ArgumentId): Promise<Result<{
    rebuttals: ArgumentId[];
    concessions: ArgumentId[];
    supports: ArgumentId[];
  }, StorageError>>;
}