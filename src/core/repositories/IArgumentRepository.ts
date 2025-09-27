/**
 * ARCHITECTURE: Repository interface in core domain
 * Pattern: Interface defines contract, infrastructure provides implementation
 * Rationale: Dependency inversion - core doesn't depend on storage details
 */

import { Result } from '../../shared/result';
import { NotFoundError, StorageError } from '../../shared/errors';
import { Argument } from '../entities/Argument';
import { Rebuttal } from '../entities/Rebuttal';
import { Concession } from '../entities/Concession';
import { ArgumentId } from '../value-objects/ArgumentId';
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
   */
  findById(id: ArgumentId | string): Promise<Result<Argument, NotFoundError>>;

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
   * Find relationships for an argument (rebuttals, concessions, supports)
   */
  findRelationships(argumentId: ArgumentId): Promise<Result<{
    rebuttals: ArgumentId[];
    concessions: ArgumentId[];
    supports: ArgumentId[];
  }, StorageError>>;
}