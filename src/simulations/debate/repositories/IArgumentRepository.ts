/**
 * ARCHITECTURE: Debate-specific repository interface for arguments
 * Pattern: Extends generic IActionRepository with debate-specific methods
 * Rationale: Separates debate-specific storage needs from generic action storage
 *
 * This interface extends IActionRepository<Argument, ArgumentId> and adds
 * debate-specific methods like saveRebuttal, saveConcession, findRelationships.
 */

import type { Result } from '../../../shared/result';
import type { StorageError } from '../../../shared/errors';
import type { IActionRepository } from '../../../core/repositories/IActionRepository';
import type { SimulationId } from '../../../core/value-objects/SimulationId';
import type { AgentId } from '../../../core/value-objects/AgentId';
import type { Argument } from '../entities/Argument';
import type { Rebuttal } from '../entities/Rebuttal';
import type { Concession } from '../entities/Concession';
import type { ArgumentId } from '../value-objects/ArgumentId';

/**
 * Debate-specific repository for arguments, rebuttals, and concessions.
 *
 * Extends the generic IActionRepository with debate-specific methods
 * for handling the relationships between arguments.
 */
export interface IArgumentRepository extends IActionRepository<Argument, ArgumentId> {
  /**
   * Save a rebuttal to storage.
   * Rebuttals are a type of argument that targets another argument.
   */
  saveRebuttal(rebuttal: Rebuttal): Promise<Result<ArgumentId, StorageError>>;

  /**
   * Save a concession to storage.
   * Concessions are a type of argument that acknowledges another argument's validity.
   */
  saveConcession(concession: Concession): Promise<Result<ArgumentId, StorageError>>;

  /**
   * Find arguments that reference a target argument (rebuttals/concessions).
   * @param targetId - The argument being referenced
   * @returns Arguments that rebut or concede to the target
   */
  findReferencingArguments(targetId: ArgumentId): Promise<Result<Argument[], StorageError>>;

  /**
   * Find all arguments in a simulation (override with debate-specific return type).
   * @override from IActionRepository
   */
  findBySimulation(simulationId: SimulationId): Promise<Result<Argument[], StorageError>>;

  /**
   * Find all arguments by an agent (override with debate-specific return type).
   * @override from IActionRepository
   */
  findByAgent(agentId: AgentId): Promise<Result<Argument[], StorageError>>;

  /**
   * Find relationships for an argument (rebuttals, concessions, supports).
   * @param argumentId - The argument to find relationships for
   * @returns Object containing arrays of IDs for each relationship type
   */
  findRelationships(argumentId: ArgumentId): Promise<Result<{
    rebuttals: ArgumentId[];
    concessions: ArgumentId[];
    supports: ArgumentId[];
  }, StorageError>>;
}
